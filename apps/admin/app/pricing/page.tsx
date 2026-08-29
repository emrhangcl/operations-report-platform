import { MarketingShell } from "../../components/marketing-shell";
import { PricingSection } from "../../components/pricing-section";

export default function PricingPage() {
  return <MarketingShell><div className="public-page-intro"><span>Paketler</span><h1>Firmanızın kullanım dönemini seçin</h1></div><PricingSection standalone /></MarketingShell>;
}
