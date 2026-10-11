import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRateGuard } from "../lib/adapters/memoryRateGuard.js";
import type { RateLimitInfo } from "../lib/ports.js";

describe("MemoryRateGuard", () => {
  let guard: MemoryRateGuard;

  beforeEach(() => {
    guard = new MemoryRateGuard();
  });

  it("allows by default", () => {
    expect(guard.allow()).toBe(true);
    expect(guard.isBudgetCritical()).toBe(false);
    expect(guard.getRetryAfter()).toBeNull();
  });

  it("becomes critical when remaining drops below 10%", () => {
    const rateLimit: RateLimitInfo = { limit: 5000, cost: 1, remaining: 499, resetAt: new Date(Date.now() + 3600000).toISOString() };
    guard.reportBudget(rateLimit);
    expect(guard.allow()).toBe(false);
    expect(guard.isBudgetCritical()).toBe(true);
    expect(guard.getRetryAfter()).toBeGreaterThan(0);
  });

  it("stays allowed when remaining above 10%", () => {
    const rateLimit: RateLimitInfo = { limit: 5000, cost: 1, remaining: 501, resetAt: new Date(Date.now() + 3600000).toISOString() };
    guard.reportBudget(rateLimit);
    expect(guard.allow()).toBe(true);
    expect(guard.isBudgetCritical()).toBe(false);
  });
});