import { Building2, CreditCard, LayoutDashboard, PackageOpen, ScrollText, ShieldCheck, type LucideIcon } from "lucide-react";

export interface OwnerNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const ownerNavigation: OwnerNavigationItem[] = [
  { href: "/platform", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/platform/organizations", label: "Firmalar", icon: Building2 },
  { href: "/platform/plans", label: "Paketler ve Fiyatlar", icon: PackageOpen },
  { href: "/platform/payments", label: "Ödemeler", icon: CreditCard },
  { href: "/platform/logs", label: "Sistem Kayıtları", icon: ScrollText },
  { href: "/platform/system", label: "Sistem Durumu", icon: ShieldCheck }
];

export function isOwnerNavigationActive(item: OwnerNavigationItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ownerPageTitle(pathname: string) {
  return ownerNavigation.find((item) => isOwnerNavigationActive(item, pathname))?.label ?? "Platform";
}
