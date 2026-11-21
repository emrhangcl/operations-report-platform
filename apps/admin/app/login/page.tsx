"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Field, FieldGroup } from "@/components/shadcn/field";
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
      description="Yönetici veya personel hesabınızla giriş yapın"
      footer={<span>Firma hesabınız yok mu? <Link href="/register">Kayıt olun</Link></span>}
      title="Hesabınıza giriş yapın"
    >
      <form aria-describedby={error ? "login-error" : notice ? "login-notice" : undefined} method="post" onSubmit={submit}>
        <FieldGroup>
          <AuthField
            autoComplete="email"
            id="login-email"
            label="E-posta"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ornek@firma.com"
            required
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="current-password"
            id="login-password"
            label="Parola"
            labelAction={<Link className="underline-offset-4 hover:underline" href="/forgot-password">Parolamı unuttum</Link>}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {notice ? <Alert id="login-notice" tone="success">{notice}</Alert> : null}
          {error ? <Alert id="login-error" tone="error">{error}</Alert> : null}
          <Field>
            <Button disabled={loading} type="submit">
              {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {loading ? "Giriş yapılıyor" : "Giriş Yap"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
