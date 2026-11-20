"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import type { OwnerTheme } from "@/lib/owner-theme";

export function OwnerThemeToggle({ theme, onToggle }: { theme: OwnerTheme; onToggle: () => void }) {
  const label = theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç";
  return (
    <Button aria-label={label} onClick={onToggle} size="icon" title={label} variant="ghost">
      {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
