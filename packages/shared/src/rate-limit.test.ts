import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "./rate-limit";

describe("FixedWindowRateLimiter", () => {
  it("limits repeated keys until the window resets", () => {
    const limiter = new FixedWindowRateLimiter(2, 10_000);

    expect(limiter.check("client", 1_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("client", 1_001)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check("client", 1_002)).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.check("client", 11_001)).toMatchObject({ allowed: true, remaining: 1 });
  });

  it("keeps separate clients independent", () => {
    const limiter = new FixedWindowRateLimiter(1, 10_000);

    expect(limiter.check("one", 1_000).allowed).toBe(true);
    expect(limiter.check("one", 1_001).allowed).toBe(false);
    expect(limiter.check("two", 1_001).allowed).toBe(true);
  });
});
