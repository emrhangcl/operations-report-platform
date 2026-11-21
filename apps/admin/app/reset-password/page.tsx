"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Field, FieldGroup } from "@/components/shadcn/field";
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
      description="Yeni parolanız en az 10 karakter olmalıdır"
      footer={updated ? undefined : <Link href="/forgot-password">Yeni bağlantı isteyin</Link>}
      title="Yeni parola belirleyin"
    >
      {updated ? (
        <FieldGroup>
          <Alert tone="success">Parolanız güncellendi.</Alert>
          <Button asChild>
            <Link href="/login">Giriş yap</Link>
          </Button>
        </FieldGroup>
      ) : null}
      {!updated && !ready ? <Alert tone="error">Geçerli parola yenileme oturumu bulunamadı.</Alert> : null}
      {!updated && ready ? (
        <form aria-describedby={message ? "reset-password-error" : undefined} onSubmit={submit}>
          <FieldGroup>
            <Field>
              <AuthField
                autoComplete="new-password"
                id="reset-password"
                label="Yeni parola"
                minLength={10}
                name="new-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <PasswordStrength password={password} />
            </Field>
            {message ? <Alert id="reset-password-error" tone="error">{message}</Alert> : null}
            <Field>
              <Button disabled={loading} type="submit">
                {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {loading ? "Güncelleniyor" : "Parolayı Güncelle"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      ) : null}
    </AuthShell>
  );
}
