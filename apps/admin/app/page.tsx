import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  MoreHorizontal,
  UsersRound
} from "lucide-react";
import { FeaturesSection, WorkflowSection } from "../components/feature-sections";
import { MarketingShell } from "../components/marketing-shell";
import { PricingSection } from "../components/pricing-section";

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <section className="marketing-hero">
        <div className="marketing-hero-grid">
          <div className="marketing-hero-content">
            <span className="marketing-kicker"><span /> Saha operasyonları için kurumsal çalışma alanı</span>
            <h1>Operasyonunuzu sahadan yönetime tek akışta taşıyın.</h1>
            <p>Atamaları planlayın, ekiplerin sahadan gönderdiği kayıtları standartlaştırın ve raporları müşterilerinize hazır biçimde teslim edin.</p>
            <div className="marketing-hero-actions">
              <Link className="button marketing-primary" href="/register">
                Firma hesabı oluştur <ArrowRight aria-hidden size={18} />
              </Link>
              <Link className="button marketing-secondary" href="/login">Giriş yap</Link>
            </div>
            <ul className="marketing-proof-list">
              <li><CheckCircle2 aria-hidden size={17} /> Mobil web erişimi</li>
              <li><CheckCircle2 aria-hidden size={17} /> Organizasyon bazlı yetki</li>
              <li><CheckCircle2 aria-hidden size={17} /> PDF ve Excel çıktısı</li>
            </ul>
          </div>

          <div aria-label="Operasyon Portalı örnek çalışma alanı" className="hero-product-window">
            <div className="hero-window-bar">
              <div className="hero-window-brand"><ClipboardCheck aria-hidden size={16} /><span>Operasyon Portalı</span></div>
              <span className="hero-demo-label">Örnek çalışma alanı</span>
            </div>
            <div className="hero-window-body">
              <aside className="hero-window-nav" aria-hidden>
                <span className="active"><span className="hero-nav-dot" /> Genel Bakış</span>
                <span><span className="hero-nav-dot" /> Atamalar</span>
                <span><span className="hero-nav-dot" /> Raporlar</span>
                <span><span className="hero-nav-dot" /> Personel</span>
              </aside>
              <div className="hero-dashboard">
                <div className="hero-dashboard-heading">
                  <div><small>BUGÜN</small><strong>Operasyon özeti</strong></div>
                  <button aria-label="Diğer işlemler" type="button"><MoreHorizontal aria-hidden size={18} /></button>
                </div>
                <div className="hero-stat-row">
                  <div><ClipboardCheck aria-hidden size={17} /><span><small>Aktif atama</small><strong>12</strong></span></div>
                  <div><FileCheck2 aria-hidden size={17} /><span><small>Tamamlanan rapor</small><strong>8</strong></span></div>
                  <div><UsersRound aria-hidden size={17} /><span><small>Sahadaki personel</small><strong>6</strong></span></div>
                </div>
                <div className="hero-operations-card">
                  <div className="hero-card-title"><strong>Güncel operasyonlar</strong><span>Canlı durum</span></div>
                  {[
                    ["Montaj • Hat 2", "Sahada", "progress"],
                    ["Kontrol • Bant A", "Rapor hazır", "done"],
                    ["Kurulum • Hat 4", "Planlandı", "planned"]
                  ].map(([name, status, state]) => (
                    <div className="hero-operation-row" key={name}>
                      <span className={`hero-operation-mark ${state}`} />
                      <strong>{name}</strong>
                      <span className={`hero-operation-status ${state}`}>{status}</span>
                      <ChevronRight aria-hidden size={15} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="public-trust-strip" aria-label="Ürün özeti">
        <div className="public-container">
          <span>Planlama</span><ChevronRight aria-hidden size={15} /><span>Saha kaydı</span><ChevronRight aria-hidden size={15} /><span>Kontrol</span><ChevronRight aria-hidden size={15} /><span>PDF / Excel teslimi</span>
        </div>
      </section>
      <FeaturesSection />
      <WorkflowSection />
      <PricingSection />
      <section className="public-cta-band">
        <div className="public-container">
          <div>
            <span>Başlangıç</span>
            <h2>Firmanız için düzenli bir rapor akışı kurun</h2>
          </div>
          <Link className="button" href="/register">Firma Kaydı</Link>
        </div>
      </section>
    </MarketingShell>
  );
}
