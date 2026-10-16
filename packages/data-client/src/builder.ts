import {
  parseFilterValue,
  parseOrFilter,
  type ColumnFilter,
  type FilterOperator,
  type JsonValue,
  type QueryResult,
  type QuerySpec
} from "./spec";

/** Sorgu sonucunu yurutur. Tarayicida /api/data'ya istek atar, server'da dogrudan PostgreSQL'e gider. */
export type QueryTransport = (spec: QuerySpec) => Promise<QueryResult<unknown>>;

// Sema tipleri uretilmedigi icin satirlar dinamik tiplenir; cagiran taraf beklenen tipe daraltir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type MutationValues = Record<string, unknown> | Record<string, unknown>[];

function toJsonValue(value: unknown): JsonValue {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function toJsonRecord(values: Record<string, unknown>): Record<string, JsonValue> {
  const record: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) record[key] = toJsonValue(value);
  }
  return record;
}

export class QueryBuilder<Result = Row[]> implements PromiseLike<QueryResult<Result>> {
  private readonly spec: QuerySpec;

  constructor(private readonly transport: QueryTransport, table: string) {
    this.spec = { table, action: "select", filters: [], order: [] };
  }

  select(columns = "*", options: { count?: "exact"; head?: boolean } = {}): QueryBuilder<Result> {
    this.spec.columns = columns.replace(/\s+/g, "");
    if (options.count) this.spec.count = options.count;
    if (options.head) this.spec.head = true;
    return this;
  }

  insert(values: MutationValues): QueryBuilder<Result> {
    this.spec.action = "insert";
    this.setValues(values);
    return this;
  }

  upsert(values: MutationValues, options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): QueryBuilder<Result> {
    this.spec.action = "upsert";
    this.setValues(values);
    if (options.onConflict) this.spec.onConflict = options.onConflict.replace(/\s+/g, "");
    if (options.ignoreDuplicates) this.spec.ignoreDuplicates = true;
    return this;
  }

  update(values: Record<string, unknown>): QueryBuilder<Result> {
    this.spec.action = "update";
    this.setValues(values);
    return this;
  }

  delete(): QueryBuilder<Result> {
    this.spec.action = "delete";
    return this;
  }

  eq(column: string, value: unknown) { return this.addFilter(column, "eq", value); }
  neq(column: string, value: unknown) { return this.addFilter(column, "neq", value); }
  gt(column: string, value: unknown) { return this.addFilter(column, "gt", value); }
  gte(column: string, value: unknown) { return this.addFilter(column, "gte", value); }
  lt(column: string, value: unknown) { return this.addFilter(column, "lt", value); }
  lte(column: string, value: unknown) { return this.addFilter(column, "lte", value); }
  like(column: string, pattern: string) { return this.addFilter(column, "like", pattern); }
  ilike(column: string, pattern: string) { return this.addFilter(column, "ilike", pattern); }
  is(column: string, value: null | boolean) { return this.addFilter(column, "is", value); }
  in(column: string, values: readonly unknown[]) { return this.addFilter(column, "in", [...values]); }
  contains(column: string, value: unknown) { return this.addFilter(column, "cs", value); }
  containedBy(column: string, value: unknown) { return this.addFilter(column, "cd", value); }

  match(query: Record<string, unknown>): QueryBuilder<Result> {
    for (const [column, value] of Object.entries(query)) this.addFilter(column, "eq", value);
    return this;
  }

  not(column: string, operator: FilterOperator, value: unknown): QueryBuilder<Result> {
    return this.addFilter(column, operator, value, true);
  }

  /** PostgREST bicimindeki operator/deger ciftiyle filtre: `.filter("status", "in", "(A,B)")`. */
  filter(column: string, operator: FilterOperator, value: unknown): QueryBuilder<Result> {
    const parsed = typeof value === "string" ? parseFilterValue(operator, value) : value;
    return this.addFilter(column, operator, parsed);
  }

  or(expression: string): QueryBuilder<Result> {
    this.spec.filters.push(parseOrFilter(expression));
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): QueryBuilder<Result> {
    const order: QuerySpec["order"][number] = { column, ascending: options.ascending ?? true };
    if (options.nullsFirst !== undefined) order.nullsFirst = options.nullsFirst;
    this.spec.order.push(order);
    return this;
  }

  limit(count: number): QueryBuilder<Result> {
    this.spec.limit = count;
    return this;
  }

  range(from: number, to: number): QueryBuilder<Result> {
    this.spec.offset = from;
    this.spec.limit = to - from + 1;
    return this;
  }

  single(): QueryBuilder<Row> {
    this.spec.cardinality = "one";
    return this as unknown as QueryBuilder<Row>;
  }

  maybeSingle(): QueryBuilder<Row | null> {
    this.spec.cardinality = "maybe";
    return this as unknown as QueryBuilder<Row | null>;
  }

  /** Test ve hata ayiklama icin uretilen tanimin kopyasi. */
  toSpec(): QuerySpec {
    return structuredClone(this.spec);
  }

  then<TResult1 = QueryResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<QueryResult<Result>> {
    try {
      return await this.transport(this.toSpec()) as QueryResult<Result>;
    } catch (error) {
      return {
        data: null as Result,
        error: {
          message: error instanceof Error ? error.message : "Sorgu calistirilamadi.",
          code: "transport_error"
        },
        count: null,
        status: 0
      };
    }
  }

  private setValues(values: MutationValues) {
    this.spec.values = Array.isArray(values) ? values.map(toJsonRecord) : toJsonRecord(values);
  }

  private addFilter(column: string, operator: FilterOperator, value: unknown, negate = false): QueryBuilder<Result> {
    const filter: ColumnFilter = { kind: "column", column, operator, value: toJsonValue(value) };
    if (negate) filter.negate = true;
    this.spec.filters.push(filter);
    return this;
  }
}

export function createQueryClient(transport: QueryTransport) {
  return {
    from(table: string) {
      return new QueryBuilder(transport, table);
    }
  };
}
