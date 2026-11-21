"use client"
// 21st.dev "Pricing Section" (aymanch-03, MIT) — orijinal PricingSection. Fark: sekme etiketleri
// ve indirim rozeti disaridan verilir; 4'ten az kartta izgara daralip ortalanir.

import * as React from "react"
import { cn } from "@/lib/utils"
import { PricingCard, type PricingTier } from "@/components/21st/pricing-card"
import { Tab } from "@/components/21st/pricing-tab"

interface PricingSectionProps {
  title: string
  subtitle: string
  tiers: PricingTier[]
  frequencies: string[]
  frequencyLabels?: Record<string, string>
  discounts?: Record<string, string | null>
}

export function PricingSection({
  title,
  subtitle,
  tiers,
  frequencies,
  frequencyLabels,
  discounts,
}: PricingSectionProps) {
  const [selectedFrequency, setSelectedFrequency] = React.useState(frequencies[0] ?? "")

  return (
    <section className="flex flex-col items-center gap-10 py-10">
      <div className="space-y-7 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-medium md:text-5xl">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        <div className="mx-auto flex w-fit rounded-full bg-muted p-1">
          {frequencies.map((freq) => (
            <Tab
              key={freq}
              text={freq}
              label={frequencyLabels?.[freq]}
              selected={selectedFrequency === freq}
              setSelected={setSelectedFrequency}
              discount={discounts?.[freq] ?? null}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          "grid w-full gap-6",
          // Orijinal 4 sutun; daha az paket varken kartlar sola yigilmasin diye ortalanir.
          tiers.length <= 1 && "max-w-sm",
          tiers.length === 2 && "max-w-3xl sm:grid-cols-2",
          tiers.length === 3 && "max-w-5xl sm:grid-cols-2 lg:grid-cols-3",
          tiers.length >= 4 && "max-w-6xl sm:grid-cols-2 xl:grid-cols-4"
        )}
      >
        {tiers.map((tier) => (
          <PricingCard
            key={tier.id}
            tier={tier}
            paymentFrequency={selectedFrequency}
          />
        ))}
      </div>
    </section>
  )
}
