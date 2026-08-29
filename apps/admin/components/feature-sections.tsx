import {
  Building2,
  ClipboardCheck,
  FileOutput,
  Images,
  ShieldCheck,
  Smartphone
} from "lucide-react";

const features = [
  {
    icon: ClipboardCheck,
    title: "Montajdan rapora tek akış",
    text: "Atanan işi, saha zamanlarını, ürün kalemlerini ve tamamlanan işlemleri aynı kayıtta yönetin."
  },
  {
    icon: Building2,
    title: "Firma bazlı çalışma",
    text: "Müşteri firmaları, hatlar, bantlar, araçlar ve personel kayıtları organizasyon sınırları içinde kalır."
  },
  {
    icon: Images,
    title: "Kontrollü fotoğraf arşivi",
    text: "Saha fotoğrafları ilgili rapora bağlanır ve yalnızca yetkili organizasyon kullanıcıları tarafından görüntülenir."
  },
  {
    icon: FileOutput,
    title: "PDF ve Excel çıktıları",
    text: "Tamamlanan raporları firma paylaşımına uygun PDF olarak indirin, yönetim listelerini Excel'e aktarın."
  },
  {
    icon: Smartphone,
    title: "Masaüstü ve mobil web",
    text: "Personel sahada telefondan, yöneticiler ofiste geniş ekrandan aynı güncel sistemle çalışır."
  },
  {
    icon: ShieldCheck,
    title: "Sunucu tarafı yetkilendirme",
    text: "Organizasyon üyeliği, rol, abonelik ve veri erişimi yalnızca arayüz kontrollerine bırakılmaz."
  }
];

export function FeaturesSection({ heading = "Saha operasyonu için gereken temel araçlar" }: { heading?: string }) {
  return (
    <section className="public-band" id="ozellikler">
      <div className="public-container">
        <div className="public-section-heading">
          <span>Ürün</span>
          <h2>{heading}</h2>
          <p>Tekrarlanan veri girişini azaltan, raporu bulunabilir ve paylaşılabilir tutan sade bir çalışma düzeni.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article className={`feature-item tone-${(index % 3) + 1}`} key={feature.title}>
                <Icon aria-hidden size={23} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection() {
  const steps = [
    ["01", "İşi planlayın", "Firma, hat, bant ve sorumlu personeli seçerek montaj atamasını hazırlayın."],
    ["02", "Sahada tamamlayın", "Personel yalnız işlem sonrasında gereken alanları, zamanları ve fotoğrafları eklesin."],
    ["03", "Raporlayın", "Gönderilen kayıt değişmeden saklansın; yönetici görüntülesin, PDF veya Excel olarak paylaşsın."]
  ];

  return (
    <section className="public-band public-band-dark">
      <div className="public-container workflow-layout">
        <div className="public-section-heading light">
          <span>İş akışı</span>
          <h2>Planlama ile teslim arasında daha az dağınıklık</h2>
        </div>
        <ol className="workflow-list">
          {steps.map(([number, title, text]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
