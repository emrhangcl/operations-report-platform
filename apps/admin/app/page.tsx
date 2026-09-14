import type { Metadata } from "next";
import { SourceLanding } from "../components/source-landing";
import "./source-landing.css";

export const metadata: Metadata = {
  title: "Operasyon Portalı — Saha Operasyonu ve Rapor Yönetimi",
  description: "Montaj atamalarını, saha kayıtlarını, müşteri onaylarını ve PDF/Excel raporlarını tek kurumsal çalışma alanında yönetin.",
  openGraph: {
    title: "Operasyon Portalı — Saha Operasyonu ve Rapor Yönetimi",
    description: "Atamadan imzalı rapora kadar saha işini tek organizasyon kaydında yönetin. Mobil ve masaüstü çalışma alanı.",
    type: "website"
  },
  twitter: { card: "summary_large_image" }
};

export default function MarketingHomePage() {
  return <SourceLanding />;
}
