"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "../lib/supabase-browser";

type Subscription = {
  status: "pending" | "active" | "past_due" | "grace_period" | "read_only" | "canceled" | "lifetime";
  billing_interval: "monthly" | "yearly" | "lifetime";
  current_period_ends_at: string | null;
  grace_period_ends_at: string | null;
  plans: { name: string } | Array<{ name: string }> | null;
};

const labels: Record<Subscription["status"], string> = {
  pending: "Ödeme bekleniyor",
  active: "Aktif",
  past_due: "Ödeme gecikmiş",
  grace_period: "Ek süre",
  read_only: "Salt okunur",
  canceled: "İptal edildi",
  lifetime: "Süresiz kullanım"
};

export function SubscriptionStatus() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setMessage("Abonelik hizmeti yapılandırılmamış.");
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile?.organization_id) {
        setMessage("Organizasyon üyeliği bulunamadı.");
        setLoading(false);
        return;
      }

      const [organizationResult, subscriptionResult] = await Promise.all([
        supabase.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status,billing_interval,current_period_ends_at,grace_period_ends_at,plans(name)")
          .eq("organization_id", profile.organization_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (organizationResult.error || subscriptionResult.error) {
        setMessage("Abonelik bilgisi alınamadı.");
      } else {
        setOrganizationName(organizationResult.data?.name ?? "");
        setSubscription(subscriptionResult.data as Subscription | null);
      }
      setLoading(false);
    }

    load().catch(() => {
      setMessage("Abonelik bilgisi alınamadı.");
      setLoading(false);
    });
  }, [router]);

  if (loading) return <div className="public-empty">Abonelik bilgisi yükleniyor...</div>;
  if (message) return <div className="message error">{message}</div>;
  if (!subscription) return <div className="public-empty"><strong>Abonelik kaydı bulunmuyor.</strong><Link className="button" href="/pricing">Paketleri Gör</Link></div>;

  const plan = Array.isArray(subscription.plans) ? subscription.plans[0]?.name : subscription.plans?.name;
  const canOpenApp = subscription.status === "active" || subscription.status === "lifetime";

  return (
    <div className="subscription-summary">
      <div className="subscription-status-line">
        <span>Durum</span>
        <strong className={`subscription-state state-${subscription.status}`}>{labels[subscription.status]}</strong>
      </div>
      <dl>
        <div><dt>Organizasyon</dt><dd>{organizationName || "-"}</dd></div>
        <div><dt>Paket</dt><dd>{plan || "Paket seçilmedi"}</dd></div>
        <div><dt>Dönem</dt><dd>{subscription.billing_interval === "monthly" ? "Aylık" : subscription.billing_interval === "yearly" ? "Yıllık" : "Süresiz"}</dd></div>
        <div><dt>Dönem sonu</dt><dd>{subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString("tr-TR") : "-"}</dd></div>
      </dl>
      <div className="actions">
        {canOpenApp ? <Link className="button" href="/app">Uygulamaya Git</Link> : null}
        {subscription.status === "pending" || subscription.status === "past_due" ? <Link className="button" href="/checkout">Ödemeye Devam Et</Link> : null}
        <Link className="button secondary" href="/account/billing">Faturalandırma Detayı</Link>
      </div>
    </div>
  );
}
