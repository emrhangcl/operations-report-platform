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
          <h2>{heading}</h2>
          <p>Ekiplerin günlük işini hızlandıran, yöneticilere görünürlük sağlayan ve müşteri teslimini standartlaştıran bir operasyon altyapısı.</p>
        </div>
        <div className="capability-ledger">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title}>
                <span className={`capability-icon tone-${(index % 3) + 1}`}><Icon aria-hidden size={20} /></span>
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
    ["01", "Planla", "Firma, hat, bant ve sorumlu personeli seçerek işi net bir kapsamla atayın."],
    ["02", "Sahada tamamla", "Ekip zamanları, yapılan işlemleri, kilometreleri ve fotoğrafları telefondan girsin."],
    ["03", "Kontrol et ve teslim et", "Raporu değişmez kayıt olarak saklayın; PDF veya Excel çıktısını müşteriyle paylaşın."]
  ];

  return (
    <section className="public-band public-band-soft">
      <div className="public-container workflow-layout">
        <div className="public-section-heading">
          <h2>Her iş aynı net adımlarla ilerler.</h2>
          <p>Bilgi nerede, son durum ne, rapor hazır mı soruları için ayrı mesaj trafiğine gerek kalmaz.</p>
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
