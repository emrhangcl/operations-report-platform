import { Headphones } from "lucide-react";
import { MarketingShell } from "../../components/marketing-shell";
import { StatusEmpty } from "../../components/public-info-page";

export default function ContactPage() {
  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[50svh] max-w-7xl items-center px-4">
        <StatusEmpty
          description="Kurumsal destek e-postası, telefon ve çalışma saatleri yayın öncesinde eklenecek. Onaylanmamış iletişim bilgisi gösterilmiyor."
          icon={Headphones}
          title="Satış ve Destek"
        />
      </div>
    </MarketingShell>
  );
}
