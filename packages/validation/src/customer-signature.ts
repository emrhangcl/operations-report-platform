import { z } from "zod";

export const CUSTOMER_SIGNATURE_CONSENT = "Bu raporda belirtilen işlemleri ve teslim durumunu inceledim. Firma yetkilisi olarak teslim aldığımı onaylıyorum.";
export const signaturePointSchema = z.tuple([
  z.number().finite().min(0).max(600),
  z.number().finite().min(0).max(240)
]);

export const customerSignatureSchema = z.object({
  version: z.literal(1),
  signer_name: z.string().trim().min(2, "Yetkilinin adını ve soyadını yazın.").max(120),
  signer_title: z.string().trim().min(2, "Yetkilinin görevini / unvanını yazın.").max(120),
  consent: z.literal(true, { errorMap: () => ({ message: "Teslim onayını işaretleyin." }) }),
  strokes: z.array(z.array(signaturePointSchema).min(2, "İmza çok kısa. Lütfen yeniden imzalayın.").max(500, "İmza çok uzun. Temizleyip yeniden imzalayın.")).min(1, "Lütfen imza alanına imzanızı atın.").max(40, "İmza çok uzun. Temizleyip yeniden imzalayın.")
}).strict().superRefine((value, ctx) => {
  const count = value.strokes.reduce((sum, stroke) => sum + stroke.length, 0);
  const length = value.strokes.reduce((sum, stroke) => sum + stroke.slice(1).reduce((total, point, i) =>
    total + Math.hypot(point[0] - stroke[i]![0], point[1] - stroke[i]![1]), 0), 0);
  if (count > 2000 || length < 30) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["strokes"], message: count > 2000 ? "İmza çok uzun. Temizleyip yeniden imzalayın." : "İmza çok kısa. Lütfen yeniden imzalayın." });
  }
});

export type CustomerSignature = z.infer<typeof customerSignatureSchema>;
