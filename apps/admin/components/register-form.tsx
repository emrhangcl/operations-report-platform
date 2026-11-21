"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { AuthField, PasswordStrength } from "./auth-field";

// shadcn "signup-02" form yapisi; alanlar ve kayit API'si onceki formla ayni.
export function RegisterForm() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [planId, setPlanId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedInterval = params.get("interval");
    if (requestedInterval === "yearly") setInterval("yearly");
    setPlanId(params.get("plan"));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!termsAccepted) {
      setMessage("Devam etmek için Gizlilik/KVKK ve kullanım koşullarını onaylayın.");
      return;
    }
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: organizationName,
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          password,
          billing_interval: interval,
          plan_id: planId,
          terms_accepted: termsAccepted
        })
      });
      const result = await response.json() as {
        message?: string;
        requires_email_verification?: boolean;
      };

      if (!response.ok) {
        setMessage(result.message ?? "Kayıt tamamlanamadı.");
        return;
      }

      const destination = result.requires_email_verification
        ? `/verify-email?email=${encodeURIComponent(email)}`
        : "/login?registered=1";
      router.push(destination);
    } catch {
      setMessage("Kayıt hizmetine ulaşılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form method="post" onSubmit={submit}>
      <FieldGroup>
        <AuthField
          autoComplete="organization"
          label="Firma adı"
          maxLength={160}
          onChange={(event) => setOrganizationName(event.target.value)}
          placeholder="Firma unvanı"
          required
          value={organizationName}
        />
        <div className="grid grid-cols-2 gap-4">
          <AuthField
            autoComplete="given-name"
            label="Ad"
            maxLength={80}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Adınız"
            required
            value={firstName}
          />
          <AuthField
            autoComplete="family-name"
            label="Soyad"
            maxLength={80}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Soyadınız"
            required
            value={lastName}
          />
        </div>
        <AuthField
          autoComplete="email"
          hint="Hesap doğrulaması ve faturalar bu adrese gönderilir."
          label="İş e-postası"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="ornek@firma.com"
          required
          type="email"
          value={email}
        />
        <AuthField
          autoComplete="tel"
          label="Telefon"
          maxLength={32}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="05xx xxx xx xx"
          type="tel"
          value={phone}
        />
        <Field>
          <AuthField
            autoComplete="new-password"
            label="Parola"
            minLength={10}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <PasswordStrength password={password} />
        </Field>
        <Field>
          <FieldLabel id="billing-interval-label">Faturalandırma dönemi</FieldLabel>
          <ToggleGroup
            aria-labelledby="billing-interval-label"
            className="w-full"
            onValueChange={(value) => {
              if (value === "monthly" || value === "yearly") setInterval(value);
            }}
            type="single"
            value={interval}
            variant="outline"
          >
            <ToggleGroupItem className="flex-1" value="monthly">Aylık</ToggleGroupItem>
            <ToggleGroupItem className="flex-1" value="yearly">Yıllık</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            checked={termsAccepted}
            id="register-terms"
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
          />
          <FieldLabel className="font-normal leading-snug [&_a]:underline [&_a]:underline-offset-4" htmlFor="register-terms">
            <span>
              <Link href="/privacy">Gizlilik/KVKK</Link> ve <Link href="/terms">kullanım ve abonelik koşulları</Link> metinlerini okudum.
            </span>
          </FieldLabel>
        </Field>
        {message ? <Alert tone="error">{message}</Alert> : null}
        <Field>
          <Button disabled={loading} type="submit">
            {loading ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {loading ? "Hesap hazırlanıyor" : "Firma Hesabı Oluştur"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
