"use client";

import { Loader2, Lock, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthField } from "../../components/auth-field";
import { AuthShell } from "../../components/auth-shell";
import { getBrowserClient } from "../../lib/browser-client";

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
      // Sunucu kimligi dogrular, kullanicinin rolune gore dogru oturum kapsamini (yonetici/personel)
      // httpOnly cerezle acar ve yonlendirilecek alani dondurur.
      const { data, error: signInError } = await getBrowserClient().auth.signInWithPassword({ email, password });
      if (signInError || !data) {
        setError(signInError?.message ?? "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
        return;
      }

      router.replace(data.redirectTo);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      description="Yetkili yönetici veya personel hesabınızla devam edin."
      footer={<span>Firma hesabınız yok mu? <Link href="/register">Kayıt olun</Link></span>}
      mode="login"
      title="Giriş"
    >
      <form aria-describedby={error ? "login-error" : notice ? "login-notice" : undefined} className="public-form" onSubmit={submit}>
        <AuthField autoComplete="email" icon={<Mail size={18} />} id="login-email" label="E-posta" name="email" onChange={(event) => setEmail(event.target.value)} placeholder="ornek@firma.com" required type="email" value={email} />
        <AuthField autoComplete="current-password" icon={<Lock size={18} />} id="login-password" label="Parola" name="password" onChange={(event) => setPassword(event.target.value)} placeholder="Parolanızı girin" required type="password" value={password} />
        <div className="form-inline-link"><Link href="/forgot-password">Parolamı unuttum</Link></div>
        {notice ? <div className="message info" id="login-notice">{notice}</div> : null}
        {error ? <div className="message error" id="login-error" role="alert">{error}</div> : null}
        <button className="button public-form-submit" disabled={loading} type="submit">
          {loading ? <Loader2 aria-hidden className="auth-spinner" size={18} /> : <LogIn aria-hidden size={18} />}
          {loading ? "Giriş yapılıyor" : "Giriş Yap"}
        </button>
      </form>
    </AuthShell>
  );
}
