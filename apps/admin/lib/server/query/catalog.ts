import "server-only";

import type pg from "pg";

export interface ColumnInfo {
  name: string;
  /** Tam nitelikli PostgreSQL tipi (or. `text[]`, `jsonb`, `public.report_status`). */
  type: string;
  isArray: boolean;
  isJson: boolean;
}

export interface Relation {
  constraint: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
}

export interface TableInfo {
  name: string;
  columns: Map<string, ColumnInfo>;
  primaryKey: string[];
}

export interface Catalog {
  schema: string;
  tables: Map<string, TableInfo>;
  relations: Relation[];
}

const CATALOG_TTL_MS = process.env.NODE_ENV === "production" ? Number.POSITIVE_INFINITY : 30_000;

const globalForCatalog = globalThis as typeof globalThis & {
  __operationsCatalog?: { loadedAt: number; catalog: Promise<Catalog> };
};

async function readCatalog(client: pg.PoolClient | pg.Pool, schema: string): Promise<Catalog> {
  const columns = await client.query<{ table_name: string; column_name: string; type: string; is_array: boolean; is_json: boolean }>(
    `select c.relname as table_name,
            a.attname as column_name,
            case when et.oid is not null
                   then quote_ident(etn.nspname) || '.' || quote_ident(et.typname) || '[]'
                 when tn.nspname = 'pg_catalog'
                   then format_type(a.atttypid, a.atttypmod)
                 else quote_ident(tn.nspname) || '.' || quote_ident(t.typname)
            end as type,
            t.typcategory = 'A' as is_array,
            t.typname in ('json', 'jsonb') as is_json
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
       join pg_type t on t.oid = a.atttypid
       join pg_namespace tn on tn.oid = t.typnamespace
       left join pg_type et on et.oid = t.typelem and t.typcategory = 'A' and et.typtype = 'e'
       left join pg_namespace etn on etn.oid = et.typnamespace
      where n.nspname = $1 and c.relkind in ('r', 'p', 'v', 'm')
      order by c.relname, a.attnum`,
    [schema]
  );

  const keys = await client.query<{ table_name: string; columns: string[] }>(
    `select c.relname as table_name,
            array(select a.attname::text
                    from unnest(con.conkey) with ordinality as k(attnum, ord)
                    join pg_attribute a on a.attrelid = c.oid and a.attnum = k.attnum
                   order by k.ord) as columns
       from pg_constraint con
       join pg_class c on c.oid = con.conrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and con.contype = 'p'`,
    [schema]
  );

  const foreignKeys = await client.query<{ constraint_name: string; from_table: string; to_table: string; from_columns: string[]; to_columns: string[] }>(
    `select con.conname as constraint_name,
            src.relname as from_table,
            dst.relname as to_table,
            array_agg(sa.attname::text order by k.ord) as from_columns,
            array_agg(da.attname::text order by k.ord) as to_columns
       from pg_constraint con
       join pg_class src on src.oid = con.conrelid
       join pg_namespace sn on sn.oid = src.relnamespace
       join pg_class dst on dst.oid = con.confrelid
       join pg_namespace dn on dn.oid = dst.relnamespace
       cross join lateral unnest(con.conkey, con.confkey) with ordinality as k(src_att, dst_att, ord)
       join pg_attribute sa on sa.attrelid = src.oid and sa.attnum = k.src_att
       join pg_attribute da on da.attrelid = dst.oid and da.attnum = k.dst_att
      where con.contype = 'f' and sn.nspname = $1 and dn.nspname = $1
      group by con.conname, src.relname, dst.relname`,
    [schema]
  );

  const tables = new Map<string, TableInfo>();
  for (const row of columns.rows) {
    let table = tables.get(row.table_name);
    if (!table) {
      table = { name: row.table_name, columns: new Map(), primaryKey: [] };
      tables.set(row.table_name, table);
    }
    table.columns.set(row.column_name, {
      name: row.column_name,
      type: row.type,
      isArray: row.is_array,
      isJson: row.is_json
    });
  }
  for (const row of keys.rows) {
    const table = tables.get(row.table_name);
    if (table) table.primaryKey = row.columns;
  }

  return {
    schema,
    tables,
    relations: foreignKeys.rows.map((row) => ({
      constraint: row.constraint_name,
      fromTable: row.from_table,
      fromColumns: row.from_columns,
      toTable: row.to_table,
      toColumns: row.to_columns
    }))
  };
}

export function getCatalog(pool: pg.Pool): Promise<Catalog> {
  const cached = globalForCatalog.__operationsCatalog;
  if (cached && Date.now() - cached.loadedAt < CATALOG_TTL_MS) return cached.catalog;

  const catalog = readCatalog(pool, "public");
  globalForCatalog.__operationsCatalog = { loadedAt: Date.now(), catalog };
  catalog.catch(() => {
    if (globalForCatalog.__operationsCatalog?.catalog === catalog) delete globalForCatalog.__operationsCatalog;
  });
  return catalog;
}

export { readCatalog };
