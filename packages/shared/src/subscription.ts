import type {
  BillingInterval,
  OrganizationStatus,
  SubscriptionStatus
} from "@operations/types";

export type SubscriptionAccessMode = "write" | "read" | "blocked";

export interface SubscriptionAccessSnapshot {
  organizationStatus: OrganizationStatus;
  status: SubscriptionStatus | null;
  billingInterval: BillingInterval | null;
  currentPeriodEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  updatedAt?: string | null;
}

function isAfter(value: string | null | undefined, evaluatedAt: number) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > evaluatedAt;
}

function addGraceDays(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;
}

export function getSubscriptionAccessMode(
  snapshot: SubscriptionAccessSnapshot,
  evaluatedAt = new Date()
): SubscriptionAccessMode {
  if (snapshot.organizationStatus !== "active" || !snapshot.status) {
    return "blocked";
  }

  const now = evaluatedAt.getTime();

  if (snapshot.status === "lifetime") {
    return "write";
  }

  if (snapshot.status === "active" && (!snapshot.currentPeriodEndsAt || isAfter(snapshot.currentPeriodEndsAt, now))) {
    return "write";
  }

  const fallbackGraceEnd = addGraceDays(snapshot.currentPeriodEndsAt);

  if (
    snapshot.status === "active" &&
    isAfter(snapshot.gracePeriodEndsAt ?? fallbackGraceEnd, now)
  ) {
    return "write";
  }

  if (
    (snapshot.status === "past_due" || snapshot.status === "grace_period") &&
    isAfter(
      snapshot.gracePeriodEndsAt ??
        addGraceDays(snapshot.updatedAt),
      now
    )
  ) {
    return "write";
  }

  if (snapshot.status === "active" || snapshot.status === "past_due" || snapshot.status === "grace_period" || snapshot.status === "read_only") {
    return "read";
  }

  return "blocked";
}
