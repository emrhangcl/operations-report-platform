import type { OrganizationRow } from "./platform-types";

export type OrganizationTab = "all" | "active" | "grace" | "readOnly" | "suspended";

export const organizationTabs: Array<{ id: OrganizationTab; label: string }> = [
  { id: "all", label: "Tümü" },
  { id: "active", label: "Aktif" },
  { id: "grace", label: "Ek sürede" },
  { id: "readOnly", label: "Salt okunur" },
  { id: "suspended", label: "Askıda" }
];

// Askiya alinmis firma, abonelik durumundan bagimsiz olarak yalnizca "Askıda"da gorunur.
// Abonelik sekmeleri yalnizca firma aktifken gecerlidir; geri kalan durumlar yalnizca "Tümü"de.
export function matchesOrganizationTab(row: OrganizationRow, tab: OrganizationTab): boolean {
  if (tab === "all") return true;
  if (tab === "suspended") return row.status === "suspended";
  if (row.status !== "active") return false;
  const subscription = row.subscription?.status;
  if (tab === "active") return subscription === "active" || subscription === "lifetime";
  if (tab === "grace") return subscription === "grace_period";
  return subscription === "read_only";
}

export function countOrganizationTabs(rows: OrganizationRow[]): Record<OrganizationTab, number> {
  const counts: Record<OrganizationTab, number> = { all: 0, active: 0, grace: 0, readOnly: 0, suspended: 0 };
  for (const row of rows) {
    for (const tab of organizationTabs) {
      if (matchesOrganizationTab(row, tab.id)) counts[tab.id] += 1;
    }
  }
  return counts;
}
