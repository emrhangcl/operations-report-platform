"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
  IconChecklist,
  IconCirclePlusFilled,
  IconDashboard,
  IconDotsVertical,
  IconFileText,
  IconLogout,
  IconReport,
  type Icon
} from "@tabler/icons-react";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/shadcn/dropdown-menu";
import { PortalContainerProvider } from "@/components/shadcn/portal-container";
import { Separator } from "@/components/shadcn/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar
} from "@/components/shadcn/sidebar";
import { TooltipProvider } from "@/components/shadcn/tooltip";
import { OrganizationBrand } from "@/components/organization-brand";
import { ownerThemeBootScript, readOwnerTheme, writeOwnerTheme, type OwnerTheme } from "@/lib/owner-theme";
import type { Screen } from "./report-utils";

export type PersonnelNavScreen = Extract<Screen, "home" | "assignments" | "drafts" | "submitted">;

const personnelNavigation: Array<{ screen: PersonnelNavScreen; label: string; icon: Icon }> = [
  { screen: "home", label: "Ana sayfa", icon: IconDashboard },
  { screen: "assignments", label: "Montajlarım", icon: IconChecklist },
  { screen: "drafts", label: "Taslaklarım", icon: IconFileText },
  { screen: "submitted", label: "Gönderdiğim Raporlar", icon: IconReport }
];

function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (letters || "P").toLocaleUpperCase("tr-TR");
}

// FirmShell ile ayni kok: data-ui="v2", #owner-root, tema on-yukleme betigi ve portal kabi.
// Giris disindaki tum personel ekranlari (erisim hatasi dahil) bu kokun icinde cizilir.
export function PersonnelRoot({
  children,
  render
}: {
  children?: React.ReactNode;
  render?: (themeControls: { theme: OwnerTheme; toggleTheme: () => void }) => React.ReactNode;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [theme, setTheme] = useState<OwnerTheme>("dark");

  useEffect(() => {
    setTheme(readOwnerTheme(browserStorage()));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: OwnerTheme = current === "dark" ? "light" : "dark";
      writeOwnerTheme(browserStorage(), next);
      return next;
    });
  }, []);

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
        href="#personnel-main"
      >
        İçeriğe geç
      </a>
      <PortalContainerProvider container={root}>
        <TooltipProvider delayDuration={0}>{render ? render({ theme, toggleTheme }) : children}</TooltipProvider>
      </PortalContainerProvider>
    </div>
  );
}

// shadcn dashboard-01 "SiteHeader" (FirmSiteHeader ile ayni).
function PersonnelSiteHeader({ title, theme, onToggleTheme }: { title: string; theme: OwnerTheme; onToggleTheme: () => void }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator className="mx-2 data-[orientation=vertical]:h-4" orientation="vertical" />
        <h1 className="truncate text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button className="dark:text-foreground" onClick={onToggleTheme} size="sm" variant="ghost">
            {theme === "dark" ? "Açık tema" : "Koyu tema"}
          </Button>
        </div>
      </div>
    </header>
  );
}

// shadcn dashboard-01 "NavMain": Quick Create satiri (Yeni Rapor) + ekranlar.
function PersonnelNavMain({
  activeScreen,
  newReportDisabled,
  onNavigate,
  onNewReport
}: {
  activeScreen: PersonnelNavScreen | null;
  newReportDisabled: boolean;
  onNavigate: (screen: PersonnelNavScreen) => void;
  onNewReport: () => void;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              disabled={newReportDisabled}
              onClick={() => {
                setOpenMobile(false);
                onNewReport();
              }}
              tooltip="Yeni Rapor"
            >
              <IconCirclePlusFilled />
              <span>Yeni Rapor</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {personnelNavigation.map((item) => {
            const active = activeScreen === item.screen;
            return (
              <SidebarMenuItem key={item.screen}>
                <SidebarMenuButton
                  aria-current={active ? "page" : undefined}
                  isActive={active}
                  onClick={() => {
                    setOpenMobile(false);
                    onNavigate(item.screen);
                  }}
                  tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// shadcn dashboard-01 "NavUser".
function PersonnelNavUser({ name, detail, onSignOut }: { name: string; detail: string; onSignOut: () => void }) {
  const { isMobile } = useSidebar();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <Avatar className="h-8 w-8 rounded-lg grayscale">
                <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{detail}</span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{detail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}>
              <IconLogout />
              Çıkış
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// shadcn dashboard-01 "AppSidebar" yapisi (FirmSidebar ile ayni); menu ogeleri personel ekranlari.
function PersonnelSidebar({
  activeScreen,
  newReportDisabled,
  onNavigate,
  onNewReport,
  onSignOut,
  userDetail,
  userName,
  ...props
}: {
  activeScreen: PersonnelNavScreen | null;
  newReportDisabled: boolean;
  onNavigate: (screen: PersonnelNavScreen) => void;
  onNewReport: () => void;
  onSignOut: () => void;
  userDetail: string;
  userName: string;
} & React.ComponentProps<typeof Sidebar>) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              onClick={() => {
                setOpenMobile(false);
                onNavigate("home");
              }}
            >
              <OrganizationBrand scope="personnel" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <PersonnelNavMain
          activeScreen={activeScreen}
          newReportDisabled={newReportDisabled}
          onNavigate={onNavigate}
          onNewReport={onNewReport}
        />
      </SidebarContent>
      <SidebarFooter>
        <PersonnelNavUser detail={userDetail} name={userName} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

// Personel paneli iskeleti: FirmShell'deki shadcn dashboard-01 yapisinin aynisi.
export function PersonnelShell({
  activeScreen,
  children,
  newReportDisabled,
  onNavigate,
  onNewReport,
  onSignOut,
  theme,
  title,
  toggleTheme,
  userDetail,
  userName
}: {
  activeScreen: PersonnelNavScreen | null;
  children: React.ReactNode;
  newReportDisabled: boolean;
  onNavigate: (screen: PersonnelNavScreen) => void;
  onNewReport: () => void;
  onSignOut: () => void;
  theme: OwnerTheme;
  title: string;
  toggleTheme: () => void;
  userDetail: string;
  userName: string;
}) {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}
    >
      <PersonnelSidebar
        activeScreen={activeScreen}
        newReportDisabled={newReportDisabled}
        onNavigate={onNavigate}
        onNewReport={onNewReport}
        onSignOut={onSignOut}
        userDetail={userDetail}
        userName={userName}
        variant="inset"
      />
      <SidebarInset>
        <PersonnelSiteHeader onToggleTheme={toggleTheme} theme={theme} title={title} />
        <main className="flex flex-1 flex-col" id="personnel-main">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
