import { FileQuestion } from "lucide-react";
import { PublicInfoPage } from "../components/public-info-page";

export default function NotFound() {
  return <PublicInfoPage description="Aradığınız sayfa taşınmış, silinmiş veya hiç oluşturulmamış olabilir." icon={FileQuestion} title="Sayfa Bulunamadı" />;
}
