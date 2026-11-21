"use client";

import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { SidebarTrigger } from "@/components/shadcn/sidebar";
import type { OwnerTheme } from "@/lib/owner-theme";

// shadcn dashboard-01 "SiteHeader" birebir; sagdaki "GitHub" dugmesinin yerinde tema dugmesi.
export function OwnerSiteHeader({ title, theme, onToggleTheme }: { title: string; theme: OwnerTheme; onToggleTheme: () => void }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button className="dark:text-foreground" onClick={onToggleTheme} size="sm" variant="ghost">
            {theme === "dark" ? "Açık tema" : "Koyu tema"}
          </Button>
        </div>
      </div>
    </header>
  );
}
