import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { FeaturesSection, WorkflowSection } from "../components/feature-sections";
import { MarketingShell } from "../components/marketing-shell";
import { PricingSection } from "../components/pricing-section";

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="marketing-hero">
        <Image alt="" aria-hidden className="marketing-hero-mark" height={520} priority src="/tunca-app-icon.png" width={520} />
        <div className="marketing-hero-content">
          <span className="marketing-kicker">Montaj ve saha operasyonları</span>
          <h1>TUNCA Rapor Sistemi</h1>
          <p>Montaj atamalarını planlayın, saha bilgilerini düzenli toplayın ve tamamlanan raporları güvenli şekilde paylaşın.</p>
          <div className="marketing-hero-actions">
            <Link className="button marketing-primary" href="/register">
              Firma hesabı oluştur <ArrowRight aria-hidden size={18} />
            </Link>
            <Link className="button marketing-secondary" href="/login">Giriş yap</Link>
          </div>
          <ul className="marketing-proof-list">
            <li><CheckCircle2 aria-hidden size={17} /> Mobil web erişimi</li>
            <li><CheckCircle2 aria-hidden size={17} /> Organizasyon bazlı yetki</li>
            <li><CheckCircle2 aria-hidden size={17} /> PDF ve Excel çıktısı</li>
          </ul>
        </div>
      </section>
      <FeaturesSection />
      <WorkflowSection />
      <PricingSection />
      <section className="public-cta-band">
        <div className="public-container">
          <div>
            <span>Başlangıç</span>
            <h2>Firmanız için düzenli bir rapor akışı kurun</h2>
          </div>
          <Link className="button" href="/register">Firma Kaydı</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
