import type { RateGuard, RateLimitInfo } from "../ports.js";

export class MemoryRateGuard implements RateGuard {
  private critical = false;
  private retryAfter: number | null = null;

  allow(): boolean {
    return !this.critical;
  }

  reportBudget(rateLimit: RateLimitInfo): void {
    const threshold = Math.ceil(rateLimit.limit * 0.1);
    if (rateLimit.remaining < threshold) {
      this.critical = true;
      const resetTime = new Date(rateLimit.resetAt).getTime();
      this.retryAfter = Math.max(0, Math.ceil((resetTime - Date.now()) / 1000));
    }
  }

  isBudgetCritical(): boolean {
    return this.critical;
  }

  getRetryAfter(): number | null {
    return this.retryAfter;
  }
}