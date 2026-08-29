import { Headphones } from "lucide-react";
import { MarketingShell } from "../../components/marketing-shell";

export default function ContactPage() {
  return <MarketingShell><section className="public-account-page contact-page"><Headphones aria-hidden size={32} /><div className="public-section-heading"><span>İletişim</span><h1>Satış ve Destek</h1><p>Kurumsal destek e-postası, telefon ve çalışma saatleri yayın öncesinde şirket tarafından bu alana eklenmelidir.</p></div><div className="public-empty"><strong>Destek kanalı henüz yapılandırılmadı.</strong><span>Yanlış veya onaylanmamış iletişim bilgisi gösterilmiyor.</span></div></section></MarketingShell>;
}
