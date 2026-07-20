interface Bucket {
  timestamps: number[];
  violations: number;
  blockedUntil: number;
  lastSeen: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { timestamps: [], violations: 0, blockedUntil: 0, lastSeen: now };
    bucket.lastSeen = now;
    if (bucket.blockedUntil > now) {
      this.buckets.set(key, bucket);
      return { allowed: false, retryAfterMs: bucket.blockedUntil - now };
    }
    bucket.timestamps = bucket.timestamps.filter((time) => now - time < windowMs);
    if (bucket.timestamps.length >= limit) {
      bucket.violations++;
      const retryAfterMs = Math.min(windowMs * Math.max(1, bucket.violations), 60_000);
      bucket.blockedUntil = now + retryAfterMs;
      this.buckets.set(key, bucket);
      return { allowed: false, retryAfterMs };
    }
    bucket.timestamps.push(now);
    if (bucket.violations && bucket.timestamps.length === 1) bucket.violations--;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.prune(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastSeen > 15 * 60_000) this.buckets.delete(key);
    }
  }
}

export const interactionLimiter = new RateLimiter();
