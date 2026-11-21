"use client";

import { Loader2 } from "lucide-react";
import type { FormEvent } from "react";
import { Alert } from "@/components/firm-ui";
import { AuthField } from "@/components/auth-field";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/shadcn/button";
import { Field, FieldGroup } from "@/components/shadcn/field";

// /login sayfasiyla ayni shadcn "login-02" yapisi; giris mantigi personel sayfasinda kalir.
export function PersonnelLogin({
  email,
  loading,
  message,
  password,
  setEmail,
  setPassword,
  signIn
}: {
  email: string;
  loading: boolean;
  message: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  signIn: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <AuthShell title="Personel Girişi">
      <form aria-describedby={message ? "personnel-login-error" : undefined} method="post" onSubmit={signIn}>
        <FieldGroup>
          <AuthField
            autoComplete="email"
            id="personnel-login-email"
            inputMode="email"
            label="E-posta"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <AuthField
            autoComplete="current-password"
            id="personnel-login-password"
            label="Şifre"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {message ? <Alert id="personnel-login-error" tone="error">{message}</Alert> : null}
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
