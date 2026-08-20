"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { getBrowserSupabase } from "../../lib/supabase-browser";
import { TuncaLogo } from "../../components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setError("Supabase bilgileri girilmedi. .env dosyasını doldurun.");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError("Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.");
        return;
      }

      router.replace("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand" style={{ marginBottom: 24 }}>
          <TuncaLogo />
        </div>
        <div className="field">
          <label htmlFor="email">E-posta</label>
          <input
            autoComplete="email"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="password">Şifre</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        {error ? <div className="message error">{error}</div> : null}
        <button className="button" disabled={loading} style={{ marginTop: 16 }} type="submit">
          <LogIn aria-hidden size={18} />
          {loading ? "Giriş yapılıyor" : "Giriş Yap"}
        </button>
      </form>
    </main>
  );
}
