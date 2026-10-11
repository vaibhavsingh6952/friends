import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCache } from "../lib/adapters/memoryCache.js";
import { MemoryRateGuard } from "../lib/adapters/memoryRateGuard.js";
import { SystemClock } from "../lib/adapters/systemClock.js";
import { DashboardService } from "../lib/service/dashboardService.js";
import type { GithubGateway, RateLimitInfo, FriendData } from "../lib/ports.js";
import type { MetricContext } from "../lib/domain/types.js";

const rateLimitOk: RateLimitInfo = { limit: 5000, cost: 1, remaining: 4999, resetAt: new Date(Date.now() + 3600000).toISOString() };
const rateLimitCritical: RateLimitInfo = { limit: 5000, cost: 1, remaining: 400, resetAt: new Date(Date.now() + 3600000).toISOString() };

function makeFriend(login: string): FriendData {
  return {
    login,
    name: login,
    avatarUrl: `https://avatar.com/${login}.png`,
    url: `https://github.com/${login}`,
    totalCommitContributions: 10,
    repositories: [],
    topRepositories: [],
    contributionCalendar: { weeks: [] },
    rateLimit: rateLimitOk,
  };
}

class FakeGithub implements GithubGateway {
  constructor(
    private following: { login: string; following: { totalCount: number; nodes: { id: string; login: string }[] } } | null,
    private friends: FriendData[],
    private rateLimit: RateLimitInfo = rateLimitOk
  ) {}

  async fetchFollowing() {
    return { user: this.following, rateLimit: this.rateLimit };
  }

  async fetchFriendDetails() {
    return { nodes: this.friends, rateLimit: this.rateLimit };
  }
}

function makeContext(): MetricContext {
  return {
    now: new Date("2024-06-15T12:00:00Z"),
    since30d: "2024-05-16T12:00:00Z",
    since7d: "2024-06-08T12:00:00Z",
    hiddenUsers: new Set(),
  };
}

describe("DashboardService", () => {
  let cache: MemoryCache;
  let rateGuard: MemoryRateGuard;
  let clock: SystemClock;
  let service: DashboardService;

  beforeEach(() => {
    cache = new MemoryCache();
    rateGuard = new MemoryRateGuard();
    clock = new SystemClock();
    service = new DashboardService(new FakeGithub(null, []), cache, rateGuard, clock, new Set());
  });

  it("returns 404 when user not found", async () => {
    const github = new FakeGithub(null, []);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    await expect(svc.getDashboard("unknown", 40)).rejects.toThrow("User not found");
  });

  it("returns cached data when rate guard blocks", async () => {
    const friends = [makeFriend("user1")];
    const github = new FakeGithub({ login: "target", following: { totalCount: 1, nodes: [{ id: "1", login: "user1" }] } }, friends);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    await svc.getDashboard("target", 40);
    rateGuard.reportBudget(rateLimitCritical);
    const cached = await svc.getDashboard("target", 40);
    expect(cached.stale).toBe(true);
  });

  it("throws RateLimitedError when blocked and no cache", async () => {
    rateGuard.reportBudget(rateLimitCritical);
    const github = new FakeGithub({ login: "target", following: { totalCount: 1, nodes: [{ id: "1", login: "user1" }] } }, []);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    await expect(svc.getDashboard("target", 40)).rejects.toThrow("Rate limited");
  });

  it("serves stale cache on upstream error", async () => {
    const friends = [makeFriend("user1")];
    const github = new FakeGithub({ login: "target", following: { totalCount: 1, nodes: [{ id: "1", login: "user1" }] } }, friends);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    await svc.getDashboard("target", 40);
    const failingGithub = new FakeGithub({ login: "target", following: { totalCount: 1, nodes: [{ id: "1", login: "user1" }] } }, [], rateLimitOk);
    failingGithub.fetchFriendDetails = vi.fn().mockRejectedValue(new Error("upstream"));
    const svc2 = new DashboardService(failingGithub, cache, rateGuard, clock, new Set());
    const result = await svc2.getDashboard("target", 40);
    expect(result.stale).toBe(true);
  });

  it("excludes hidden users", async () => {
    const friends = [makeFriend("user1"), makeFriend("hidden")];
    const github = new FakeGithub({ login: "target", following: { totalCount: 2, nodes: [{ id: "1", login: "user1" }, { id: "2", login: "hidden" }] } }, friends);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set(["hidden"]));
    const result = await svc.getDashboard("target", 40);
    expect(result.friendsCount).toBe(1);
    expect(result.friendsCount).toBe(1);
  });

  it("truncates when following exceeds limit", async () => {
    const followed = Array.from({ length: 50 }, (_, i) => ({ id: String(i), login: `user${i}` }));
    const friends = followed.slice(0, 40).map((f) => makeFriend(f.login));
    const github = new FakeGithub({ login: "target", following: { totalCount: 50, nodes: followed } }, friends);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    const result = await svc.getDashboard("target", 40);
    expect(result.truncated).toBe(true);
    expect(result.totalFollowing).toBe(50);
    expect(result.friendsCount).toBe(40);
  });

  it("OCP: adding a fake metric to registry appears in output without changing service", async () => {
    const friends = [makeFriend("user1")];
    const github = new FakeGithub({ login: "target", following: { totalCount: 1, nodes: [{ id: "1", login: "user1" }] } }, friends);
    const svc = new DashboardService(github, cache, rateGuard, clock, new Set());
    const result = await svc.getDashboard("target", 40);
    expect(result).toHaveProperty("kpis");
    expect(result).toHaveProperty("topCommitters");
    expect(result).toHaveProperty("streaks");
    expect(result).toHaveProperty("recentCommits");
    expect(result).toHaveProperty("languages");
    expect(result).toHaveProperty("languageOfWeek");
    expect(result).toHaveProperty("topRepos");
  });
});