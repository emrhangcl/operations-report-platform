import "server-only";

import type { QueryAction, QuerySpec } from "@operations/data-client";
import { z } from "zod";

// Tarayici/mobil istemcinin veri gecidi uzerinden erisebilecegi tablolar ve islemler.
// Asil yetkilendirme PostgreSQL rolleri ve RLS ile yapilir; bu liste saldiri yuzeyini daraltan
// ek bir katmandir. Listede olmayan tablo ya da islem veritabanina hic ulasmaz.
const clientTablePolicy: Record<string, { actions: readonly QueryAction[]; anonymousSelect?: boolean }> = {
  belts: { actions: ["select", "insert", "update"] },
  companies: { actions: ["select", "insert", "update"] },
  company_lines: { actions: ["select", "insert", "update", "delete"] },
  equipment: { actions: ["select"] },
  installation_assignments: { actions: ["select", "insert", "update", "delete"] },
  invoices: { actions: ["select"] },
  organization_members: { actions: ["select"] },
  organizations: { actions: ["select"] },
  payments: { actions: ["select"] },
  plans: { actions: ["select"], anonymousSelect: true },
  profiles: { actions: ["select", "update"] },
  report_personnel: { actions: ["select", "insert", "delete"] },
  report_photos: { actions: ["select", "insert", "update", "delete"] },
  report_process_actions: { actions: ["select", "insert", "update", "delete"] },
  report_process_types: { actions: ["select", "insert", "update", "delete"] },
  reports: { actions: ["select", "insert", "update", "upsert"] },
  subscriptions: { actions: ["select"] },
  vehicles: { actions: ["select", "insert", "update", "delete"] }
};

export function isClientOperationAllowed(spec: QuerySpec, authenticated: boolean) {
  const policy = clientTablePolicy[spec.table];
  if (!policy || !policy.actions.includes(spec.action)) return false;
  if (!authenticated) return spec.action === "select" && policy.anonymousSelect === true;
  return true;
}

const identifier = z.string().regex(/^[a-z_][a-z0-9_]{0,62}$/);
const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string().max(10_000), z.number(), z.boolean(), z.null(), z.array(jsonValue).max(1000), z.record(jsonValue)])
);
const operator = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "cs", "cd"]);
const columnFilter = z.object({
  kind: z.literal("column"),
  column: identifier,
  operator,
  value: jsonValue,
  negate: z.boolean().optional()
}).strict();
const filter = z.union([
  columnFilter,
  z.object({ kind: z.literal("or"), filters: z.array(columnFilter).min(1).max(20) }).strict()
]);
const row = z.record(identifier, jsonValue);

export const querySpecSchema = z.object({
  table: identifier,
  action: z.enum(["select", "insert", "update", "upsert", "delete"]),
  columns: z.string().max(2000).regex(/^[a-z0-9_*,()!]*$/).optional(),
  filters: z.array(filter).max(50),
  order: z.array(z.object({
    column: identifier,
    ascending: z.boolean(),
    nullsFirst: z.boolean().optional()
  }).strict()).max(10),
  limit: z.number().int().min(0).max(1000).optional(),
  offset: z.number().int().min(0).max(1_000_000).optional(),
  cardinality: z.enum(["many", "one", "maybe"]).optional(),
  count: z.literal("exact").optional(),
  head: z.boolean().optional(),
  values: z.union([row, z.array(row).max(500)]).optional(),
  onConflict: z.string().max(200).regex(/^[a-z_][a-z0-9_]*(,[a-z_][a-z0-9_]*)*$/).optional(),
  ignoreDuplicates: z.boolean().optional()
}).strict();
