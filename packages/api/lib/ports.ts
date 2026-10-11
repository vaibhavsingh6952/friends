import type { FriendData, RateLimitInfo } from "./domain/types.js";

export interface GithubGateway {
  fetchFollowing(login: string, limit: number): Promise<{
    user: { login: string; following: { totalCount: number; nodes: { id: string; login: string }[] } } | null;
    rateLimit: RateLimitInfo;
  }>;
  fetchFriendDetails(ids: string[], since: string): Promise<{
    nodes: (FriendData | null)[];
    rateLimit: RateLimitInfo;
  }>;
}

export interface ResultCache {
  get(key: string): Promise<{ data: FriendData[]; totalFollowing: number; fetchedAt: string } | null>;
  set(key: string, value: { data: FriendData[]; totalFollowing: number; fetchedAt: string }): Promise<void>;
}

export interface RateGuard {
  allow(): boolean;
  reportBudget(rateLimit: RateLimitInfo): void;
  isBudgetCritical(): boolean;
  getRetryAfter(): number | null;
}

export interface Clock {
  now(): Date;
}