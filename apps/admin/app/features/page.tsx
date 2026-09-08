import { FeaturesSection } from "../../components/feature-sections";
import { MarketingShell } from "../../components/marketing-shell";

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container public-section-heading">
          <span>Özellikler</span>
          <h1>Montaj ve rapor sürecini tek yerde yönetin</h1>
          <p>Atama, saha girişi, kontrol ve çıktı alma adımlarını aynı kurumsal çalışma alanında tutun.</p>
        </div>
      </section>
      <FeaturesSection heading="Operasyon ekibinin günlük çalışma alanı" />
    </MarketingShell>
  );
}
