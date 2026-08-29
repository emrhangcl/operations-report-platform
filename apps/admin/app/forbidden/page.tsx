import { ShieldAlert } from "lucide-react";
import { PublicInfoPage } from "../../components/public-info-page";

export default function ForbiddenPage() {
  return <PublicInfoPage description="Bu alan için gerekli organizasyon veya rol yetkiniz bulunmuyor." icon={ShieldAlert} title="Erişim Yetkiniz Yok" />;
}
