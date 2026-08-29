"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "../../components/auth-shell";
import { getBrowserSupabase } from "../../lib/supabase-browser";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    setEmail(new URLSearchParams(window.location.search).get("email") ?? "");
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setVerified(Boolean(data.session?.user.email_confirmed_at)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setVerified(Boolean(session?.user.email_confirmed_at));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthShell
      description={verified ? "E-posta adresiniz doğrulandı." : "Kayıt adresinize gönderilen doğrulama bağlantısını açın."}
      title={verified ? "Doğrulama Tamamlandı" : "E-postanızı Doğrulayın"}
    >
      <div className="auth-status-block">
        {email ? <strong>{email}</strong> : null}
        <p>{verified ? "Abonelik adımına geçmek için giriş yapabilirsiniz." : "E-posta birkaç dakika içinde gelmezse gereksiz klasörünü kontrol edin."}</p>
        <Link className="button" href="/login">Giriş sayfasına git</Link>
      </div>
    </AuthShell>
  );
}
