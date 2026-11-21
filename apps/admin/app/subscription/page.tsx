import { MarketingHeading, MarketingShell } from "../../components/marketing-shell";
import { SubscriptionStatus } from "../../components/subscription-status";

export default function SubscriptionPage() {
  return (
    <MarketingShell>
      <MarketingHeading description="Uygulama erişiminizin geçerli durumunu görüntüleyin." title="Abonelik Durumu" />
      <div className="mx-auto mt-10 max-w-7xl px-4">
        <SubscriptionStatus />
      </div>
    </MarketingShell>
  );
}
