import { BillingOverview } from "../../../components/billing-overview";
import { PageHeaderShell } from "../../../components/ui";

export default function BillingPage() {
  return (
    <>
      <PageHeaderShell
        description="Yalnızca gerçek ödeme ve fatura kayıtları gösterilir."
        title="Faturalandırma"
      />
      <BillingOverview />
    </>
  );
}
