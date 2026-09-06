import { z } from "zod";

export const planSchema = z.object({
  code: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable(),
  currency: z.enum(["TRY", "USD", "EUR"]),
  monthlyPriceMinor: z.number().int().min(0).nullable(),
  yearlyPriceMinor: z.number().int().min(0).nullable(),
  isActive: z.boolean(),
  isPublic: z.boolean()
}).strict();

export function planRow(values: z.infer<typeof planSchema>) {
  return {
    code: values.code,
    name: values.name,
    description: values.description || null,
    currency: values.currency,
    monthly_price_minor: values.monthlyPriceMinor,
    yearly_price_minor: values.yearlyPriceMinor,
    is_active: values.isActive,
    is_public: values.isPublic
  };
}
