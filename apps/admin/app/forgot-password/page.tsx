"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Field, FieldGroup } from "@/components/shadcn/field";
import { AuthField } from "../../components/auth-field";
import { AuthShell } from "../../components/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/password/forgot", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    }).catch(() => null);
    setLoading(false);
    if (!response?.ok) setMessage("İstek işlenemedi. Lütfen daha sonra tekrar deneyin.");
    else setSent(true);
  }

  return (
    <AuthShell
      description="Kayıtlı e-posta adresinize güvenli yenileme bağlantısı gönderilir"
      footer={<Link href="/login">Giriş sayfasına dön</Link>}
      title="Parolamı unuttum"
    >
      {sent ? (
        <Alert tone="success">Hesap mevcutsa parola yenileme bağlantısı e-posta adresine gönderildi.</Alert>
      ) : (
        <form aria-describedby={message ? "forgot-password-error" : undefined} onSubmit={submit}>
          <FieldGroup>
            <AuthField
              autoComplete="email"
              id="forgot-password-email"
              label="E-posta"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@firma.com"
              required
              type="email"
              value={email}
            />
            {message ? <Alert id="forgot-password-error" tone="error">{message}</Alert> : null}
            <Field>
              <Button disabled={loading} type="submit">
                {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
                {loading ? "Gönderiliyor" : "Yenileme Bağlantısı Gönder"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      )}
    </AuthShell>
  );
}
