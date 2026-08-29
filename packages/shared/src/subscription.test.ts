import { describe, expect, it } from "vitest";
import { getSubscriptionAccessMode } from "./subscription";

const now = new Date("2026-08-29T12:00:00.000Z");

function snapshot(status: "pending" | "active" | "past_due" | "grace_period" | "read_only" | "canceled" | "lifetime", overrides: Record<string, unknown> = {}) {
  return {
    organizationStatus: "active" as const,
    status,
    billingInterval: status === "lifetime" ? "lifetime" as const : "monthly" as const,
    currentPeriodEndsAt: null,
    gracePeriodEndsAt: null,
    ...overrides
  };
}

describe("subscription access", () => {
  it("allows active and lifetime tenants to write", () => {
    expect(getSubscriptionAccessMode(snapshot("active", { currentPeriodEndsAt: "2026-09-01T12:00:00.000Z" }), now)).toBe("write");
    expect(getSubscriptionAccessMode(snapshot("lifetime"), now)).toBe("write");
  });

  it("keeps a valid grace period writable and an expired one read-only", () => {
    expect(getSubscriptionAccessMode(snapshot("grace_period", { gracePeriodEndsAt: "2026-08-30T12:00:00.000Z" }), now)).toBe("write");
    expect(getSubscriptionAccessMode(snapshot("grace_period", { gracePeriodEndsAt: "2026-08-28T12:00:00.000Z" }), now)).toBe("read");
  });

  it("blocks pending, canceled, suspended, and closed access", () => {
    expect(getSubscriptionAccessMode(snapshot("pending"), now)).toBe("blocked");
    expect(getSubscriptionAccessMode(snapshot("canceled"), now)).toBe("blocked");
    expect(getSubscriptionAccessMode({ ...snapshot("lifetime"), organizationStatus: "suspended" }, now)).toBe("blocked");
    expect(getSubscriptionAccessMode({ ...snapshot("lifetime"), organizationStatus: "closed" }, now)).toBe("blocked");
  });
});
