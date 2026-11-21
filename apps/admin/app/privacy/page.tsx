import { LegalArticle } from "../../components/legal-article";
import { MarketingShell } from "../../components/marketing-shell";

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <LegalArticle
        intro="Bu sayfadaki nihai aydınlatma, saklama, aktarım, başvuru ve veri sorumlusu bilgileri şirketin hukuk danışmanı tarafından hazırlanıp onaylanmalıdır."
        items={[
          "Veri sorumlusu ve iletişim bilgileri",
          "İşlenen kişisel veri kategorileri ve hukuki sebepler",
          "İşleme amaçları, saklama süreleri ve alıcı grupları",
          "İlgili kişi hakları ve başvuru yöntemi",
          "Çerezler, alt işleyenler ve yurt dışı aktarım değerlendirmesi"
        ]}
        title="Gizlilik ve KVKK"
      />
    </MarketingShell>
  );
}
