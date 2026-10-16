import "server-only";

import type { ColumnFilter, Filter, JsonValue, QuerySpec } from "@operations/data-client";
import type { Catalog, ColumnInfo, Relation, TableInfo } from "./catalog";

// QuerySpec -> parametreli SQL. Tum tanimlayicilar katalogdan dogrulanir ve tirnaklanir; kullanici
// degerleri yalnizca $n parametresi olarak gecer. Sonuclar PostgREST ile ayni JSON bicimindedir.

export class QueryCompileError extends Error {
  readonly code = "query_invalid";
}

export interface CompiledStatement {
  text: string;
  values: unknown[];
}

export interface CompiledQuery {
  data: CompiledStatement | null;
  count: CompiledStatement | null;
  returnsRows: boolean;
}

export interface CompileOptions {
  /** Istemciden gelen select sorgulari icin ust satir siniri. */
  maxRows?: number;
}

interface Projection {
  star: boolean;
  columns: string[];
  embeds: Embed[];
}

interface Embed {
  name: string;
  hint?: string;
  projection: Projection;
}

const identifierPattern = /^[a-z_][a-z0-9_]{0,62}$/;
const MAX_EMBED_DEPTH = 3;

function quoteIdent(name: string) {
  if (!identifierPattern.test(name)) throw new QueryCompileError(`Gecersiz tanimlayici: ${name}`);
  return `"${name}"`;
}

class Params {
  readonly values: unknown[] = [];

