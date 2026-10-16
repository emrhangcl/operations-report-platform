import { describe, expect, it } from "vitest";
import { createQueryClient, parseOrFilter, type QuerySpec } from "./index";

function capture() {
  const specs: QuerySpec[] = [];
  const client = createQueryClient(async (spec) => {
    specs.push(spec);
    return { data: [], error: null, count: null, status: 200 };
  });
  return { client, specs };
}

describe("QueryBuilder", () => {
  it("builds a filtered, ordered select", async () => {
    const { client, specs } = capture();
    await client
      .from("companies")
      .select("id, name", { count: "exact" })
      .eq("is_active", true)
      .in("id", ["a", "b"])
      .order("created_at", { ascending: false })
      .range(10, 19);

    expect(specs[0]).toEqual({
      table: "companies",
      action: "select",
      columns: "id,name",
      count: "exact",
      filters: [
        { kind: "column", column: "is_active", operator: "eq", value: true },
        { kind: "column", column: "id", operator: "in", value: ["a", "b"] }
      ],
      order: [{ column: "created_at", ascending: false }],
      offset: 10,
      limit: 10
    });
  });

  it("builds an upsert that returns a single row", async () => {
    const { client, specs } = capture();
    await client
      .from("reports")
      .upsert({ client_request_id: "x", report_date: new Date("2026-01-02T00:00:00Z"), skipped: undefined }, { onConflict: "client_request_id" })
      .select("id")
      .single();

    expect(specs[0]).toMatchObject({
      action: "upsert",
      columns: "id",
      cardinality: "one",
      onConflict: "client_request_id",
      values: { client_request_id: "x", report_date: "2026-01-02T00:00:00.000Z" }
    });
    expect(specs[0]?.values).not.toHaveProperty("skipped");
  });

  it("supports negated filters", async () => {
    const { client, specs } = capture();
    await client.from("reports").select("id").not("customer_signature", "is", null);
    expect(specs[0]?.filters).toEqual([
      { kind: "column", column: "customer_signature", operator: "is", value: null, negate: true }
    ]);
  });

  it("returns a transport error instead of throwing", async () => {
    const client = createQueryClient(async () => {
      throw new Error("offline");
    });
    const result = await client.from("companies").select("*");
    expect(result.error).toEqual({ message: "offline", code: "transport_error" });
    expect(result.data).toBeNull();
  });
});

describe("parseOrFilter", () => {
  it("parses JSON containment without splitting inside the value", () => {
    const beltId = "6b0d7a3c-1d2e-4f5a-8b9c-0d1e2f3a4b5c";
    const parsed = parseOrFilter(`belt_id.eq.${beltId},work_items.cs.${JSON.stringify([{ belt_id: beltId, note: "a,b" }])}`);
    expect(parsed.filters).toEqual([
      { kind: "column", column: "belt_id", operator: "eq", value: beltId },
      { kind: "column", column: "work_items", operator: "cs", value: [{ belt_id: beltId, note: "a,b" }] }
    ]);
  });

  it("parses in-lists, is and negation", () => {
    expect(parseOrFilter("status.in.(DRAFT,\"SUB,MITTED\"),deleted_at.not.is.null").filters).toEqual([
      { kind: "column", column: "status", operator: "in", value: ["DRAFT", "SUB,MITTED"] },
      { kind: "column", column: "deleted_at", operator: "is", value: null, negate: true }
    ]);
  });

  it("rejects unknown operators and unbalanced input", () => {
    expect(() => parseOrFilter("name.regex.x")).toThrow();
    expect(() => parseOrFilter("work_items.cs.[{\"a\":1}")).toThrow();
  });
});
