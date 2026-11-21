import { LegalArticle } from "../../components/legal-article";
import { MarketingShell } from "../../components/marketing-shell";

export default function TermsPage() {
  return (
    <MarketingShell>
      <LegalArticle
        intro="Nihai sözleşme metni henüz onaylanmamıştır. Aşağıdaki başlıklar hukuk ve mali müşavir incelemesinden sonra doldurulmalıdır."
        items={[
          "Hizmet kapsamı ve tarafların sorumlulukları",
          "Aylık/yıllık ücret, yenileme, iptal ve iade koşulları",
          "Grace period ve salt okunur kullanım kuralları",
          "Veri sahipliği, dışa aktarma ve hesap kapatma süreci",
          "Hizmet seviyesi, destek, sorumluluk sınırları ve uyuşmazlık hükümleri"
        ]}
        title="Kullanım ve Abonelik Sözleşmesi"
      />
    </MarketingShell>
  );
}