  add(value: unknown) {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth < 0) throw new QueryCompileError("Kolon listesinde dengesiz parantez.");
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (depth !== 0) throw new QueryCompileError("Kolon listesinde dengesiz parantez.");
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function parseProjection(columns: string, depth = 0): Projection {
  if (depth > MAX_EMBED_DEPTH) throw new QueryCompileError("Iliskili kayit derinligi asildi.");
  const projection: Projection = { star: false, columns: [], embeds: [] };

  for (const item of splitTopLevel(columns.replace(/\s+/g, ""))) {
    if (item === "*") {
      projection.star = true;
      continue;
    }
    const embedMatch = /^([a-z_][a-z0-9_]*)(?:!([a-z_][a-z0-9_]*))?\((.*)\)$/.exec(item);
    if (embedMatch) {
      const [, name, hint, inner] = embedMatch;
      const embed: Embed = { name: name as string, projection: parseProjection(inner || "*", depth + 1) };
      if (hint) embed.hint = hint;
      projection.embeds.push(embed);
      continue;
    }
    if (!identifierPattern.test(item)) throw new QueryCompileError(`Gecersiz kolon: ${item}`);
    projection.columns.push(item);
  }

  return projection;
}

function requireTable(catalog: Catalog, name: string): TableInfo {
  const table = catalog.tables.get(name);
  if (!table) throw new QueryCompileError(`Bilinmeyen tablo: ${name}`);
  return table;
}

function requireColumn(table: TableInfo, name: string): ColumnInfo {
  const column = table.columns.get(name);
  if (!column) throw new QueryCompileError(`${table.name} tablosunda bilinmeyen kolon: ${name}`);
  return column;
}

function qualified(catalog: Catalog, table: TableInfo) {
  return `${quoteIdent(catalog.schema)}.${quoteIdent(table.name)}`;
}

function resolveEmbed(catalog: Catalog, parent: TableInfo, embed: Embed) {
  const child = requireTable(catalog, embed.name);
  const matchesHint = (relation: Relation, columns: string[]) =>
    !embed.hint || relation.constraint === embed.hint || (columns.length === 1 && columns[0] === embed.hint);

  const toMany = catalog.relations.filter((relation) =>
    relation.fromTable === child.name && relation.toTable === parent.name && matchesHint(relation, relation.fromColumns));
  const toOne = catalog.relations.filter((relation) =>
    relation.fromTable === parent.name && relation.toTable === child.name && matchesHint(relation, relation.fromColumns));

  const candidates = [
    ...toMany.map((relation) => ({ relation, many: true })),
    ...toOne.map((relation) => ({ relation, many: false }))
  ];
  if (candidates.length === 0) throw new QueryCompileError(`${parent.name} ile ${child.name} arasinda iliski yok.`);
  if (candidates.length > 1) throw new QueryCompileError(`${parent.name} -> ${child.name} iliskisi belirsiz; ipucu kullanin.`);
  return { child, ...(candidates[0] as { relation: Relation; many: boolean }) };
}

function rowJson(catalog: Catalog, table: TableInfo, alias: string, projection: Projection, aliasCounter: { next: number }): string {
  const parts: string[] = [];

  if (projection.star) {
    parts.push(`to_jsonb(${alias})`);
  }
  if (projection.columns.length > 0) {
    const pairs = projection.columns.map((name) => {
      requireColumn(table, name);
      return `'${name}', ${alias}.${quoteIdent(name)}`;
    });
    for (let index = 0; index < pairs.length; index += 40) {
      parts.push(`jsonb_build_object(${pairs.slice(index, index + 40).join(", ")})`);
    }
  }

  for (const embed of projection.embeds) {
    const { child, relation, many } = resolveEmbed(catalog, table, embed);
    const childAlias = `t${aliasCounter.next++}`;
    const childJson = rowJson(catalog, child, childAlias, embed.projection, aliasCounter);
    const join = relation.fromColumns.map((fromColumn, index) => {
      const toColumn = relation.toColumns[index] as string;
      return many
        ? `${childAlias}.${quoteIdent(fromColumn)} = ${alias}.${quoteIdent(toColumn)}`
        : `${childAlias}.${quoteIdent(toColumn)} = ${alias}.${quoteIdent(fromColumn)}`;
    }).join(" and ");
    const source = `${qualified(catalog, child)} as ${childAlias}`;
    const value = many
      ? `coalesce((select jsonb_agg(${childJson}) from ${source} where ${join}), '[]'::jsonb)`
      : `(select ${childJson} from ${source} where ${join} limit 1)`;
    parts.push(`jsonb_build_object('${embed.name}', ${value})`);
  }

  return parts.length === 0 ? "'{}'::jsonb" : parts.join(" || ");
}

function isScalar(value: JsonValue): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function compileColumnFilter(filter: ColumnFilter, table: TableInfo, alias: string, params: Params): string {
  const column = requireColumn(table, filter.column);
  const ref = `${alias}.${quoteIdent(column.name)}`;
  let expression: string;

  switch (filter.operator) {
    case "eq":
    case "neq":
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const operators = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const;
      if (filter.value === null && (filter.operator === "eq" || filter.operator === "neq")) {
        expression = `${ref} is ${filter.operator === "eq" ? "" : "not "}null`;
        break;
      }
      if (column.isJson) {
        expression = `${ref} ${operators[filter.operator]} ${params.add(JSON.stringify(filter.value))}::jsonb`;
        break;
      }
      if (!isScalar(filter.value)) throw new QueryCompileError(`${column.name} icin karsilastirma degeri gecersiz.`);
      expression = `${ref} ${operators[filter.operator]} ${params.add(filter.value)}::${column.type}`;
      break;
    }
    case "like":
    case "ilike":
      if (typeof filter.value !== "string") throw new QueryCompileError("like/ilike desen metin olmalidir.");
      expression = `${ref}::text ${filter.operator} ${params.add(filter.value)}`;
      break;
    case "is":
      if (filter.value === null) expression = `${ref} is null`;
      else if (filter.value === true) expression = `${ref} is true`;
      else if (filter.value === false) expression = `${ref} is false`;
      else throw new QueryCompileError("is filtresi yalnizca null, true veya false alir.");
      break;
    case "in": {
      if (!Array.isArray(filter.value) || !filter.value.every((item) => item === null || isScalar(item))) {
        throw new QueryCompileError("in filtresi skaler degerlerden olusan liste gerektirir.");
      }
      if (column.isArray || column.isJson) throw new QueryCompileError(`${column.name} kolonu in filtresini desteklemez.`);
      expression = filter.value.length === 0
        ? "false"
        : `${ref} = any(${params.add(filter.value.map((item) => (item === null ? null : String(item))))}::${column.type}[])`;
      break;
    }
    case "cs":
    case "cd": {
      const operator = filter.operator === "cs" ? "@>" : "<@";
      if (column.isJson) {
        expression = `${ref} ${operator} ${params.add(JSON.stringify(filter.value))}::jsonb`;
      } else if (column.isArray) {
        if (!Array.isArray(filter.value)) throw new QueryCompileError("Dizi kolonlari icin icerme degeri liste olmalidir.");
        expression = `${ref} ${operator} ${params.add(filter.value.map((item) => (item === null ? null : String(item))))}::${column.type}`;
      } else {
        throw new QueryCompileError(`${column.name} kolonu icerme filtresini desteklemez.`);
      }
      break;
    }
    default:
      throw new QueryCompileError("Desteklenmeyen filtre operatoru.");
  }

  return filter.negate ? `not (${expression})` : expression;
}

function compileWhere(filters: Filter[], table: TableInfo, alias: string, params: Params): string {
  if (filters.length === 0) return "";
  const clauses = filters.map((filter) => {
    if (filter.kind === "or") {
      return `(${filter.filters.map((inner) => compileColumnFilter(inner, table, alias, params)).join(" or ")})`;
    }
    return compileColumnFilter(filter, table, alias, params);
  });
  return ` where ${clauses.join(" and ")}`;
}

function compileOrder(spec: QuerySpec, table: TableInfo, alias: string) {
  if (spec.order.length === 0) return "";
  return ` order by ${spec.order.map((order) => {
    requireColumn(table, order.column);
    const nulls = order.nullsFirst === undefined ? "" : order.nullsFirst ? " nulls first" : " nulls last";
    return `${alias}.${quoteIdent(order.column)} ${order.ascending ? "asc" : "desc"}${nulls}`;
  }).join(", ")}`;
}

