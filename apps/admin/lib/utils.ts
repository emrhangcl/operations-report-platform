import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn/ui bilesenlerinin sinif birlestiricisi. Eski `components/ui/utils.ts` icindeki
// `cn` eski sayfalara aittir; v2 (shadcn) bilesenleri yalnizca bunu kullanir.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
