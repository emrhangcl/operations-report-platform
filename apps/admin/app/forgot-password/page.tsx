"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "../../components/auth-shell";
import { getBrowserSupabase } from "../../lib/supabase-browser";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessage("Parola hizmeti yapılandırılmamış.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    setLoading(false);
    if (error) setMessage("İstek işlenemedi. Lütfen daha sonra tekrar deneyin.");
    else setSent(true);
  }

  return (
    <AuthShell footer={<Link href="/login">Giriş sayfasına dön</Link>} title="Parolamı Unuttum">
      {sent ? (
        <div className="auth-status-block"><p>Hesap mevcutsa parola yenileme bağlantısı e-posta adresine gönderildi.</p></div>
      ) : (
        <form className="public-form" onSubmit={submit}>
          <label className="field"><span>E-posta</span><input autoComplete="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
          {message ? <div className="message error">{message}</div> : null}
          <button className="button public-form-submit" disabled={loading} type="submit">{loading ? "Gönderiliyor" : "Yenileme Bağlantısı Gönder"}</button>
        </form>
      )}
    </AuthShell>
  );
}
