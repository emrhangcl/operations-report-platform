import { Wrench } from "lucide-react";
import { PublicInfoPage } from "../../components/public-info-page";

export default function MaintenancePage() {
  return <PublicInfoPage description="Planlı bakım sürüyor. İşlem tamamlandığında hizmet yeniden açılacak." icon={Wrench} title="Bakım Çalışması" />;
}
