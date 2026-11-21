import {
  IconBuilding,
  IconCreditCard,
  IconDashboard,
  IconDatabase,
  IconPackage,
  IconReport,
  type Icon
} from "@tabler/icons-react";

export interface OwnerNavigationItem {
  href: string;
  label: string;
  icon: Icon;
  exact?: boolean;
}

// shadcn dashboard-01 "navMain" karsiligi.
export const ownerNavigation: OwnerNavigationItem[] = [
  { href: "/platform", label: "Genel Bakış", icon: IconDashboard, exact: true },
  { href: "/platform/organizations", label: "Firmalar", icon: IconBuilding },
  { href: "/platform/plans", label: "Paketler ve Fiyatlar", icon: IconPackage },
  { href: "/platform/payments", label: "Ödemeler", icon: IconCreditCard }
];

// shadcn dashboard-01 "documents" grubu karsiligi.
export const ownerSystemNavigation: OwnerNavigationItem[] = [
  { href: "/platform/logs", label: "Sistem Kayıtları", icon: IconReport },
  { href: "/platform/system", label: "Sistem Durumu", icon: IconDatabase }
];

export function isOwnerNavigationActive(item: OwnerNavigationItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ownerPageTitle(pathname: string) {
  return (
    [...ownerNavigation, ...ownerSystemNavigation].find((item) => isOwnerNavigationActive(item, pathname))?.label ?? "Platform"
  );
}
