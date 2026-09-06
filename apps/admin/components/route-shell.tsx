"use client";

import { usePathname } from "next/navigation";
import { AdminShell } from "./admin-shell";

const adminRoutePrefixes = [
  "/app",
  "/assignments",
  "/reports",
  "/personnel",
  "/companies",
  "/lines",
  "/vehicles",
  "/belts",
  "/equipment",
  "/account/branding",
  "/account/billing"
];

function isAdminRoute(pathname: string) {
  return adminRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function RouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return isAdminRoute(pathname) ? <AdminShell>{children}</AdminShell> : children;
}
