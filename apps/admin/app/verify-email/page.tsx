"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { FieldGroup } from "@/components/shadcn/field";
import { AuthShell } from "../../components/auth-shell";

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
    const token = params.get("token");
    if (!token) return;
    // Belirteci tarayici gecmisinden ve Referer basligindan cikar.
    window.history.replaceState(null, "", window.location.pathname);
    fetch("/api/auth/verify-email", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    }).then(async (response) => {
      if (response.ok) {
        setVerified(true);
        return;
      }
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setError(body?.message ?? "Doğrulama bağlantısı geçersiz.");
    }).catch(() => setError("Doğrulama şu anda tamamlanamıyor."));
  }, []);

  return (
    <AuthShell
      description={verified ? "E-posta adresiniz doğrulandı" : "Kayıt adresinize gönderilen doğrulama bağlantısını açın"}
      title={verified ? "Doğrulama tamamlandı" : "E-postanızı doğrulayın"}
    >
      <FieldGroup role="status">
        {email ? <p className="text-center text-sm font-medium break-all">{email}</p> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="text-center text-sm text-muted-foreground">
          {verified ? "Abonelik adımına geçmek için giriş yapabilirsiniz." : "E-posta birkaç dakika içinde gelmezse gereksiz klasörünü kontrol edin."}
        </p>
        <Button asChild>
          <Link href="/login">Giriş sayfasına git</Link>
        </Button>
      </FieldGroup>
    </AuthShell>
  );
}
