import { z } from "zod";

export const organizationDeletionSchema = z.object({
  confirmationSlug: z.string().trim().min(1).max(120),
  confirmDeletion: z.literal(true)
}).strict();
