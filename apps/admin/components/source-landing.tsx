import Image from "next/image";
import { SourceReveal } from "./source-reveal";
import { PricingSection } from "./pricing-section";

const APP_URL = "";

const steps = [
  { no: "01", title: "Atama", text: "İşi doğru firma, hat, bant ve sorumlu personele bağlayın." },
  { no: "02", title: "Saha kaydı", text: "Zaman, işlem, kilometre ve fotoğraf mobil web üzerinden kaydedilir." },
  { no: "03", title: "Müşteri onayı", text: "İmza ve teslim bütünlüğü aynı kaydın içinde saklanır." },
  { no: "04", title: "Rapor çıktısı", text: "Yetkili paylaşım için PDF ve Excel çıktısı tek tıkla hazır." }
];

const features = [
  { key: "A", title: "Montajdan rapora tek akış", text: "Atanan işi, saha zamanlarını, ürün kalemlerini ve tamamlanan işlemleri aynı kayıtta yönetin." },
  { key: "B", title: "Firma bazlı çalışma", text: "Müşteri firmaları, hatlar, bantlar, araçlar ve personel kayıtları organizasyon sınırları içinde kalır." },
  { key: "C", title: "Kontrollü fotoğraf arşivi", text: "Saha fotoğrafları ilgili rapora bağlanır ve yalnızca yetkili organizasyon kullanıcıları görüntüler." },
  { key: "D", title: "PDF ve Excel çıktıları", text: "Tamamlanan raporları firma paylaşımına uygun PDF olarak indirin, yönetim listelerini Excel'e aktarın." },
  { key: "E", title: "Masaüstü ve mobil web", text: "Personel sahada telefondan, yöneticiler ofiste geniş ekrandan aynı güncel sistemle çalışır." },
  { key: "F", title: "Sunucu tarafı yetkilendirme", text: "Organizasyon üyeliği, rol, abonelik ve veri erişimi yalnızca arayüz kontrollerine bırakılmaz." }
];

