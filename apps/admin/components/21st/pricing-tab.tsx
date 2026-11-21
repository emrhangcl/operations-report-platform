"use client"
// 21st.dev "Pricing Section" (aymanch-03, MIT) — https://21st.dev/@aymanch-03/components/pricing-section
// Orijinal kod. Farklar: framer-motion yerine ayni API'li motion/react; indirim rozetinin metni
// dis bilesenden gelir (orijinalde sabit "Save 35%"), yoksa rozet gosterilmez.

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/shadcn/badge"

interface TabProps {
  text: string
  label?: string | undefined
  selected: boolean
  setSelected: (text: string) => void
  discount?: string | null
}

export function Tab({
  text,
  label,
  selected,
  setSelected,
  discount = null,
}: TabProps) {
  return (
    <button
      onClick={() => setSelected(text)}
      className={cn(
        "relative w-fit px-4 py-2 text-sm font-semibold capitalize",
        "text-foreground transition-colors",
        discount && "flex items-center justify-center gap-2.5"
      )}
    >
      <span className="relative z-10">{label ?? text}</span>
      {selected && (
        <motion.span
          layoutId="tab"
          transition={{ type: "spring", duration: 0.4 }}
          className="absolute inset-0 z-0 rounded-full bg-background shadow-sm"
        />
      )}
      {discount && (
        <Badge
          variant="secondary"
          className={cn(
            "relative z-10 whitespace-nowrap shadow-none",
            selected && "bg-muted"
          )}
        >
          {discount}
        </Badge>
      )}
    </button>
  )
}
