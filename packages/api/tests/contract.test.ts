import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GithubGateway, ResultCache, RateGuard, Clock } from "../lib/ports.js";
import type { FriendData, RateLimitInfo, DashboardResponse, MetricContext } from "../lib/domain/types.js";

const rateLimitOk: RateLimitInfo = { limit: 5000, cost: 1, remaining: 4999, resetAt: new Date(Date.now() + 3600000).toISOString() };

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

function makeContext(): MetricContext {
  return {
    now: new Date("2024-06-15T12:00:00Z"),
    since30d: "2024-05-16T12:00:00Z",
    since7d: "2024-06-08T12:00:00Z",
    hiddenUsers: new Set(),
  };
}

function runContractTests(
  createGithub: () => GithubGateway,
  createCache: () => ResultCache,
  createRateGuard: () => RateGuard,
  createClock: () => Clock
) {
  describe("GithubGateway contract", () => {
    it("fetchFollowing returns user or null", async () => {
      const gateway = createGithub();
      const result = await gateway.fetchFollowing("test", 10);
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("rateLimit");
    });

    it("fetchFriendDetails returns nodes array", async () => {
      const gateway = createGithub();
      const result = await gateway.fetchFriendDetails(["id1"], "2024-01-01T00:00:00Z");
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result).toHaveProperty("rateLimit");
    });
  });

  describe("ResultCache contract", () => {
    it("get returns null for missing key", async () => {
      const cache = createCache();
      const result = await cache.get("missing");
      expect(result).toBeNull();
    });

    it("set and get roundtrip", async () => {
      const cache = createCache();
      const entry = { data: [makeFriend("user1")], totalFollowing: 1, fetchedAt: new Date().toISOString() };
      await cache.set("key1", entry);
      const result = await cache.get("key1");
      expect(result).toEqual(entry);
    });
  });

  describe("RateGuard contract", () => {
    it("allows by default", () => {
      const guard = createRateGuard();
      expect(guard.allow()).toBe(true);
      expect(guard.isBudgetCritical()).toBe(false);
    });

    it("reports budget and can become critical", () => {
      const guard = createRateGuard();
      guard.reportBudget(rateLimitOk);
      expect(guard.allow()).toBe(true);
    });
  });

  describe("Clock contract", () => {
    it("returns a Date", () => {
      const clock = createClock();
      expect(clock.now()).toBeInstanceOf(Date);
    });
  });
}

class FakeGithub implements GithubGateway {
  async fetchFollowing() {
    return { user: { login: "test", following: { totalCount: 0, nodes: [] } }, rateLimit: rateLimitOk };
  }
  async fetchFriendDetails() {
    return { nodes: [], rateLimit: rateLimitOk };
  }
}

class FakeCache implements ResultCache {
  private store = new Map();
  async get(key: string) { return this.store.get(key) ?? null; }
  async set(key: string, value: any) { this.store.set(key, value); }
}

class FakeRateGuard implements RateGuard {
  private critical = false;
  allow() { return !this.critical; }
  reportBudget(rl: RateLimitInfo) { if (rl.remaining < rl.limit * 0.1) this.critical = true; }
  isBudgetCritical() { return this.critical; }
  getRetryAfter() { return null; }
}

class FakeClock implements Clock {
  now() { return new Date("2024-06-15T12:00:00Z"); }
}

runContractTests(
  () => new FakeGithub(),
  () => new FakeCache(),
  () => new FakeRateGuard(),
  () => new FakeClock()
);