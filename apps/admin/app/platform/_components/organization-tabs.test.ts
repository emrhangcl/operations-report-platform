import type { OrganizationStatus, SubscriptionStatus } from "@operations/types";
import { describe, expect, it } from "vitest";
import { countOrganizationTabs, matchesOrganizationTab, organizationTabs, type OrganizationTab } from "./organization-tabs";
import type { OrganizationRow } from "./platform-types";

function row(status: OrganizationStatus, subscription: SubscriptionStatus | null): OrganizationRow {
  return {
    id: `${status}-${subscription ?? "none"}`,
    name: "Firma",
    slug: "firma",
    status,
    billing_email: null,
    created_at: "2026-11-01T00:00:00Z",
    closed_at: null,
    subscription: subscription
      ? {
          status: subscription,
          billing_interval: "monthly",
          plan_id: null,
          current_period_starts_at: null,
          current_period_ends_at: null,
          grace_period_ends_at: null,
          is_current: true
        }
      : null
  };
}

function matchingTabs(organization: OrganizationRow): OrganizationTab[] {
  return organizationTabs.map((tab) => tab.id).filter((tab) => matchesOrganizationTab(organization, tab));
}

describe("organization tabs", () => {
  it("lists the five tabs in order", () => {
    expect(organizationTabs.map((tab) => tab.label)).toEqual(["Tümü", "Aktif", "Ek sürede", "Salt okunur", "Askıda"]);
  });

  it("puts a suspended organization only under suspended, even with an active subscription", () => {
    expect(matchingTabs(row("suspended", "active"))).toEqual(["all", "suspended"]);
  });

  it("counts a lifetime subscription on an active organization as active", () => {
    expect(matchingTabs(row("active", "lifetime"))).toEqual(["all", "active"]);
    expect(matchingTabs(row("active", "active"))).toEqual(["all", "active"]);
  });

  it("separates grace period and read only from active", () => {
    expect(matchingTabs(row("active", "grace_period"))).toEqual(["all", "grace"]);
    expect(matchingTabs(row("active", "read_only"))).toEqual(["all", "readOnly"]);
  });

  it("shows other states only under all", () => {
    for (const subscription of ["past_due", "pending", "canceled", null] as const) {
      expect(matchingTabs(row("active", subscription))).toEqual(["all"]);
    }
    expect(matchingTabs(row("closed", "active"))).toEqual(["all"]);
  });

  it("counts every tab over a mixed list", () => {
    const rows = [
      row("active", "active"),
      row("active", "lifetime"),
      row("active", "grace_period"),
      row("suspended", "active"),
      row("closed", null)
    ];
    expect(countOrganizationTabs(rows)).toEqual({ all: 5, active: 2, grace: 1, readOnly: 0, suspended: 1 });
    expect(countOrganizationTabs([])).toEqual({ all: 0, active: 0, grace: 0, readOnly: 0, suspended: 0 });
  });
});
