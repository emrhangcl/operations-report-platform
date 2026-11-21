import type { Metadata } from "next";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { LandingWorkflow } from "@/components/landing/landing-workflow";

// Yeni ana sayfanin bolum bolum kuruldugu onizleme. Tum bolumler secilince "/" bununla degisir.
export const metadata: Metadata = {
  title: "Yeni ana sayfa (önizleme)",
  robots: { index: false, follow: false }
};

export default function NewLandingPreviewPage() {
  return (
    <div className="relative min-h-svh w-full bg-neutral-100 font-sans text-black antialiased" data-ui="v2">
      <LandingNavbar />
      <LandingHero />
      <section id="ozellikler">
        <LandingFeatures />
      </section>
      <section id="is-akisi">
        <LandingWorkflow />
      </section>
    </div>
  );
}
