import { BillingOverview } from "../../../components/billing-overview";
import { FirmPage, PageHeaderShell } from "@/components/firm-ui";

export default function BillingPage() {
  return (
    <FirmPage>
      <PageHeaderShell
        description="Yalnızca gerçek ödeme ve fatura kayıtları gösterilir."
        title="Faturalandırma"
      />
      <BillingOverview />
    </FirmPage>
  );
}
