import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileCheck2,
  UsersRound
} from "lucide-react";
import { FeaturesSection, WorkflowSection } from "../components/feature-sections";
import { MarketingShell } from "../components/marketing-shell";
import { PricingSection } from "../components/pricing-section";

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container">
          <div className="public-section-heading">
            <span>Operasyon Portalı</span>
            <h1>Saha operasyonu ve rapor yönetimi</h1>
            <p>Atamadan rapora kadar süreci düzenleyin; ekipler sahadan güncel veri girsin, yöneticiler operasyonu tek ekrandan takip etsin.</p>
          </div>
          <div className="actions">
            <Link className="button" href="/register">Firma hesabı oluştur <ArrowRight aria-hidden size={18} /></Link>
            <Link className="button secondary" href="/login">Çalışma alanına gir</Link>
          </div>
        </div>
      </section>

      <section aria-label="Ürün özeti" className="public-band public-band-soft">
        <div className="public-container">
          <div className="feature-grid">
            <article className="feature-item tone-1">
              <ClipboardCheck aria-hidden size={23} />
              <h3>Planlama</h3>
              <p>Firma, hat, bant ve sorumlu personeli net bir atama kaydında birleştirin.</p>
            </article>
            <article className="feature-item tone-2">
              <UsersRound aria-hidden size={23} />
              <h3>Saha takibi</h3>
              <p>Personel, işlem detaylarını ve fotoğrafları mobil web üzerinden aynı akışa ekler.</p>
            </article>
            <article className="feature-item tone-3">
              <FileCheck2 aria-hidden size={23} />
              <h3>Rapor teslimi</h3>
              <p>Tamamlanan işleri kontrollü kayıt olarak saklayın, PDF ve Excel çıktılarıyla paylaşın.</p>
            </article>
          </div>
        </div>
      </section>

      <section aria-label="Güvence özeti" className="public-band">
        <div className="public-container">
          <ul className="workflow-list">
            <li><Check aria-hidden size={15} /><div><h3>Mobil web erişimi</h3><p>Saha ekibi kurulum ve rapor adımlarına telefondan ulaşır.</p></div></li>
            <li><Check aria-hidden size={15} /><div><h3>Rol bazlı yetki</h3><p>Organizasyon üyeliği ve görev ayrımı mevcut erişim akışıyla korunur.</p></div></li>
            <li><Check aria-hidden size={15} /><div><h3>PDF ve Excel çıktısı</h3><p>Tamamlanan operasyon kayıtları paylaşılabilir çıktılara dönüştürülür.</p></div></li>
          </ul>
        </div>
      </section>

      <FeaturesSection />
      <WorkflowSection />
      <PricingSection />

      <section className="public-band">
        <div className="public-container">
          <div className="public-section-heading">
            <span>Başlangıç</span>
            <h2>Firmanız için düzenli bir rapor akışı kurun</h2>
          </div>
          <Link className="button" href="/register">Firma Kaydı</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
