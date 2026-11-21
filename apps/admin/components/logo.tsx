import { IconInnerShadowTop } from "@tabler/icons-react";

// shadcn dashboard-01 AppSidebar basligindaki isaret (FirmSidebar ve AuthShell ile ayni).
// Parcalar dogrudan ebeveynin cocugu olur; SidebarMenuButton veya flex kap icinde kullanilir.
export function ProductBrand() {
  return (
    <>
      <IconInnerShadowTop aria-hidden className="size-5!" />
      <span className="text-base font-semibold">Operasyon Portalı</span>
    </>
  );
}
