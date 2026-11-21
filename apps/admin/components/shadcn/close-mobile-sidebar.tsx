"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSidebar } from "@/components/shadcn/sidebar";

// Kabuk istemci gezintisinde yeniden baglanmadigi icin mobil menu (Sheet) rota degisince kapatilir.
export function CloseMobileSidebarOnNavigate() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);
  return null;
}
