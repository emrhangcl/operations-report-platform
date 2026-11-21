"use client";
// 21st.dev "pricing-section" demosu birebir (izgara arka plan + PricingSection). Paketler, fiyatlar
// ve indirim orani veritabanindaki yayinda olan paketlerden gelir; son siyah kart satis gorusmesi.
import { useEffect, useState } from "react";
import { PricingSection } from "@/components/21st/pricing-section";
import type { PricingTier } from "@/components/21st/pricing-card";
import { getBrowserClient } from "@/lib/browser-client";

type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  monthly_price_minor: number | null;
  yearly_price_minor: number | null;
};

export const PAYMENT_FREQUENCIES = ["monthly", "yearly"];
const FREQUENCY_LABELS = { monthly: "Aylık", yearly: "Yıllık" };

// Her pakette ayni yetenekler acik; paketler yalnizca fiyat ve donemle ayrisir.
const INCLUDED = [
  "Atama ve saha kaydı",
  "Müşteri imzası",
  "PDF ve Excel rapor",
  "Fotoğraf arşivi",
  "Masaüstü ve mobil erişim",
];

const SALES_TIER: PricingTier = {
  id: "kurumsal",
  name: "Kurumsal",
  price: { monthly: "Özel", yearly: "Özel" },
  priceNote: { monthly: "", yearly: "" },
  currency: "TRY",
  href: { monthly: "/contact", yearly: "/contact" },
  description: "Özel ihtiyaçlar için",
  features: ["Paketlerdeki tüm özellikler", "İhtiyaca göre fiyatlandırma", "Satış ekibiyle doğrudan görüşme"],
  cta: "Satış ile görüşün",
  highlighted: true,
};

function toTier(plan: PublicPlan, popular: boolean): PricingTier {
  const amount = (minor: number | null) => (minor === null ? "—" : minor / 100);
  return {
    id: plan.id,
    name: plan.name,
    price: { monthly: amount(plan.monthly_price_minor), yearly: amount(plan.yearly_price_minor) },
    priceNote: { monthly: "Aylık / firma", yearly: "Yıllık / firma" },
    currency: plan.currency,
    href: {
      monthly: `/register?plan=${plan.id}&interval=monthly`,
      yearly: `/register?plan=${plan.id}&interval=yearly`,
    },
    description: plan.description || "Firmanız için tüm özellikler",
    features: INCLUDED,
    cta: "Başlayın",
    popular,
  };
}

// Yillik odemenin 12 aylik odemeye gore en yuksek tasarrufu; hesaplanamiyorsa rozet yok.
function yearlyDiscount(plans: PublicPlan[]) {
  const rates = plans
    .filter((p) => p.monthly_price_minor && p.yearly_price_minor !== null)
    .map((p) => 1 - (p.yearly_price_minor as number) / ((p.monthly_price_minor as number) * 12));
  const best = Math.max(0, ...rates);
  return best >= 0.01 ? `%${Math.round(best * 100)} tasarruf` : null;
}

// Uc veya daha fazla pakette ortadaki paket onerilir (orijinaldeki vurgulu kart). Satis verisine
// dayanmadigi icin rozet "En populer" degil "Onerilen" der.
function recommendedIndex(count: number) {
  return count >= 3 ? Math.floor((count - 1) / 2) : -1;
}

export function LandingPricing() {
  const [plans, setPlans] = useState<PublicPlan[]>([]);

  useEffect(() => {
    const db = getBrowserClient();
    if (!db) return;
    db
      .from("plans")
      .select("id,name,description,currency,monthly_price_minor,yearly_price_minor")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("monthly_price_minor", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (!error) setPlans((data ?? []) as PublicPlan[]);
      });
  }, []);

  return (
    <div className="relative flex justify-center items-center w-full mt-20 scale-90">
      <div className="absolute inset-0 -z-10">
        <div className="h-full w-full bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:35px_35px] opacity-30 [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />
      </div>
      <PricingSection
        title="Sade Fiyatlandırma"
        subtitle="Firmanıza uygun paketi seçin"
        frequencies={PAYMENT_FREQUENCIES}
        frequencyLabels={FREQUENCY_LABELS}
        discounts={{ yearly: yearlyDiscount(plans) }}
        tiers={[...plans.map((plan, i) => toTier(plan, i === recommendedIndex(plans.length))), SALES_TIER]}
      />
    </div>
  );
}
