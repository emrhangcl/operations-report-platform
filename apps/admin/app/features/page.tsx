import { LandingFeatures } from "@/components/landing/landing-features";
import { MarketingHeading, MarketingShell } from "../../components/marketing-shell";

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <MarketingHeading
        description="Atama, saha girişi, kontrol ve çıktı alma adımlarını aynı kurumsal çalışma alanında tutun."
        title="Montaj ve rapor sürecini tek yerde yönetin"
      />
      <LandingFeatures />
    </MarketingShell>
  );
}
