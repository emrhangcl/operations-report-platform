"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Car,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Gauge,
  GitBranch,
  ImageIcon,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Waves,
  Wrench,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AccountContextError,
  clearAccountContextCache,
  loadAccountContext,
  type AccountContextPayload
} from "../lib/account-context-client";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { ProductBrand } from "./logo";
import { OrganizationBrand } from "./organization-brand";

const links = [
  { href: "/app", label: "Panel", icon: Gauge },
  { href: "/assignments", label: "Montaj Atamaları", icon: ClipboardCheck },
  { href: "/reports", label: "Raporlar", icon: ClipboardList },
  { href: "/personnel", label: "Kullanıcılar", icon: Users },
  { href: "/companies", label: "Firmalar", icon: Building2 },
  { href: "/lines", label: "Hatlar", icon: GitBranch },
  { href: "/vehicles", label: "Araçlar", icon: Car },
  { href: "/belts", label: "Bantlar", icon: Waves },
  { href: "/equipment", label: "Ekipmanlar", icon: Wrench },
  { href: "/account/branding", label: "Firma Logosu", icon: ImageIcon },
  { href: "/account/billing", label: "Faturalandırma", icon: CreditCard }
];

function getCurrentPage(pathname: string) {
  return links.find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`)) ?? links[0]!;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [accessNotice, setAccessNotice] = useState("");
  const [accountContext, setAccountContext] = useState<AccountContextPayload | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentPage = getCurrentPage(pathname);

  useEffect(() => {
    let active = true;

    loadAccountContext("admin").then((context) => {
      if (!active) return;
      setAccountContext(context);
      if (context.role !== "ADMIN") {
        setMessage("Bu panele erişmek için aktif admin hesabı gerekir.");
      } else {
        setAccessNotice(
          context.accessMode === "read"
            ? "Aboneliğiniz salt okunur durumda. Yeni kayıt ve değişiklik işlemleri kapalıdır."
            : ""
        );
      }
      setReady(true);
    }).catch((error) => {
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

    return () => { active = false; };
  }, [router]);

  useEffect(() => setMenuOpen(false), [pathname]);

  async function signOut() {
    const supabase = getBrowserSupabase();
    clearAccountContextCache("admin");
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return <div className="auth-page">Yükleniyor...</div>;
  }

  if (message) {
    return (
      <main className="auth-page">
        <div className="login-panel">
          <div className="brand" style={{ marginBottom: 24 }}>
            <ProductBrand />
          </div>
          <div className="message error">{message}</div>
          <button className="button" onClick={signOut} style={{ marginTop: 16 }} type="button">
            Giriş sayfasına git
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <a className="admin-skip-link" href="#admin-main">İçeriğe geç</a>
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
        className="admin-mobile-menu"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        {menuOpen ? <X aria-hidden size={21} /> : <Menu aria-hidden size={21} />}
      </button>
      <aside className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="brand admin-sidebar-brand">
          <OrganizationBrand />
        </div>
        <div className="admin-workspace-card">
          <span aria-hidden><ShieldCheck size={17} /></span>
          <div>
            <strong>{accountContext?.organizationName ?? "Firma hesabı"}</strong>
            <small>{accountContext?.subscriptionStatus ?? "Admin çalışma alanı"}</small>
          </div>
        </div>
        <nav className="nav" aria-label="Ana menü">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={link.href} key={link.href}>
                <Icon aria-hidden size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={signOut}>
            <LogOut aria-hidden size={18} />
            <span>Çıkış</span>
          </button>
        </nav>
      </aside>
      {menuOpen ? (
        <button aria-label="Menüyü kapat" className="admin-sidebar-scrim" onClick={() => setMenuOpen(false)} type="button" />
      ) : null}
      <main className="content" id="admin-main">
        <header className="admin-topbar">
          <div>
            <span>Admin Paneli</span>
            <h1>{currentPage.label}</h1>
          </div>
          <div className="admin-account-context" aria-label="Hesap bağlamı">
            <strong>{accountContext?.organizationName ?? "Firma"}</strong>
            <span>{accountContext?.accessMode === "read" ? "Salt okunur" : "Tam erişim"}</span>
          </div>
        </header>
        <div className="admin-content-inner">
          {accessNotice ? <div className="message info">{accessNotice}</div> : null}
          {message ? <div className="message error">{message}</div> : null}
          {children}
        </div>
      </main>
    </div>
  );
}
