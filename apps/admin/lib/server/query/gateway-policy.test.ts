import type { QuerySpec } from "@operations/data-client";
import { describe, expect, it } from "vitest";
import { isClientOperationAllowed, querySpecSchema } from "./gateway-policy";

const base: QuerySpec = { table: "companies", action: "select", filters: [], order: [] };

describe("client gateway policy", () => {
  it("allows only allow-listed tables and actions", () => {
    expect(isClientOperationAllowed(base, true)).toBe(true);
    expect(isClientOperationAllowed({ ...base, action: "delete" }, true)).toBe(false);
    expect(isClientOperationAllowed({ ...base, table: "payment_events" }, true)).toBe(false);
    expect(isClientOperationAllowed({ ...base, table: "audit_logs" }, true)).toBe(false);
  });

  it("lets anonymous visitors read public plans only", () => {
    expect(isClientOperationAllowed({ ...base, table: "plans" }, false)).toBe(true);
    expect(isClientOperationAllowed(base, false)).toBe(false);
    expect(isClientOperationAllowed({ ...base, table: "plans", action: "insert" }, false)).toBe(false);
  });

  it("rejects malformed or oversized specs before they reach SQL", () => {
    expect(querySpecSchema.safeParse(base).success).toBe(true);
    expect(querySpecSchema.safeParse({ ...base, table: "auth.users" }).success).toBe(false);
    expect(querySpecSchema.safeParse({ ...base, columns: "id; drop table x" }).success).toBe(false);
    expect(querySpecSchema.safeParse({ ...base, limit: 5000 }).success).toBe(false);
    expect(querySpecSchema.safeParse({ ...base, unexpected: true }).success).toBe(false);
    expect(querySpecSchema.safeParse({ ...base, filters: Array.from({ length: 51 }, () => ({ kind: "column", column: "id", operator: "eq", value: 1 })) }).success).toBe(false);
  });
});
