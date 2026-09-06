import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ProductBrand } from "./logo";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="site-footer-brand">
          <ProductBrand />
          <p>Saha operasyonlarını planlama, tamamlama ve raporlama için kurumsal çalışma alanı.</p>
        </div>
        <div className="site-footer-links">
          <strong>Ürün</strong>
          <Link href="/features">Özellikler</Link>
          <Link href="/pricing">Paketler</Link>
          <Link href="/login">Giriş</Link>
        </div>
        <div className="site-footer-links">
          <strong>Kurumsal</strong>
          <Link href="/privacy">Gizlilik ve KVKK</Link>
          <Link href="/terms">Kullanım koşulları</Link>
          <Link href="/contact">İletişim <ArrowUpRight aria-hidden size={14} /></Link>
        </div>
      </div>
      <div className="site-footer-bottom"><span>© 2026 Operasyon Portalı</span><span>Türkiye · Europe/Istanbul</span></div>
    </footer>
  );
}
