"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Car, ClipboardCheck, ClipboardList, CreditCard, Gauge, GitBranch, LogOut, Users, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { getSubscriptionAccessMode } from "@operations/shared";
import type { BillingInterval, OrganizationStatus, SubscriptionStatus } from "@operations/types";
import { getBrowserSupabase } from "../lib/supabase-browser";
import { ProductBrand } from "./logo";

const links = [
  { href: "/app", label: "Panel", icon: Gauge },
  { href: "/assignments", label: "Montaj Atamaları", icon: ClipboardCheck },
  { href: "/reports", label: "Raporlar", icon: ClipboardList },
  { href: "/personnel", label: "Kullanıcılar", icon: Users },
  { href: "/companies", label: "Firmalar", icon: Building2 },
  { href: "/lines", label: "Hatlar", icon: GitBranch },
  { href: "/vehicles", label: "Araçlar", icon: Car },
  { href: "/belts", label: "Bantlar", icon: Waves },
  { href: "/account/billing", label: "Faturalandırma", icon: CreditCard }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [accessNotice, setAccessNotice] = useState("");

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
        .select("organization_id,is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile?.organization_id || profile.is_active !== true) {
        setMessage("Bu panele erişmek için aktif admin hesabı gerekir.");
        setReady(true);
        return;
      }

      const [membershipResult, organizationResult] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role,is_active")
          .eq("organization_id", profile.organization_id)
          .eq("profile_id", data.user.id)
          .maybeSingle(),
        supabase
          .from("organizations")
          .select("status")
          .eq("id", profile.organization_id)
          .maybeSingle()
      ]);

      if (
        membershipResult.data?.is_active !== true ||
        !["OWNER", "ADMIN"].includes(membershipResult.data.role)
      ) {
        setMessage("Bu panele erişmek için aktif admin hesabı gerekir.");
        setReady(true);
        return;
      }

      if (organizationResult.data?.status !== "active") {
        router.replace("/subscription");
        return;
      }

      const subscriptionResult = await supabase
        .from("subscriptions")
        .select("status,billing_interval,current_period_ends_at,grace_period_ends_at,updated_at")
        .eq("organization_id", profile.organization_id)
        .eq("is_current", true)
        .maybeSingle();

      if (subscriptionResult.error) {
        setMessage("Abonelik durumu alınamadı.");
        setReady(true);
        return;
      }

      const accessMode = getSubscriptionAccessMode({
        organizationStatus: organizationResult.data.status as OrganizationStatus,
        status: (subscriptionResult.data?.status as SubscriptionStatus | undefined) ?? null,
        billingInterval: (subscriptionResult.data?.billing_interval as BillingInterval | undefined) ?? null,
        currentPeriodEndsAt: subscriptionResult.data?.current_period_ends_at ?? null,
        gracePeriodEndsAt: subscriptionResult.data?.grace_period_ends_at ?? null,
        updatedAt: subscriptionResult.data?.updated_at ?? null
      });

      if (accessMode === "blocked") {
        router.replace("/subscription");
        return;
      }

      setAccessNotice(
        accessMode === "read"
          ? "Aboneliğiniz salt okunur durumda. Yeni kayıt ve değişiklik işlemleri kapalıdır."
          : ""
      );

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
      <aside className="sidebar">
        <div className="brand">
          <ProductBrand />
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
        {accessNotice ? <div className="message info">{accessNotice}</div> : null}
        {message ? <div className="message error">{message}</div> : null}
        {children}
      </main>
    </div>
  );
}
