import { MarketingShell } from "../../components/marketing-shell";
import { PricingSection } from "../../components/pricing-section";

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container public-section-heading">
          <span>Paketler</span>
          <h1>Firmanızın kullanım dönemini seçin</h1>
          <p>Satışa açık paketler doğrudan sistemdeki plan kayıtlarından gösterilir.</p>
        </div>
      </section>
      <PricingSection standalone />
    </MarketingShell>
  );
}