export function SourceLanding({ className }: { className?: string }) {
  return (
    <div className={["source-landing", className].filter(Boolean).join(" ")}>
      <header className="source-header">
        <div className="source-container source-header-inner">
          <a aria-label="Operasyon Portalı" className="source-brand" href="#"><span>O</span><strong>Operasyon Portalı<i>.</i></strong></a>
          <nav aria-label="Ana navigasyon" className="source-nav"><a href="#ozellikler">Özellikler</a><a href="#akis">İş Akışı</a><a href="#paketler">Paketler</a></nav>
          <div className="source-header-actions"><a className="source-login-link" href={`${APP_URL}/login`}>Giriş Yap</a><a className="source-signal-button source-compact-button" href={`${APP_URL}/register`}>Firma Kaydı</a></div>
        </div>
      </header>

      <main>
        <section className="source-hero">
          <div aria-hidden className="source-hero-glow source-hero-glow-one" />
          <div aria-hidden className="source-hero-glow source-hero-glow-two" />
          <div className="source-container source-hero-grid">
            <SourceReveal className="source-hero-copy">
              <div className="source-eyebrow"><span />Saha Operasyon Platformu</div>
              <h1>Atamadan imzalı rapora, saha işi <em>tek kayıtta kalır</em>.</h1>
              <p>Ekipler sahadan güncel veri girsin, yöneticiler operasyonu ve çıktıları aynı çalışma alanından takip etsin. Adımlar birbirine kilitlenir, izler kaybolmaz.</p>
              <div className="source-hero-actions"><a className="source-signal-button" href={`${APP_URL}/register`}>Firma hesabı oluştur</a><a className="source-outline-button" href={`${APP_URL}/login`}>Çalışma alanına gir</a></div>
              <div className="source-hero-facts"><div><strong>Rol</strong>organizasyon sınırları</div><i /><div><strong>Mobil</strong>saha kullanımı</div><i /><div><strong>İmza</strong>teslim onayı</div></div>
            </SourceReveal>

            <SourceReveal className="source-product-wrap" delay={120}>
              <div className="source-product-shell source-hairline">
                <div className="source-product-card">
                  <div className="source-product-head"><div><span />Örnek iş raporu</div><strong>Önizleme</strong></div>
                  <div className="source-product-body">
                    <div className="source-technician"><Image alt="Örnek saha montaj görseli" height={512} src="/technician.jpg" width={512} /><div><strong>Saha ekibi</strong><span>Örnek rapor görünümü</span></div></div>
                    <div className="source-job-box"><span>İş Tanımı</span><p>Hat 3 · Bant B montaj kontrolü ve sayaç okuma kaydı.</p></div>
                    <div className="source-product-steps">
                      {[["1", "Atama personele bağlandı", true], ["2", "Fotoğraf ve imza eklendi", true], ["3", "PDF çıktısı paylaşıldı", false]].map(([no, label, done]) => <div key={no as string}><span>{no}</span><p className={done ? "" : "muted"}>{label}</p></div>)}
                    </div>
                  </div>
                  <div className="source-product-foot"><span>Örnek atama ve teslim akışı</span><strong>PDF / Excel</strong></div>
                </div>
              </div>
              <div className="source-floating-note source-hairline"><span>Operasyon</span><strong>Atama → imzalı rapor</strong></div>
            </SourceReveal>
          </div>
        </section>

        <section className="source-section" id="akis">
          <div className="source-container source-section-inner">
            <SourceReveal className="source-section-heading"><p>İş Akışı</p><h2>Dört adım, tek operasyon kaydı.</h2></SourceReveal>
            <div className="source-workflow"><SourceReveal><div className="source-rail" /></SourceReveal><div className="source-workflow-grid">{steps.map((step, index) => <SourceReveal delay={index * 90} key={step.no}><span>{step.no}</span><i /><h3>{step.title}</h3><p>{step.text}</p></SourceReveal>)}</div></div>
          </div>
        </section>

        <section className="source-section" id="ozellikler">
          <div className="source-container source-section-inner">
            <SourceReveal className="source-section-heading source-features-heading"><p>Yetenekler</p><h2>Günlük operasyonun ortak çalışma düzeni.</h2></SourceReveal>
            <div className="source-features-grid">{features.map((feature, index) => <SourceReveal className="source-feature" delay={(index % 3) * 90} key={feature.key}><span>{feature.key}</span><h3>{feature.title}</h3><p>{feature.text}</p></SourceReveal>)}</div>
          </div>
        </section>

        <PricingSection />

        <section className="source-section" id="baslangic">
          <div className="source-container source-cta-wrap"><SourceReveal><div className="source-cta"><div aria-hidden /><section><h2>Operasyon kaydını mesaj trafiğinden çıkarın.</h2><p>Firma hesabınızı oluşturun veya mevcut rolünüzle güvenli çalışma alanına girin.</p><div><a className="source-signal-button" href={`${APP_URL}/register`}>Firma Kaydı</a><a className="source-outline-button" href={`${APP_URL}/login`}>Giriş Yap</a></div></section></div></SourceReveal></div>
        </section>
      </main>

      <footer className="source-footer" id="iletisim">
        <div className="source-container source-footer-inner">
          <div className="source-footer-grid">
            <div className="source-footer-brand"><div className="source-brand"><span>O</span><strong>Operasyon Portalı<i>.</i></strong></div><p>Saha operasyonlarını planlama, tamamlama ve raporlama için kurumsal çalışma alanı.</p></div>
            <div><h4>Ürün</h4><ul><li><a href="#ozellikler">Özellikler</a></li><li><a href="#akis">İş Akışı</a></li><li><a href="#paketler">Paketler</a></li></ul></div>
            <div><h4>Kurumsal</h4><ul><li><a href={`${APP_URL}/login`}>Giriş</a></li><li><a href={`${APP_URL}/register`}>Firma Kaydı</a></li><li><a href="#baslangic">Başlangıç</a></li></ul></div>
            <div><h4>Yasal</h4><ul><li><a href="/privacy">Gizlilik ve KVKK</a></li><li><a href="/terms">Kullanım koşulları</a></li><li><a href="/contact">İletişim</a></li></ul></div>
          </div>
          <div className="source-footer-bottom"><p>© 2026 Operasyon Portalı. Tüm hakları saklıdır.</p><p>Türkiye · Europe/Istanbul</p></div>
        </div>
      </footer>
    </div>
  );
}
