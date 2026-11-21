"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/browser-client";
import { Alert, EmptyState, LoadingState } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";

type Subscription = {
  status: "pending" | "active" | "past_due" | "grace_period" | "read_only" | "canceled" | "lifetime";
  billing_interval: "monthly" | "yearly" | "lifetime";
  current_period_ends_at: string | null;
  grace_period_ends_at: string | null;
  updated_at: string;
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
      const db = getBrowserClient();
      if (!db) {
        setMessage("Abonelik hizmeti yapılandırılmamış.");
        setLoading(false);
        return;
      }

      const { data: userData } = await db.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await db
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
        db.from("organizations").select("name").eq("id", profile.organization_id).maybeSingle(),
        db
          .from("subscriptions")
          .select("status,billing_interval,current_period_ends_at,grace_period_ends_at,updated_at,plans(name)")
          .eq("organization_id", profile.organization_id)
          .eq("is_current", true)
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

  if (loading) return <LoadingState label="Abonelik bilgisi yükleniyor" />;
  if (message) return <Alert tone="error">{message}</Alert>;
  if (!subscription) {
    return (
      <EmptyState
        action={<Button asChild><Link href="/pricing">Paketleri Gör</Link></Button>}
        title="Abonelik kaydı bulunmuyor."
      />
    );
  }

  const plan = Array.isArray(subscription.plans) ? subscription.plans[0]?.name : subscription.plans?.name;
  const canOpenApp = ["active", "past_due", "grace_period", "read_only", "lifetime"].includes(subscription.status);
  const rows: Array<[string, string]> = [
    ["Organizasyon", organizationName || "-"],
    ["Paket", plan || "Paket seçilmedi"],
    ["Dönem", subscription.billing_interval === "monthly" ? "Aylık" : subscription.billing_interval === "yearly" ? "Yıllık" : "Süresiz"],
    ["Dönem sonu", subscription.current_period_ends_at ? new Date(subscription.current_period_ends_at).toLocaleDateString("tr-TR") : "-"]
  ];

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardDescription>Durum</CardDescription>
        <CardTitle className="text-2xl font-semibold">{labels[subscription.status]}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="grid gap-1" key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {canOpenApp ? <Button asChild><Link href="/app">Uygulamaya Git</Link></Button> : null}
        {subscription.status === "pending" || subscription.status === "past_due" ? <Button asChild><Link href="/checkout">Ödemeye Devam Et</Link></Button> : null}
        <Button asChild variant="outline"><Link href="/account/billing">Faturalandırma Detayı</Link></Button>
      </CardFooter>
    </Card>
  );
}
