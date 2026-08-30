import { CreditCard } from "lucide-react";
import Link from "next/link";
import { MarketingShell } from "../../components/marketing-shell";

export default function CheckoutPage() {
  return (
    <MarketingShell>
      <section className="public-account-page checkout-page">
        <CreditCard aria-hidden size={32} />
        <div className="public-section-heading">
          <span>Ödeme</span>
          <h1>Ödeme Başlangıcı</h1>
          <p>Ödeme sağlayıcısı seçimi ve canlı API bilgileri henüz tanımlanmadı. Bu ekran sahte başarılı ödeme üretmez.</p>
        </div>
        <div className="message info">Kart bilgileri sistem veritabanında saklanmayacak. Ödeme, seçilecek sağlayıcının güvenli sayfasında tamamlanacak.</div>
        <div className="actions"><Link className="button" href="/pricing">Paketleri Gör</Link><Link className="button secondary" href="/contact">Destek</Link></div>
      </section>
    </MarketingShell>
  );
}
