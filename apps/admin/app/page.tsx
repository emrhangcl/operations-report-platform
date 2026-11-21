import type { Metadata } from "next";
import { MinimalFooter } from "@/components/21st/minimal-footer";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingPricing } from "@/components/landing/landing-pricing";

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

// Bolumler kaynak sitelerden secildi: Aceternity Resizable Navbar + Container Scroll, Aceternity
// features-section-demo-2, 21st.dev Pricing Section ve Minimal Footer.
export default function MarketingHomePage() {
  return (
    <div className="relative min-h-svh w-full bg-neutral-100 font-sans text-black antialiased" data-ui="v2">
      <LandingNavbar />
      <LandingHero />
      <section id="ozellikler">
        <LandingFeatures />
      </section>
      <section id="fiyatlar">
        <LandingPricing />
      </section>
      <div id="iletisim" className="mt-20">
        <MinimalFooter />
      </div>
    </div>
  );
}
