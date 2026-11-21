import type { Metadata } from "next";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingNavbar } from "@/components/landing/landing-navbar";

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
    </div>
  );
}
