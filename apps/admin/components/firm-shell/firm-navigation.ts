import {
  IconBuilding,
  IconCar,
  IconChecklist,
  IconCreditCard,
  IconDashboard,
  IconGitBranch,
  IconPhoto,
  IconReport,
  IconTool,
  IconUsers,
  IconWaveSine,
  type Icon
} from "@tabler/icons-react";

export interface FirmNavigationItem {
  href: string;
  label: string;
  icon: Icon;
}

// shadcn dashboard-01 "navMain" karsiligi: gunluk operasyon ekranlari.
export const firmNavigation: FirmNavigationItem[] = [
  { href: "/app", label: "Panel", icon: IconDashboard },
  { href: "/assignments", label: "Montaj Atamaları", icon: IconChecklist },
  { href: "/reports", label: "Raporlar", icon: IconReport },
  { href: "/personnel", label: "Kullanıcılar", icon: IconUsers }
];

// shadcn dashboard-01 "documents" grubu karsiligi: tanim kayitlari.
export const firmRecordNavigation: FirmNavigationItem[] = [
  { href: "/companies", label: "Firmalar", icon: IconBuilding },
  { href: "/lines", label: "Hatlar", icon: IconGitBranch },
  { href: "/vehicles", label: "Araçlar", icon: IconCar },
  { href: "/belts", label: "Bantlar", icon: IconWaveSine },
  { href: "/equipment", label: "Ekipmanlar", icon: IconTool }
];

// shadcn dashboard-01 "navSecondary" karsiligi: hesap ayarlari.
export const firmAccountNavigation: FirmNavigationItem[] = [
  { href: "/account/branding", label: "Firma Logosu", icon: IconPhoto },
  { href: "/account/billing", label: "Faturalandırma", icon: IconCreditCard }
];

export function isFirmNavigationActive(item: FirmNavigationItem, pathname: string) {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function firmPageTitle(pathname: string) {
  return (
    [...firmNavigation, ...firmRecordNavigation, ...firmAccountNavigation].find((item) =>
      isFirmNavigationActive(item, pathname)
    )?.label ?? "Panel"
  );
}
