"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { IconInnerShadowTop } from "@tabler/icons-react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { CloseMobileSidebarOnNavigate } from "@/components/shadcn/close-mobile-sidebar";
import { PortalContainerProvider } from "@/components/shadcn/portal-container";
import { Separator } from "@/components/shadcn/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/shadcn/sidebar";
import { Skeleton } from "@/components/shadcn/skeleton";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import {
  AccountContextError,
  clearAccountContextCache,
  loadAccountContext,
  type AccountContextPayload
} from "@/lib/account-context-client";
import { getBrowserClient } from "@/lib/browser-client";
import { ownerThemeBootScript, readOwnerTheme, writeOwnerTheme, type OwnerTheme } from "@/lib/owner-theme";
import { firmPageTitle } from "./firm-navigation";
import { FirmSidebar } from "./firm-sidebar";

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// shadcn dashboard-01 "SiteHeader" birebir; sagdaki "GitHub" dugmesinin yerinde tema dugmesi.
function FirmSiteHeader({ title, theme, onToggleTheme }: { title: string; theme: OwnerTheme; onToggleTheme: () => void }) {
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

// Firma (admin) paneli v2 iskeleti: owner panelindeki shadcn dashboard-01 yapisinin aynisi.
// Erisim kurallari eski AdminShell ile ayni: oturum yoksa /login, abonelik/uyelik yoksa
// /subscription, ADMIN olmayan kullaniciya hata gosterilir.
export function FirmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<OwnerTheme>("dark");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [accountContext, setAccountContext] = useState<AccountContextPayload | null>(null);

  useEffect(() => {
    setTheme(readOwnerTheme(browserStorage()));
  }, []);

  useEffect(() => {
    let active = true;
    loadAccountContext("admin")
      .then((context) => {
        if (!active) return;
        setAccountContext(context);
        if (context.role !== "ADMIN") setMessage("Bu panele erişmek için aktif admin hesabı gerekir.");
        setReady(true);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof AccountContextError && error.status === 401) {
          router.replace("/login");
          return;
        }
        if (
          error instanceof AccountContextError &&
          error.status === 403 &&
          (error.message.includes("abonelik") || error.message.includes("organizasyon üyeliği"))
        ) {
          router.replace("/subscription");
          return;
        }
        setMessage(error instanceof Error ? error.message : "Hesap erişimi doğrulanamadı.");
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: OwnerTheme = current === "dark" ? "light" : "dark";
      writeOwnerTheme(browserStorage(), next);
      return next;
    });
  }, []);

  async function signOut() {
    clearAccountContextCache("admin");
    await getBrowserClient()?.auth.signOut();
    router.replace("/login");
  }

  const readOnly = accountContext?.accessMode === "read";

  let body: React.ReactNode;
  if (!ready) {
    body = (
      <div aria-busy="true" aria-label="Panel yükleniyor" className="flex min-h-svh gap-4 p-4" role="status">
        <Skeleton className="hidden w-64 rounded-xl md:block" />
        <Skeleton className="flex-1 rounded-xl" />
      </div>
    );
  } else if (message) {
    body = (
      <main className="flex min-h-svh items-center justify-center p-6">
        <div className="grid w-full max-w-sm gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <IconInnerShadowTop className="size-5" />
            Operasyon Portalı
          </div>
          <Alert tone="error">{message}</Alert>
          <Button onClick={signOut}>Giriş sayfasına git</Button>
        </div>
      </main>
    );
  } else {
    body = (
      <SidebarProvider
        style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}
      >
        <CloseMobileSidebarOnNavigate />
        <FirmSidebar
          accessLabel={readOnly ? "Salt okunur" : "Tam erişim"}
          onSignOut={signOut}
          organizationName={accountContext?.organizationName ?? "Firma hesabı"}
          variant="inset"
        />
        <SidebarInset>
          <FirmSiteHeader onToggleTheme={toggleTheme} theme={theme} title={firmPageTitle(pathname)} />
          <main className="flex flex-1 flex-col" id="firm-main">
            {readOnly ? (
              <div className="px-4 pt-4 lg:px-6">
                <Alert tone="warning">Aboneliğiniz salt okunur durumda. Yeni kayıt ve değişiklik işlemleri kapalıdır.</Alert>
              </div>
            ) : null}
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
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
        href="#firm-main"
      >
        İçeriğe geç
      </a>
      <PortalContainerProvider container={root}>
        <TooltipProvider delayDuration={0}>{body}</TooltipProvider>
      </PortalContainerProvider>
    </div>
  );
}
