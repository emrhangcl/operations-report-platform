// Istemci ile veri gecidi (/api/data) arasindaki sozlesme. Istemci yalnizca bu yapilandirilmis
// tanimi gonderir; SQL her zaman server tarafinda, katalogla dogrulanan tanimlayicilarla uretilir.

export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is" | "in" | "cs" | "cd";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface ColumnFilter {
  kind: "column";
  column: string;
  operator: FilterOperator;
  value: JsonValue;
  negate?: boolean;
}

export interface OrFilter {
  kind: "or";
  filters: ColumnFilter[];
}

export type Filter = ColumnFilter | OrFilter;

export interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst?: boolean;
}

export type QueryAction = "select" | "insert" | "update" | "upsert" | "delete";
export type QueryCardinality = "many" | "one" | "maybe";

export interface QuerySpec {
  table: string;
  action: QueryAction;
  /** select icin kolon listesi; mutasyonlarda yalnizca `.select()` cagrildiysa donen kolonlar. */
  columns?: string;
  filters: Filter[];
  order: OrderSpec[];
  limit?: number;
  offset?: number;
  cardinality?: QueryCardinality;
  count?: "exact";
  head?: boolean;
  values?: Record<string, JsonValue> | Record<string, JsonValue>[];
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface QueryError {
  message: string;
  code: string;
  details?: string;
  hint?: string;
}

export interface QueryResult<T> {
  data: T;
  error: QueryError | null;
  count: number | null;
  status: number;
}

export const filterOperators: readonly FilterOperator[] = [
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "cs", "cd"
];

function isFilterOperator(value: string): value is FilterOperator {
  return (filterOperators as readonly string[]).includes(value);
}

/** Virgulle ayrilmis listeyi parantez, koseli parantez, susluparantez ve tirnak icini bolmeden ayirir. */
function splitTopLevel(input: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] as string;
    if (char === "\"" && input[index - 1] !== "\\") quoted = !quoted;
    if (!quoted) {
      if (char === "(" || char === "[" || char === "{") depth += 1;
      if (char === ")" || char === "]" || char === "}") depth -= 1;
      if (char === separator && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (quoted || depth !== 0) throw new Error("Filtre ifadesi dengesiz parantez veya tirnak iceriyor.");
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function parseScalar(raw: string): JsonValue {
  if (raw.startsWith("\"") && raw.endsWith("\"") && raw.length >= 2) {
    return raw.slice(1, -1).replace(/\\"/g, "\"");
  }
  return raw;
}

/** PostgREST filtre degerini (string) yapilandirilmis degere cevirir. */
export function parseFilterValue(operator: FilterOperator, raw: string): JsonValue {
  if (operator === "is") {
    const normalized = raw.toLowerCase();
    if (normalized === "null") return null;
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    throw new Error(`'is' filtresi yalnizca null, true veya false alir: ${raw}`);
  }

  if (operator === "in") {
    if (!raw.startsWith("(") || !raw.endsWith(")")) throw new Error("'in' filtresi (a,b,c) biciminde olmalidir.");
    return splitTopLevel(raw.slice(1, -1)).map(parseScalar);
  }

  if (operator === "cs" || operator === "cd") {
    if (raw.startsWith("[") || raw.startsWith("{\"") || raw === "{}") {
      try {
        return JSON.parse(raw) as JsonValue;
      } catch {
        throw new Error("Icerme filtresi gecerli JSON olmalidir.");
      }
    }
    if (raw.startsWith("{") && raw.endsWith("}")) {
      return splitTopLevel(raw.slice(1, -1)).map(parseScalar);
    }
    throw new Error("Icerme filtresi JSON veya {a,b} biciminde olmalidir.");
  }

  return parseScalar(raw);
}

/** `kolon.operator.deger,kolon.not.operator.deger` bicimindeki PostgREST `or` ifadesini cozumler. */
export function parseOrFilter(expression: string): OrFilter {
  const filters = splitTopLevel(expression).map((part): ColumnFilter => {
    const firstDot = part.indexOf(".");
    if (firstDot <= 0) throw new Error(`Gecersiz filtre: ${part}`);
    const column = part.slice(0, firstDot);
    let rest = part.slice(firstDot + 1);
    let negate = false;

    if (rest.startsWith("not.")) {
      negate = true;
      rest = rest.slice(4);
    }

    const secondDot = rest.indexOf(".");
    if (secondDot <= 0) throw new Error(`Gecersiz filtre: ${part}`);
    const operator = rest.slice(0, secondDot);
    if (!isFilterOperator(operator)) throw new Error(`Desteklenmeyen filtre operatoru: ${operator}`);

    const filter: ColumnFilter = {
      kind: "column",
      column,
      operator,
      value: parseFilterValue(operator, rest.slice(secondDot + 1))
    };
    if (negate) filter.negate = true;
    return filter;
  });

  if (filters.length === 0) throw new Error("Bos 'or' filtresi.");
  return { kind: "or", filters };
}
