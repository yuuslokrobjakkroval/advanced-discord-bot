import assert from "node:assert/strict";
import test from "node:test";
import { RateLimiter } from "../dist/services/rate-limit.js";

test("rate limiter permits the configured burst then blocks", () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.check("user", 2, 1_000).allowed, true);
  assert.equal(limiter.check("user", 2, 1_000).allowed, true);
  const blocked = limiter.check("user", 2, 1_000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
});

test("rate limit buckets are isolated by key", () => {
  const limiter = new RateLimiter();
  assert.equal(limiter.check("one", 1, 1_000).allowed, true);
  assert.equal(limiter.check("one", 1, 1_000).allowed, false);
  assert.equal(limiter.check("two", 1, 1_000).allowed, true);
});
