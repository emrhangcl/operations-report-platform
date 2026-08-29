import { TimerReset } from "lucide-react";
import { PublicInfoPage } from "../../components/public-info-page";

export default function RateLimitedPage() {
  return <PublicInfoPage description="Kısa sürede çok fazla istek alındı. Birkaç dakika sonra yeniden deneyin." icon={TimerReset} title="İstek Sınırına Ulaşıldı" />;
}
