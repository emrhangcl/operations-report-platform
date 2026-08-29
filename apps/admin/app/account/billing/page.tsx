import { BillingOverview } from "../../../components/billing-overview";
import { MarketingShell } from "../../../components/marketing-shell";

export default function BillingPage() {
  return <MarketingShell><section className="public-account-page wide"><div className="public-section-heading"><span>Firma Hesabı</span><h1>Faturalandırma</h1><p>Yalnızca gerçek ödeme ve fatura kayıtları gösterilir.</p></div><BillingOverview /></section></MarketingShell>;
}
