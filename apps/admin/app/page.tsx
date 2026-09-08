import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "../components/marketing-shell";

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="public-band">
        <div className="public-container">
          <div className="public-section-heading">
            <span>Operasyon Portalı</span>
            <h1>Saha operasyonu ve rapor yönetimi</h1>
            <p>Atamadan rapora kadar süreci düzenleyin; ekipler sahadan güncel veri girsin, yöneticiler operasyonu tek ekrandan takip etsin.</p>
          </div>
          <div className="actions">
            <Link className="button" href="/register">Firma hesabı oluştur <ArrowRight aria-hidden size={18} /></Link>
            <Link className="button secondary" href="/login">Çalışma alanına gir</Link>
          </div>
        </div>
      </section>

    </MarketingShell>
  );
}
