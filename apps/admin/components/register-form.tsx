"use client";

import Link from "next/link";
import { Building2, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthField, PasswordStrength } from "./auth-field";

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
    <form className="public-form" onSubmit={submit}>
      <div className="public-form-grid two-columns">
        <AuthField autoComplete="organization" containerClassName="span-2" icon={<Building2 size={18} />} label="Firma adı" maxLength={160} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Firma unvanı" required value={organizationName} />
        <AuthField autoComplete="given-name" icon={<User size={18} />} label="Ad" maxLength={80} onChange={(event) => setFirstName(event.target.value)} placeholder="Adınız" required value={firstName} />
        <AuthField autoComplete="family-name" icon={<User size={18} />} label="Soyad" maxLength={80} onChange={(event) => setLastName(event.target.value)} placeholder="Soyadınız" required value={lastName} />
        <AuthField autoComplete="email" containerClassName="span-2" icon={<Mail size={18} />} label="İş e-postası" maxLength={254} onChange={(event) => setEmail(event.target.value)} placeholder="ornek@firma.com" required type="email" value={email} />
        <AuthField autoComplete="tel" icon={<Phone size={18} />} label="Telefon" maxLength={32} onChange={(event) => setPhone(event.target.value)} placeholder="05xx xxx xx xx" type="tel" value={phone} />
        <div>
          <AuthField autoComplete="new-password" icon={<Lock size={18} />} label="Parola" minLength={10} onChange={(event) => setPassword(event.target.value)} placeholder="En az 10 karakter" required type="password" value={password} />
          <PasswordStrength password={password} />
        </div>
      </div>
      <fieldset className="segmented-field">
        <legend>Faturalandırma dönemi</legend>
        <div className="segmented-control">
          <button className={interval === "monthly" ? "active" : ""} onClick={() => setInterval("monthly")} type="button">Aylık</button>
          <button className={interval === "yearly" ? "active" : ""} onClick={() => setInterval("yearly")} type="button">Yıllık</button>
        </div>
      </fieldset>
      <label className="consent-row">
        <input checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required type="checkbox" />
        <span><Link href="/privacy">Gizlilik/KVKK</Link> ve <Link href="/terms">kullanım-abonelik</Link> taslak alanlarını inceledim.</span>
      </label>
      {message ? <div className="message error">{message}</div> : null}
      <button className="button public-form-submit" disabled={loading} type="submit">
        {loading ? <Loader2 aria-hidden className="auth-spinner" size={18} /> : <Building2 aria-hidden size={18} />}
        {loading ? "Hesap hazırlanıyor" : "Firma Hesabı Oluştur"}
      </button>
    </form>
  );
}
