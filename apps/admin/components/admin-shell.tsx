"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Car, ClipboardList, Gauge, GitBranch, LogOut, Users, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { TuncaLogo } from "./logo";

const links = [
  { href: "/", label: "Panel", icon: Gauge },
  { href: "/reports", label: "Raporlar", icon: ClipboardList },
  { href: "/personnel", label: "Personel", icon: Users },
  { href: "/companies", label: "Firmalar", icon: Building2 },
  { href: "/lines", label: "Hatlar", icon: GitBranch },
  { href: "/vehicles", label: "Araçlar", icon: Car },
  { href: "/belts", label: "Bantlar", icon: Waves }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessage("Supabase bilgileri girilmedi. .env dosyasını doldurun.");
      setReady(true);
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile?.role !== "ADMIN" || profile.is_active !== true) {
        setMessage("Bu panele erişmek için aktif admin hesabı gerekir.");
        setReady(true);
        return;
      }

      setReady(true);
    });
  }, [router]);

  async function signOut() {
    const supabase = getBrowserSupabase();
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
            <TuncaLogo />
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
      <aside className="sidebar">
        <div className="brand">
          <TuncaLogo />
        </div>
        <nav className="nav" aria-label="Ana menü">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link className={active ? "active" : ""} href={link.href} key={link.href}>
                <Icon aria-hidden size={18} />
                {link.label}
              </Link>
            );
          })}
          <button type="button" onClick={signOut}>
            <LogOut aria-hidden size={18} />
            Çıkış
          </button>
        </nav>
      </aside>
      <main className="content">
        {message ? <div className="message error">{message}</div> : null}
        {children}
      </main>
    </div>
  );
}
