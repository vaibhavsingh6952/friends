import { describe, it, expect, vi, beforeEach } from "vitest";
import { KPIsMetric } from "../lib/domain/metrics/kpis.js";
import { TopCommittersMetric } from "../lib/domain/metrics/leaderboard.js";
import { StreaksMetric } from "../lib/domain/metrics/streaks.js";
import { RecentCommitsMetric } from "../lib/domain/metrics/recentCommits.js";
import { LanguagesMetric, LanguageOfWeekMetric } from "../lib/domain/metrics/languages.js";
import { TopReposMetric } from "../lib/domain/metrics/topRepos.js";
import type { FriendData, MetricContext } from "../lib/domain/types.js";

function makeFriend(overrides: Partial<FriendData> = {}): FriendData {
  return {
    login: "user1",
    name: "User One",
    avatarUrl: "https://avatar.com/1.png",
    url: "https://github.com/user1",
    totalCommitContributions: 100,
    repositories: [],
    topRepositories: [],
    contributionCalendar: { weeks: [] },
    rateLimit: { limit: 5000, cost: 1, remaining: 4999, resetAt: new Date().toISOString() },
    ...overrides,
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

describe("KPIsMetric", () => {
  it("computes aggregates correctly", () => {
    const friends = [
      makeFriend({ login: "a", totalCommitContributions: 10, repositories: [{ name: "r1", url: "", stargazerCount: 0, pushedAt: new Date().toISOString(), primaryLanguage: { name: "TypeScript", color: "#3178c6" }, languages: [], defaultBranchRef: null }] }),
      makeFriend({ login: "b", totalCommitContributions: 20, repositories: [{ name: "r2", url: "", stargazerCount: 0, pushedAt: new Date().toISOString(), primaryLanguage: { name: "Go", color: "#00ADD8" }, languages: [], defaultBranchRef: null }] }),
    ];
    const result = KPIsMetric.compute(friends, makeContext());
    expect(result.commits30d).toBe(30);
    expect(result.languages).toBe(2);
    expect(result.friendsCount).toBe(2);
  });
});

describe("TopCommittersMetric", () => {
  it("ranks by commits desc then login asc", () => {
    const friends = [
      makeFriend({ login: "zebra", totalCommitContributions: 10 }),
      makeFriend({ login: "alpha", totalCommitContributions: 10 }),
      makeFriend({ login: "beta", totalCommitContributions: 5 }),
    ];
    const result = TopCommittersMetric.compute(friends, makeContext());
    expect(result.map((r) => r.login)).toEqual(["alpha", "zebra", "beta"]);
  });

  it("limits to 5", () => {
    const friends = Array.from({ length: 10 }, (_, i) => makeFriend({ login: `user${i}`, totalCommitContributions: 10 - i }));
    const result = TopCommittersMetric.compute(friends, makeContext());
    expect(result.length).toBe(5);
  });
});

describe("StreaksMetric", () => {
  it("computes streak for empty calendar", () => {
    const friend = makeFriend({ login: "empty", contributionCalendar: { weeks: [] } });
    const result = StreaksMetric.compute([friend], makeContext());
    expect(result[0].current).toBe(0);
    expect(result[0].best365).toBe(0);
    expect(result[0].last30).toHaveLength(30);
  });

  it("computes current streak ending today", () => {
    const weeks = [{ contributionDays: Array.from({ length: 7 }, (_, i) => ({ date: `2024-06-${String(9 + i).padStart(2, "0")}`, contributionCount: 1 })) }];
    const friend = makeFriend({ login: "streak", contributionCalendar: { weeks } });
    const result = StreaksMetric.compute([friend], makeContext());
    expect(result[0].current).toBe(7);
  });

  it("computes best365 correctly", () => {
    const days = Array.from({ length: 400 }, (_, i) => {
      const date = new Date("2023-06-15");
      date.setDate(date.getDate() + i);
      return { date: date.toISOString().split("T")[0], contributionCount: i % 10 === 0 ? 0 : 1 };
    });
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push({ contributionDays: days.slice(i, i + 7) });
    }
    const friend = makeFriend({ login: "best", contributionCalendar: { weeks } });
    const result = StreaksMetric.compute([friend], makeContext());
    expect(result[0].best365).toBeGreaterThan(0);
  });
});

describe("RecentCommitsMetric", () => {
  it("filters commits by author and sorts by date", () => {
    const commit1 = { oid: "1", messageHeadline: "msg1", committedDate: "2024-06-10T10:00:00Z", url: "u1", author: { user: { login: "user1" } } };
    const commit2 = { oid: "2", messageHeadline: "msg2", committedDate: "2024-06-12T10:00:00Z", url: "u2", author: { user: { login: "user1" } } };
    const commit3 = { oid: "3", messageHeadline: "msg3", committedDate: "2024-06-11T10:00:00Z", url: "u3", author: { user: { login: "other" } } };
    const repo = {
      name: "repo1",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date().toISOString(),
      primaryLanguage: null,
      languages: [],
      defaultBranchRef: { target: { nodes: [commit1, commit2, commit3] } },
    };
    const friend = makeFriend({ login: "user1", repositories: [repo] });
    const result = RecentCommitsMetric.compute([friend], makeContext());
    expect(result.length).toBe(2);
    expect(result[0].committedAt).toBe("2024-06-12T10:00:00Z");
    expect(result[1].committedAt).toBe("2024-06-10T10:00:00Z");
  });
});

describe("LanguagesMetric", () => {
  it("aggregates language bytes and computes share", () => {
    const langEdge = (name: string, size: number) => ({ size, node: { name, color: "#fff" } });
    const repo = {
      name: "r1",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date().toISOString(),
      primaryLanguage: { name: "TypeScript", color: "#3178c6" },
      languages: [langEdge("TypeScript", 1000), langEdge("JavaScript", 500)],
      defaultBranchRef: null,
    };
    const friend = makeFriend({ login: "user1", repositories: [repo] });
    const result = LanguagesMetric.compute([friend], makeContext());
    expect(result.find((r) => r.name === "TypeScript")?.bytes).toBe(1001);
    expect(result.find((r) => r.name === "JavaScript")?.bytes).toBe(500);
    const total = result.reduce((s, r) => s + r.bytes, 0);
    expect(result.find((r) => r.name === "TypeScript")?.share).toBeCloseTo(1001 / total);
  });

  it("adds Other when more than 8 languages", () => {
    const langs = Array.from({ length: 10 }, (_, i) => ({ name: `Lang${i}`, size: 100 }));
    const repo = {
      name: "r1",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date().toISOString(),
      primaryLanguage: null,
      languages: langs.map((l) => ({ size: l.size, node: { name: l.name, color: "#fff" } })),
      defaultBranchRef: null,
    };
    const friend = makeFriend({ login: "user1", repositories: [repo] });
    const result = LanguagesMetric.compute([friend], makeContext());
    expect(result.length).toBe(9);
    expect(result.find((r) => r.name === "Other")).toBeDefined();
  });
});

describe("LanguageOfWeekMetric", () => {
  it("returns language with most bytes in last 7 days", () => {
    const repo1 = {
      name: "r1",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      primaryLanguage: null,
      languages: [{ size: 1000, node: { name: "Rust", color: "#dea584" } }],
      defaultBranchRef: null,
    };
    const repo2 = {
      name: "r2",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      primaryLanguage: null,
      languages: [{ size: 5000, node: { name: "Go", color: "#00ADD8" } }],
      defaultBranchRef: null,
    };
    const friend = makeFriend({ login: "user1", repositories: [repo1, repo2] });
    const result = LanguageOfWeekMetric.compute([friend], makeContext());
    expect(result?.name).toBe("Rust");
  });

  it("returns null when no recent repos", () => {
    const repo = {
      name: "r1",
      url: "",
      stargazerCount: 0,
      pushedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      primaryLanguage: null,
      languages: [{ size: 1000, node: { name: "Go", color: "#00ADD8" } }],
      defaultBranchRef: null,
    };
    const friend = makeFriend({ login: "user1", repositories: [repo] });
    const result = LanguageOfWeekMetric.compute([friend], makeContext());
    expect(result).toBeNull();
  });
});

describe("TopReposMetric", () => {
  it("merges and sorts by stars", () => {
    const repo1 = { name: "repoA", url: "u1", stargazerCount: 100, primaryLanguage: { name: "Go", color: "#00ADD8" } };
    const repo2 = { name: "repoB", url: "u2", stargazerCount: 200, primaryLanguage: { name: "Rust", color: "#dea584" } };
    const friend1 = makeFriend({ login: "a", topRepositories: [repo1] });
    const friend2 = makeFriend({ login: "b", topRepositories: [repo2] });
    const result = TopReposMetric.compute([friend1, friend2], makeContext());
    expect(result[0].stars).toBe(200);
    expect(result[0].owner).toBe("b");
  });
});