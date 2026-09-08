import Link from "next/link";
import { ArrowRight, Building2, LogIn, UserPlus } from "lucide-react";
import { MarketingShell } from "../../components/marketing-shell";

const startOptions = [
  {
    icon: UserPlus,
    title: "Firma hesabını oluşturun",
    text: "Firma bilgilerinizi ve ilk yetkili kullanıcıyı kaydedin.",
    href: "/register",
    action: "Firma Kaydı"
  },
  {
    icon: LogIn,
    title: "Mevcut hesabınızla girin",
    text: "Yönetici veya personel hesabınızla çalışma alanına devam edin.",
    href: "/login",
    action: "Giriş Yap"
  },
  {
    icon: Building2,
    title: "Paketleri inceleyin",
    text: "Firmanızın kullanım dönemine uygun aktif paketleri karşılaştırın.",
    href: "/pricing",
    action: "Paketleri Gör"
  }
];

export default function StartPage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container public-section-heading">
          <span>Başlangıç</span>
          <h1>Operasyon çalışma alanınızı açın</h1>
          <p>Yeni firma kaydı oluşturun veya mevcut hesabınızla güvenli biçimde giriş yapın.</p>
        </div>
      </section>
      <section className="public-band public-band-soft">
        <div className="public-container">
          <div className="feature-grid start-options-grid">
            {startOptions.map((option) => {
              const Icon = option.icon;
              return (
                <article className="feature-item" key={option.href}>
                  <Icon aria-hidden size={23} />
                  <h2>{option.title}</h2>
                  <p>{option.text}</p>
                  <Link className="button secondary" href={option.href}>{option.action} <ArrowRight aria-hidden size={16} /></Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
