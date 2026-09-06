"use client";

import {
  Building2,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageOpen,
  ScrollText,
  ShieldCheck,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProductBrand } from "../../../components/logo";
import { getBrowserSupabase } from "../../../lib/supabase-browser";

const navigation = [
  { href: "/platform", label: "Genel Bakış", icon: LayoutDashboard, exact: true },
  { href: "/platform/organizations", label: "Firmalar", icon: Building2 },
  { href: "/platform/plans", label: "Paketler ve Fiyatlar", icon: PackageOpen },
  { href: "/platform/payments", label: "Ödemeler", icon: CreditCard },
  { href: "/platform/logs", label: "Sistem Kayıtları", icon: ScrollText },
  { href: "/platform/system", label: "Sistem Durumu", icon: ShieldCheck }
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  async function signOut() {
    await getBrowserSupabase()?.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="owner-shell enterprise-owner-shell">
      <a className="owner-skip-link" href="#owner-main">İçeriğe geç</a>
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
        className="owner-mobile-menu"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        {menuOpen ? <X aria-hidden size={21} /> : <Menu aria-hidden size={21} />}
      </button>
      <aside className={menuOpen ? "owner-sidebar enterprise-sidebar open" : "owner-sidebar enterprise-sidebar"}>
        <Link className="owner-brand" href="/platform"><ProductBrand /></Link>
        <div className="owner-workspace-label"><span>O</span><div><strong>Owner Workspace</strong><small>Platform yönetimi</small></div></div>
        <nav aria-label="Owner paneli" className="owner-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={item.href} key={item.href}>
                <Icon aria-hidden size={19} /><span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="owner-sidebar-footer">
          <Link href="/app"><ExternalLink aria-hidden size={18} /><span>Firma paneline git</span></Link>
          <button onClick={signOut} type="button"><LogOut aria-hidden size={18} /><span>Çıkış yap</span></button>
        </div>
      </aside>
      {menuOpen ? <button aria-label="Menüyü kapat" className="owner-sidebar-scrim" onClick={() => setMenuOpen(false)} type="button" /> : null}
      <main className="owner-main" id="owner-main">{children}</main>
    </div>
  );
}
