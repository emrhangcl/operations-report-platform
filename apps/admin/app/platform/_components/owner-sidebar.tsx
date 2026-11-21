"use client";

import {
  IconBell,
  IconBuildingStore,
  IconCirclePlusFilled,
  IconDots,
  IconDotsVertical,
  IconExternalLink,
  IconFolder,
  IconInnerShadowTop,
  IconLogout,
  IconWorld
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
import { isOwnerNavigationActive, ownerNavigation, ownerSystemNavigation } from "./owner-navigation";

function initials(email: string | null) {
  return email ? email.slice(0, 2).toUpperCase() : "PS";
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
              tooltip="Yeni paket"
            >
              <Link href="/platform/plans">
                <IconCirclePlusFilled />
                <span>Yeni paket</span>
              </Link>
            </SidebarMenuButton>
            <Button asChild className="size-8 group-data-[collapsible=icon]:opacity-0" size="icon" variant="outline">
              <Link href="/platform/payments">
                <IconBell />
                <span className="sr-only">Ödeme olayları</span>
              </Link>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {ownerNavigation.map((item) => {
            const active = isOwnerNavigationActive(item, pathname);
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
function NavSystem({ pathname }: { pathname: string }) {
  const { isMobile } = useSidebar();
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Sistem</SidebarGroupLabel>
      <SidebarMenu>
        {ownerSystemNavigation.map((item) => {
          const active = isOwnerNavigationActive(item, pathname);
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

const secondaryItems = [
  { href: "/app", label: "Firma paneline git", icon: IconBuildingStore },
  { href: "/", label: "Web sitesi", icon: IconWorld }
];

// shadcn dashboard-01 "NavSecondary".
function NavSecondary(props: React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {secondaryItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// shadcn dashboard-01 "NavUser".
function NavUser({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const { isMobile } = useSidebar();
  const name = "Platform sahibi";
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
                <AvatarFallback className="rounded-lg">{initials(email)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email ?? ""}</span>
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
                  <AvatarFallback className="rounded-lg">{initials(email)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{email ?? ""}</span>
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
export function OwnerSidebar({
  email,
  onSignOut,
  ...props
}: { email: string | null; onSignOut: () => void } & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
              <Link href="/platform">
                <IconInnerShadowTop className="size-5!" />
                <span className="text-base font-semibold">Operasyon Portalı</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain pathname={pathname} />
        <NavSystem pathname={pathname} />
        <NavSecondary className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser email={email} onSignOut={onSignOut} />
      </SidebarFooter>
    </Sidebar>
  );
}
