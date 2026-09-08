"use client";

import Link from "next/link";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { AuthField, PasswordStrength } from "../../components/auth-field";
import { AuthShell } from "../../components/auth-shell";
import { getBrowserSupabase } from "../../lib/supabase-browser";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setMessage("Parola güncellenemedi. Bağlantıyı yeniden isteyin.");
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
