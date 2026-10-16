"use client";

import Link from "next/link";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AuthField, PasswordStrength } from "../../components/auth-field";
import { AuthShell } from "../../components/auth-shell";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [message, setMessage] = useState("");
  const ready = Boolean(token);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token");
    setToken(value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null);
    // Belirteci tarayici gecmisinden ve Referer basligindan cikar.
    if (value) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/password/reset", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    }).catch(() => null);
    const body = await response?.json().catch(() => null) as { message?: string } | null;
    setLoading(false);
    if (!response?.ok) setMessage(body?.message ?? "Parola güncellenemedi. Bağlantıyı yeniden isteyin.");
    else setUpdated(true);
  }

  return (
    <AuthShell
      description="Yeni parolanız en az 10 karakter olmalıdır."
      title="Yeni Parola"
    >
      {updated ? (
        <div className="auth-status-block" role="status">
          <p>Parolanız güncellendi.</p>
          <Link className="button" href="/login">Giriş yap</Link>
        </div>
      ) : null}
      {!updated && !ready ? <div className="message error" role="alert">Geçerli parola yenileme oturumu bulunamadı.</div> : null}
      {!updated && ready ? (
        <form aria-describedby={message ? "reset-password-error" : undefined} className="public-form" onSubmit={submit}>
          <AuthField autoComplete="new-password" icon={<Lock size={18} />} id="reset-password" label="Yeni parola" minLength={10} name="new-password" onChange={(event) => setPassword(event.target.value)} placeholder="En az 10 karakter" required type="password" value={password} />
          <PasswordStrength password={password} />
          {message ? <div className="message error" id="reset-password-error" role="alert">{message}</div> : null}
          <button className="button public-form-submit" disabled={loading} type="submit">
            {loading ? <Loader2 aria-hidden className="auth-spinner" size={18} /> : <KeyRound aria-hidden size={18} />}
            {loading ? "Güncelleniyor" : "Parolayı Güncelle"}
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
}
