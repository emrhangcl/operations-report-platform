"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
      description={verified ? "E-posta adresiniz doğrulandı." : "Kayıt adresinize gönderilen doğrulama bağlantısını açın."}
      title={verified ? "Doğrulama Tamamlandı" : "E-postanızı Doğrulayın"}
    >
      <div className="auth-status-block" role="status">
        {email ? <strong>{email}</strong> : null}
        {error ? <div className="message error" role="alert">{error}</div> : null}
        <p>{verified ? "Abonelik adımına geçmek için giriş yapabilirsiniz." : "E-posta birkaç dakika içinde gelmezse gereksiz klasörünü kontrol edin."}</p>
        <Link className="button" href="/login">Giriş sayfasına git</Link>
      </div>
    </AuthShell>
  );
}
