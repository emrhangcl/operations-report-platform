import { MarketingShell } from "../../components/marketing-shell";
import { SubscriptionStatus } from "../../components/subscription-status";

export default function SubscriptionPage() {
  return <MarketingShell><section className="public-account-page"><div className="public-section-heading"><span>Hesap</span><h1>Abonelik Durumu</h1><p>Uygulama erişiminizin geçerli durumunu görüntüleyin.</p></div><SubscriptionStatus /></section></MarketingShell>;
}