function nonNegativeInteger(value: number | undefined, name: string) {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) throw new QueryCompileError(`${name} negatif olmayan tamsayi olmalidir.`);
  return value;
}

function mutationRows(spec: QuerySpec, table: TableInfo) {
  const rows = spec.values === undefined ? [] : Array.isArray(spec.values) ? spec.values : [spec.values];
  if (rows.length === 0) throw new QueryCompileError("Yazma islemi icin deger gerekli.");
  if (rows.length > 1000) throw new QueryCompileError("Tek istekte en fazla 1000 kayit yazilabilir.");
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length === 0) throw new QueryCompileError("Yazilacak kolon bulunamadi.");
  for (const column of columns) requireColumn(table, column);
  return { rows, columns };
}

export function compileQuery(spec: QuerySpec, catalog: Catalog, options: CompileOptions = {}): CompiledQuery {
  const table = requireTable(catalog, spec.table);
  const source = `${qualified(catalog, table)} as t0`;
  const aliasCounter = { next: 1 };
  const projection = spec.columns === undefined ? null : parseProjection(spec.columns);
  const returning = projection && spec.action !== "select"
    ? ` returning ${rowJson(catalog, table, "t0", projection, aliasCounter)} as row`
    : "";

  if (spec.action === "select") {
    const selectProjection = projection ?? parseProjection("*");
    const params = new Params();
    const json = rowJson(catalog, table, "t0", selectProjection, aliasCounter);
    const where = compileWhere(spec.filters, table, "t0", params);
    const order = compileOrder(spec, table, "t0");

    let limit = nonNegativeInteger(spec.limit, "limit");
    const offset = nonNegativeInteger(spec.offset, "offset");
    if (limit === undefined && spec.cardinality && spec.cardinality !== "many") limit = 2;
    if (options.maxRows !== undefined) limit = Math.min(limit ?? options.maxRows, options.maxRows);
    const paging = `${limit === undefined ? "" : ` limit ${limit}`}${offset ? ` offset ${offset}` : ""}`;

    let count: CompiledStatement | null = null;
    if (spec.count === "exact") {
      const countParams = new Params();
      const countWhere = compileWhere(spec.filters, table, "t0", countParams);
      count = { text: `select count(*) as count from ${source}${countWhere}`, values: countParams.values };
    }

    return {
      data: spec.head ? null : { text: `select ${json} as row from ${source}${where}${order}${paging}`, values: params.values },
      count,
      returnsRows: true
    };
  }

  if (spec.action === "insert" || spec.action === "upsert") {
    const { rows, columns } = mutationRows(spec, table);
    const params = new Params();
    const columnList = columns.map(quoteIdent).join(", ");
    const recordset = `jsonb_populate_recordset(null::${qualified(catalog, table)}, ${params.add(JSON.stringify(rows))}::jsonb)`;
    let conflict = "";

    if (spec.action === "upsert") {
      const conflictColumns = spec.onConflict ? spec.onConflict.split(",") : table.primaryKey;
      if (conflictColumns.length === 0) throw new QueryCompileError(`${table.name} icin cakisma kolonu belirlenemedi.`);
      for (const column of conflictColumns) requireColumn(table, column);
      const updates = columns.filter((column) => !conflictColumns.includes(column));
      conflict = spec.ignoreDuplicates || updates.length === 0
        ? ` on conflict (${conflictColumns.map(quoteIdent).join(", ")}) do nothing`
        : ` on conflict (${conflictColumns.map(quoteIdent).join(", ")}) do update set ${updates
          .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
          .join(", ")}`;
    }

    return {
      data: {
        text: `insert into ${source} (${columnList}) select ${columnList} from ${recordset}${conflict}${returning}`,
        values: params.values
      },
      count: null,
      returnsRows: Boolean(projection)
    };
  }

  if (spec.filters.length === 0) {
    throw new QueryCompileError("Filtresiz toplu guncelleme veya silme engellendi.");
  }

  if (spec.action === "update") {
    if (Array.isArray(spec.values)) throw new QueryCompileError("Guncelleme tek bir nesne almalidir.");
    const { rows, columns } = mutationRows(spec, table);
    const params = new Params();
    const record = `jsonb_populate_record(null::${qualified(catalog, table)}, ${params.add(JSON.stringify(rows[0]))}::jsonb) as _v`;
    const assignments = columns.map((column) => `${quoteIdent(column)} = _v.${quoteIdent(column)}`).join(", ");
    const where = compileWhere(spec.filters, table, "t0", params);
    return {
      data: { text: `update ${source} set ${assignments} from ${record}${where}${returning}`, values: params.values },
      count: null,
      returnsRows: Boolean(projection)
    };
  }

  if (spec.action === "delete") {
    const params = new Params();
    const where = compileWhere(spec.filters, table, "t0", params);
    return {
      data: { text: `delete from ${source}${where}${returning}`, values: params.values },
      count: null,
      returnsRows: Boolean(projection)
    };
  }

  throw new QueryCompileError("Desteklenmeyen islem.");
}
