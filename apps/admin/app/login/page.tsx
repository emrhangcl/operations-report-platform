"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSubscriptionAccessMode } from "@tunca/shared";
import type { BillingInterval, OrganizationStatus, SubscriptionStatus } from "@tunca/types";
import { AuthShell } from "../../components/auth-shell";
import { getBrowserSupabase } from "../../lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("registered") === "1") {
      setNotice("Firma hesabınız oluşturuldu. E-posta ve parolanızla giriş yapabilirsiniz.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Giriş hizmeti yapılandırılmamış.");
        return;
      }

      const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signIn.user) {
        setError("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id,is_active")
        .eq("id", signIn.user.id)
        .maybeSingle();

      if (!profile?.organization_id || profile.is_active !== true) {
        await supabase.auth.signOut();
        setError("Aktif kullanıcı profili bulunamadı.");
        return;
      }

      const [membershipResult, organizationResult] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role,is_active")
          .eq("organization_id", profile.organization_id)
          .eq("profile_id", signIn.user.id)
          .maybeSingle(),
        supabase.from("organizations").select("status").eq("id", profile.organization_id).maybeSingle()
      ]);

      const membership = membershipResult.data;
      if (!membership?.is_active) {
        await supabase.auth.signOut();
        setError("Aktif organizasyon üyeliği bulunamadı.");
        return;
      }

      if (membership.role === "PERSONNEL") {
        await supabase.auth.signOut();
        const personnelClient = getBrowserSupabase("personnel");
        if (!personnelClient) {
          setError("Personel oturumu yapılandırılmamış.");
          return;
        }

        const { error: personnelError } = await personnelClient.auth.signInWithPassword({ email, password });
        if (personnelError) {
          setError("Personel oturumu açılamadı.");
          return;
        }
        router.replace("/personel");
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
        await supabase.auth.signOut();
        setError("Abonelik durumu alınamadı.");
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

      router.replace("/app");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      footer={<span>Firma hesabınız yok mu? <Link href="/register">Kayıt olun</Link></span>}
      title="Giriş"
    >
      <form className="public-form" onSubmit={submit}>
        <label className="field">
          <span>E-posta</span>
          <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        </label>
        <label className="field">
          <span>Parola</span>
          <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
        </label>
        <div className="form-inline-link"><Link href="/forgot-password">Parolamı unuttum</Link></div>
        {notice ? <div className="message info">{notice}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        <button className="button public-form-submit" disabled={loading} type="submit">
          <LogIn aria-hidden size={18} /> {loading ? "Giriş yapılıyor" : "Giriş Yap"}
        </button>
      </form>
    </AuthShell>
  );
}
