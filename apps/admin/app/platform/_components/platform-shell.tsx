"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { CloseMobileSidebarOnNavigate } from "@/components/shadcn/close-mobile-sidebar";
import { PortalContainerProvider } from "@/components/shadcn/portal-container";
import { SidebarInset, SidebarProvider } from "@/components/shadcn/sidebar";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { getBrowserClient } from "@/lib/browser-client";
import { ownerThemeBootScript, readOwnerTheme, writeOwnerTheme, type OwnerTheme } from "@/lib/owner-theme";
import { ownerPageTitle } from "./owner-navigation";
import { OwnerSidebar } from "./owner-sidebar";
import { OwnerSiteHeader } from "./owner-site-header";

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// v2 (shadcn) owner iskeleti. Kok eleman [data-ui="v2"] tasir; token'lar, Geist fontu ve
// koyu tema yalnizca bu kokun icinde gecerlidir. Portal'lar da bu koke cizilir.
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<OwnerTheme>("dark");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setTheme(readOwnerTheme(browserStorage()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getBrowserClient()?.auth.getUser().then(({ data }) => {
      if (!cancelled) setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: OwnerTheme = current === "dark" ? "light" : "dark";
      writeOwnerTheme(browserStorage(), next);
      return next;
    });
  }, []);

  async function signOut() {
    await getBrowserClient()?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div
      className={`${theme === "dark" ? "dark " : ""}min-h-svh bg-background text-foreground`}
      data-ui="v2"
      id="owner-root"
      ref={setRoot}
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: ownerThemeBootScript }} />
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        href="#owner-main"
      >
        İçeriğe geç
      </a>
      <PortalContainerProvider container={root}>
        <TooltipProvider delayDuration={0}>
          <SidebarProvider
            style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}
          >
            <CloseMobileSidebarOnNavigate />
            <OwnerSidebar email={email} onSignOut={signOut} variant="inset" />
            <SidebarInset>
              <OwnerSiteHeader onToggleTheme={toggleTheme} theme={theme} title={ownerPageTitle(pathname)} />
              <main className="flex flex-1 flex-col" id="owner-main">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </PortalContainerProvider>
    </div>
  );
}
