"use client";

import {
  IconCirclePlusFilled,
  IconDots,
  IconDotsVertical,
  IconExternalLink,
  IconFolder,
  IconInnerShadowTop,
  IconLogout,
  IconReport
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type * as React from "react";
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/shadcn/sidebar";
import {
  firmAccountNavigation,
  firmNavigation,
  firmRecordNavigation,
  isFirmNavigationActive
} from "./firm-navigation";

function initials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (letters || "FP").toLocaleUpperCase("tr-TR");
}

// shadcn dashboard-01 "NavMain": Quick Create satiri + ana menu.
function NavMain({ pathname }: { pathname: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild
              className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
              tooltip="Montaj ata"
            >
              <Link href="/assignments">
                <IconCirclePlusFilled />
                <span>Montaj ata</span>
              </Link>
            </SidebarMenuButton>
            <Button asChild className="size-8 group-data-[collapsible=icon]:opacity-0" size="icon" variant="outline">
              <Link href="/reports">
                <IconReport />
                <span className="sr-only">Raporlar</span>
              </Link>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {firmNavigation.map((item) => {
            const active = isFirmNavigationActive(item, pathname);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link aria-current={active ? "page" : undefined} href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// shadcn dashboard-01 "NavDocuments": etiketli grup, satirda hover ile acilan menu.
function NavRecords({ pathname }: { pathname: string }) {
  const { isMobile } = useSidebar();
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Kayıtlar</SidebarGroupLabel>
      <SidebarMenu>
        {firmRecordNavigation.map((item) => {
          const active = isFirmNavigationActive(item, pathname);
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={active}>
                <Link aria-current={active ? "page" : undefined} href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction className="rounded-sm data-[state=open]:bg-accent" showOnHover>
                    <IconDots />
                    <span className="sr-only">Diğer</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isMobile ? "end" : "start"} className="w-40 rounded-lg" side={isMobile ? "bottom" : "right"}>
                  <DropdownMenuItem asChild>
                    <Link href={item.href}>
                      <IconFolder />
                      <span>Aç</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={item.href} rel="noopener" target="_blank">
                      <IconExternalLink />
                      <span>Yeni sekmede aç</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

// shadcn dashboard-01 "NavSecondary".
function NavSecondary({ pathname, ...props }: { pathname: string } & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {firmAccountNavigation.map((item) => {
            const active = isFirmNavigationActive(item, pathname);
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link aria-current={active ? "page" : undefined} href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
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
function NavUser({ name, detail, onSignOut }: { name: string; detail: string; onSignOut: () => void }) {
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
              Çıkış yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// shadcn dashboard-01 "AppSidebar" birebir yapisi.
export function FirmSidebar({
  organizationName,
  accessLabel,
  onSignOut,
  ...props
}: { organizationName: string; accessLabel: string; onSignOut: () => void } & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/app">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Operasyon Portalı</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain pathname={pathname} />
        <NavRecords pathname={pathname} />
        <NavSecondary className="mt-auto" pathname={pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser detail={accessLabel} name={organizationName} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
