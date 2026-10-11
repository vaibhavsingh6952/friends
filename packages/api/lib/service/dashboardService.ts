import type { GithubGateway, ResultCache, RateGuard, Clock } from "../ports.js";
import type { FriendData, DashboardResponse, MetricContext, RateLimitInfo, MetricKey } from "../domain/types.js";
import { metricRegistry } from "../domain/metrics/index.js";

const BATCH_SIZE = 10;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 50;

export class DashboardService {
  constructor(
    private readonly github: GithubGateway,
    private readonly cache: ResultCache,
    private readonly rateGuard: RateGuard,
    private readonly clock: Clock,
    private readonly hiddenUsers: Set<string>
  ) {}

  async getDashboard(username: string, limit: number): Promise<DashboardResponse> {
    const cacheKey = `dashboard:${username}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    const now = this.clock.now();
    const since30d = new Date(now.getTime() - 30 * 86400000).toISOString();
    const since7d = new Date(now.getTime() - 7 * 86400000).toISOString();

    const ctx: MetricContext = { now, since30d, since7d, hiddenUsers: this.hiddenUsers };

    if (!this.rateGuard.allow()) {
      if (cached) {
        return this.buildResponse(cached.data, cached.totalFollowing, cached.fetchedAt, true, limit);
      }
      throw new RateLimitedError(this.rateGuard.getRetryAfter() ?? 3600);
    }

    try {
      const { user, rateLimit } = await this.github.fetchFollowing(username, limit);
      this.rateGuard.reportBudget(rateLimit);

      if (!user) throw new NotFoundError("User not found");

      const followed = user.following.nodes
        .map((n) => n.login)
        .filter((login) => !this.hiddenUsers.has(login));

      const totalFollowing = user.following.totalCount;
      const truncated = followed.length > limit;
      const limited = followed.slice(0, limit);

      const friends = await this.fetchFriendsInBatches(limited, since30d);

      const fetchedAt = now.toISOString();
      await this.cache.set(cacheKey, { data: friends, totalFollowing, fetchedAt });

      return this.buildResponse(friends, totalFollowing, fetchedAt, false, limit, truncated);
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof RateLimitedError) throw e;
      if (cached) {
        return this.buildResponse(cached.data, cached.totalFollowing, cached.fetchedAt, true, limit);
      }
      throw new UpstreamError("GitHub request failed");
    }
  }

  private async fetchFriendsInBatches(logins: string[], since: string): Promise<FriendData[]> {
    const ids = logins;
    const results: FriendData[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      if (this.rateGuard.isBudgetCritical()) break;
      const { nodes, rateLimit } = await this.github.fetchFriendDetails(batch, since);
      this.rateGuard.reportBudget(rateLimit);
      for (const n of nodes) if (n) results.push(n);
    }

    return results;
  }

  private buildResponse(
    friends: FriendData[],
    totalFollowing: number,
    fetchedAt: string,
    stale: boolean,
    limit: number,
    truncated = false
  ): DashboardResponse {
    const response: Partial<DashboardResponse> = {
      user: friends[0]?.login ?? "",
      fetchedAt,
      stale,
      truncated,
      totalFollowing,
      friendsCount: friends.length,
    };

    for (const metric of metricRegistry) {
      (response as any)[metric.key] = metric.compute(friends, {
        now: this.clock.now(),
        since30d: new Date(this.clock.now().getTime() - 30 * 86400000).toISOString(),
        since7d: new Date(this.clock.now().getTime() - 7 * 86400000).toISOString(),
        hiddenUsers: this.hiddenUsers,
      });
    }

    return response as DashboardResponse;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitedError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Rate limited");
    this.name = "RateLimitedError";
  }
}

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}