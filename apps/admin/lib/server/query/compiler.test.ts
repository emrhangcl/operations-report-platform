import type { QuerySpec } from "@operations/data-client";
import { describe, expect, it } from "vitest";
import type { Catalog, ColumnInfo, TableInfo } from "./catalog";
import { compileQuery, parseProjection, QueryCompileError } from "./compiler";

function column(name: string, type = "text", extra: Partial<ColumnInfo> = {}): ColumnInfo {
  return { name, type, isArray: false, isJson: false, ...extra };
}

function table(name: string, columns: ColumnInfo[], primaryKey = ["id"]): TableInfo {
  return { name, columns: new Map(columns.map((item) => [item.name, item])), primaryKey };
}

const catalog: Catalog = {
  schema: "public",
  tables: new Map([
    ["reports", table("reports", [
      column("id", "uuid"),
      column("status", "public.report_status"),
      column("company_id", "uuid"),
      column("work_items", "jsonb", { isJson: true }),
      column("product_types", "text[]", { isArray: true }),
      column("created_at", "timestamp with time zone")
    ])],
    ["report_photos", table("report_photos", [column("id", "uuid"), column("report_id", "uuid"), column("caption")])],
    ["companies", table("companies", [column("id", "uuid"), column("name")])],
    ["plans", table("plans", [column("id", "uuid"), column("code"), column("name")])],
    ["subscriptions", table("subscriptions", [column("id", "uuid"), column("plan_id", "uuid")])]
  ]),
  relations: [
    { constraint: "report_photos_report_id_fkey", fromTable: "report_photos", fromColumns: ["report_id"], toTable: "reports", toColumns: ["id"] },
    { constraint: "reports_company_id_fkey", fromTable: "reports", fromColumns: ["company_id"], toTable: "companies", toColumns: ["id"] },
    { constraint: "subscriptions_plan_id_fkey", fromTable: "subscriptions", fromColumns: ["plan_id"], toTable: "plans", toColumns: ["id"] }
  ]
};

function spec(overrides: Partial<QuerySpec>): QuerySpec {
  return { table: "reports", action: "select", filters: [], order: [], ...overrides };
}

describe("compileQuery", () => {
  it("binds every user value as a typed parameter", () => {
    const compiled = compileQuery(spec({
      columns: "id,status",
      filters: [
        { kind: "column", column: "status", operator: "eq", value: "SUBMITTED" },
        { kind: "column", column: "id", operator: "in", value: ["a", "b"] }
      ],
      order: [{ column: "created_at", ascending: false }],
      limit: 10
    }), catalog);

    expect(compiled.data?.text).toBe(
      "select jsonb_build_object('id', t0.\"id\", 'status', t0.\"status\") as row from \"public\".\"reports\" as t0" +
      " where t0.\"status\" = $1::public.report_status and t0.\"id\" = any($2::uuid[]) order by t0.\"created_at\" desc limit 10"
    );
    expect(compiled.data?.values).toEqual(["SUBMITTED", ["a", "b"]]);
  });

  it("embeds one-to-many and many-to-one relations through foreign keys", () => {
    const toMany = compileQuery(spec({ columns: "*,report_photos(id,caption)" }), catalog).data?.text ?? "";
    expect(toMany).toContain("coalesce((select jsonb_agg(jsonb_build_object('id', t1.\"id\", 'caption', t1.\"caption\")) from \"public\".\"report_photos\" as t1 where t1.\"report_id\" = t0.\"id\"), '[]'::jsonb)");

    const toOne = compileQuery(spec({ table: "subscriptions", columns: "id,plans(name)" }), catalog).data?.text ?? "";
    expect(toOne).toContain("(select jsonb_build_object('name', t1.\"name\") from \"public\".\"plans\" as t1 where t1.\"id\" = t0.\"plan_id\" limit 1)");
  });

  it("uses jsonb and array containment according to the column type", () => {
    const compiled = compileQuery(spec({
      filters: [{
        kind: "or",
        filters: [
          { kind: "column", column: "work_items", operator: "cs", value: [{ belt_id: "x" }] },
          { kind: "column", column: "product_types", operator: "cs", value: ["A"] }
        ]
      }]
    }), catalog);
    expect(compiled.data?.text).toContain("(t0.\"work_items\" @> $1::jsonb or t0.\"product_types\" @> $2::text[])");
    expect(compiled.data?.values).toEqual(["[{\"belt_id\":\"x\"}]", ["A"]]);
  });

  it("rejects unknown tables, columns and malformed identifiers", () => {
    expect(() => compileQuery(spec({ table: "users" }), catalog)).toThrow(QueryCompileError);
    expect(() => compileQuery(spec({ columns: "id,secret" }), catalog)).toThrow(/bilinmeyen kolon/);
    expect(() => compileQuery(spec({ columns: "id;drop table reports" }), catalog)).toThrow(QueryCompileError);
    expect(() => compileQuery(spec({ order: [{ column: "created_at desc; --", ascending: true }] }), catalog)).toThrow(QueryCompileError);
    expect(() => parseProjection("id,report_photos(id")).toThrow(QueryCompileError);
  });

  it("refuses update and delete without a filter", () => {
    expect(() => compileQuery(spec({ action: "delete" }), catalog)).toThrow(/Filtresiz/);
    expect(() => compileQuery(spec({ action: "update", values: { status: "DRAFT" } }), catalog)).toThrow(/Filtresiz/);
  });

  it("caps client selects at the configured row limit", () => {
    expect(compileQuery(spec({}), catalog, { maxRows: 1000 }).data?.text).toMatch(/limit 1000$/);
    expect(compileQuery(spec({ limit: 5 }), catalog, { maxRows: 1000 }).data?.text).toMatch(/limit 5$/);
  });

  it("turns an empty in-list into a false predicate instead of invalid SQL", () => {
    const compiled = compileQuery(spec({ filters: [{ kind: "column", column: "id", operator: "in", value: [] }] }), catalog);
    expect(compiled.data?.text).toContain(" where false");
    expect(compiled.data?.values).toEqual([]);
  });

  it("writes rows through jsonb_populate_recordset and supports upsert", () => {
    const compiled = compileQuery(spec({
      table: "companies",
      action: "upsert",
      values: [{ id: "c1", name: "A" }],
      columns: "id"
    }), catalog);
    expect(compiled.data?.text).toBe(
      "insert into \"public\".\"companies\" as t0 (\"id\", \"name\") select \"id\", \"name\" from jsonb_populate_recordset(null::\"public\".\"companies\", $1::jsonb)" +
      " on conflict (\"id\") do update set \"name\" = excluded.\"name\" returning jsonb_build_object('id', t0.\"id\") as row"
    );
    expect(compiled.data?.values).toEqual(["[{\"id\":\"c1\",\"name\":\"A\"}]"]);
  });

  it("counts with the same filters in a separate statement", () => {
    const compiled = compileQuery(spec({
      count: "exact",
      head: true,
      filters: [{ kind: "column", column: "status", operator: "eq", value: "DRAFT" }]
    }), catalog);
    expect(compiled.data).toBeNull();
    expect(compiled.count).toEqual({
      text: "select count(*) as count from \"public\".\"reports\" as t0 where t0.\"status\" = $1::public.report_status",
      values: ["DRAFT"]
    });
  });
});
