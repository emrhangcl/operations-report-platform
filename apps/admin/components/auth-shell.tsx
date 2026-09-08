import Link from "next/link";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { ProductBrand } from "./logo";

export function AuthShell({
  children,
  description,
  footer,
  mode,
  title
}: {
  children: React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  mode?: "login" | "register";
  title: string;
}) {
  return (
    <main className="public-auth-page">
      <div className="public-auth-layout">
        <aside className="public-auth-context">
          <Link aria-label="Ana sayfa" className="public-auth-brand" href="/">
            <ProductBrand />
          </Link>
          <div className="public-auth-context-copy">
            <span className="public-auth-eyebrow"><ShieldCheck aria-hidden size={16} /> Güvenli operasyon erişimi</span>
            <h2>Saha operasyonlarınızı tek merkezden yönetin.</h2>
            <p>Atamalar, servis raporları, müşteri onayları ve ekip takibi aynı güvenli çalışma alanında.</p>
            <ul>
              <li><CheckCircle2 aria-hidden size={17} /> Organizasyon ve rol tabanlı erişim</li>
              <li><CheckCircle2 aria-hidden size={17} /> Güvenli rapor ve müşteri verileri</li>
              <li><CheckCircle2 aria-hidden size={17} /> Masaüstü ve mobil uyumlu kullanım</li>
            </ul>
          </div>
          <div className="public-auth-security-note"><LockKeyhole aria-hidden size={16} /> Oturumunuz şifreli bağlantı üzerinden korunur.</div>
        </aside>
        <section className="public-auth-panel">
          {mode ? (
            <nav aria-label="Hesap işlemleri" className="auth-mode-tabs">
              <Link aria-current={mode === "login" ? "page" : undefined} className={mode === "login" ? "active" : ""} href="/login">Giriş</Link>
              <Link aria-current={mode === "register" ? "page" : undefined} className={mode === "register" ? "active" : ""} href="/register">Firma Kaydı</Link>
            </nav>
          ) : null}
          <header>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </header>
          {children}
          {footer ? <footer>{footer}</footer> : null}
        </section>
      </div>
    </main>
  );
}
