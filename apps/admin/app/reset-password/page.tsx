"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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
    <AuthShell title="Yeni Parola">
      {updated ? <div className="auth-status-block"><p>Parolanız güncellendi.</p><Link className="button" href="/login">Giriş yap</Link></div> : null}
      {!updated && !ready ? <div className="message error">Geçerli parola yenileme oturumu bulunamadı.</div> : null}
      {!updated && ready ? (
        <form className="public-form" onSubmit={submit}>
          <label className="field"><span>Yeni parola</span><input autoComplete="new-password" minLength={10} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
          {message ? <div className="message error">{message}</div> : null}
          <button className="button public-form-submit" disabled={loading} type="submit">{loading ? "Güncelleniyor" : "Parolayı Güncelle"}</button>
        </form>
      ) : null}
    </AuthShell>
  );
}
