import { FeaturesSection, WorkflowSection } from "../../components/feature-sections";
import { MarketingShell } from "../../components/marketing-shell";

export default function FeaturesPage() {
  return <MarketingShell><div className="public-page-intro"><span>Özellikler</span><h1>Montaj ve rapor sürecini tek yerde yönetin</h1></div><FeaturesSection heading="Operasyon ekibinin günlük çalışma alanı" /><WorkflowSection /></MarketingShell>;
}
