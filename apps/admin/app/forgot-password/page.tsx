"use client";

import Link from "next/link";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { AuthField } from "../../components/auth-field";
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
    <AuthShell
      description="Hesabınız için kayıtlı e-posta adresine güvenli yenileme bağlantısı gönderilir."
      footer={<Link href="/login">Giriş sayfasına dön</Link>}
      title="Parolamı Unuttum"
    >
      {sent ? (
        <div className="auth-status-block" role="status">
          <p>Hesap mevcutsa parola yenileme bağlantısı e-posta adresine gönderildi.</p>
        </div>
      ) : (
        <form aria-describedby={message ? "forgot-password-error" : undefined} className="public-form" onSubmit={submit}>
          <AuthField autoComplete="email" icon={<Mail size={18} />} id="forgot-password-email" label="E-posta" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="ornek@firma.com" required type="email" value={email} />
          {message ? <div className="message error" id="forgot-password-error" role="alert">{message}</div> : null}
          <button className="button public-form-submit" disabled={loading} type="submit">
            {loading ? <Loader2 aria-hidden className="auth-spinner" size={18} /> : <KeyRound aria-hidden size={18} />}
            {loading ? "Gönderiliyor" : "Yenileme Bağlantısı Gönder"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
