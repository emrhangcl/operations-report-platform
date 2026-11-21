import { CreditCard } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { MarketingShell } from "../../components/marketing-shell";
import { StatusEmpty } from "../../components/public-info-page";

export default function CheckoutPage() {
  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[50svh] max-w-7xl items-center px-4">
        <StatusEmpty
          action={
            <>
              <div className="flex gap-2">
                <Button asChild><Link href="/pricing">Paketleri Gör</Link></Button>
                <Button asChild variant="outline"><Link href="/contact">Destek</Link></Button>
              </div>
              <Alert className="text-left">Kart bilgileri sistem veritabanında saklanmayacak. Ödeme, seçilecek sağlayıcının güvenli sayfasında tamamlanacak.</Alert>
            </>
          }
          description="Ödeme sağlayıcısı seçimi ve canlı API bilgileri henüz tanımlanmadı. Bu ekran sahte başarılı ödeme üretmez."
          icon={CreditCard}
          title="Ödeme Başlangıcı"
        />
      </div>
    </MarketingShell>
  );
}
