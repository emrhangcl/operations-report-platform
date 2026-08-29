import { MarketingShell } from "../../components/marketing-shell";

export default function PrivacyPage() {
  return <MarketingShell><article className="legal-page"><div className="legal-draft-badge">Hukukçu onayı bekleyen taslak alan</div><h1>Gizlilik ve KVKK</h1><p>Bu sayfadaki nihai aydınlatma, saklama, aktarım, başvuru ve veri sorumlusu bilgileri şirketin hukuk danışmanı tarafından hazırlanıp onaylanmalıdır.</p><h2>Doldurulması gereken bölümler</h2><ul><li>Veri sorumlusu ve iletişim bilgileri</li><li>İşlenen kişisel veri kategorileri ve hukuki sebepler</li><li>İşleme amaçları, saklama süreleri ve alıcı grupları</li><li>İlgili kişi hakları ve başvuru yöntemi</li><li>Çerezler, alt işleyenler ve yurt dışı aktarım değerlendirmesi</li></ul></article></MarketingShell>;
}
