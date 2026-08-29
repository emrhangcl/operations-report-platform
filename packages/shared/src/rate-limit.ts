export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly entries = new Map<string, RateLimitEntry>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries = 5000
  ) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error("Rate limit must be a positive integer.");
    if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error("Rate limit window must be positive.");
  }

  check(key: string, now = Date.now()): RateLimitDecision {
    const normalizedKey = key.trim().slice(0, 200) || "unknown";
    const current = this.entries.get(normalizedKey);

    if (!current || current.resetAt <= now) {
      this.prune(now);
      if (this.entries.size >= this.maxEntries) this.evictOldest();
      this.entries.set(normalizedKey, { count: 1, resetAt: now + this.windowMs });
      return {
        allowed: true,
        limit: this.limit,
        remaining: this.limit - 1,
        retryAfterSeconds: Math.ceil(this.windowMs / 1000)
      };
    }

    current.count = Math.min(current.count + 1, this.limit + 1);
    const remaining = Math.max(this.limit - current.count, 0);
    return {
      allowed: current.count <= this.limit,
      limit: this.limit,
      remaining,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1)
    };
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) this.entries.delete(key);
    }
  }

  private evictOldest() {
    const oldest = this.entries.keys().next().value;
    if (oldest) this.entries.delete(oldest);
  }
}
