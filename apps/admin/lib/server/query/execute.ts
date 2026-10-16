import "server-only";

import type { QueryError, QueryResult, QuerySpec } from "@operations/data-client";
import { getPool, withDbContext, type DbContext } from "../db";
import { getCatalog } from "./catalog";
import { compileQuery, QueryCompileError, type CompileOptions } from "./compiler";

class CardinalityError extends Error {
  constructor(readonly rows: number) {
    super(rows === 0 ? "Sonuc bulunamadi." : "Birden fazla satir dondu.");
  }
}

interface PgErrorLike {
  code?: string;
  message?: string;
  detail?: string;
  hint?: string;
}

function isPgError(error: unknown): error is PgErrorLike {
  return typeof error === "object" && error !== null && typeof (error as PgErrorLike).code === "string";
}

// Kullaniciya gosterilebilecek SQLSTATE siniflari: veri hatalari (22), butunluk ihlalleri (23),
// yetki ihlali (42501) ve trigger'larin bilincli olarak firlattigi is kurali hatalari (P0).
function exposesMessage(code: string) {
  return code.startsWith("22") || code.startsWith("23") || code === "42501" || code.startsWith("P0");
}

function statusFor(code: string) {
  if (code === "23505") return 409;
  if (code === "42501") return 403;
  if (code.startsWith("22") || code.startsWith("23") || code.startsWith("P0")) return 400;
  if (code === "57014") return 504;
  return 500;
}

export function toQueryError(error: unknown, exposeDetails: boolean): { error: QueryError; status: number } {
  if (error instanceof QueryCompileError) {
    return { error: { message: error.message, code: error.code }, status: 400 };
  }
  if (error instanceof CardinalityError) {
    return {
      error: { message: "Tek bir kayit bekleniyordu.", code: "PGRST116", details: `${error.rows} satir dondu.` },
      status: 406
    };
  }
  if (isPgError(error) && error.code) {
    const visible = exposeDetails || exposesMessage(error.code);
    if (!exposesMessage(error.code)) {
      // Istemciye genel mesaj donulur; ayrinti yalnizca sunucu gunlugune yazilir.
      console.error(JSON.stringify({ level: "error", event: "db_query_failed", code: error.code, message: error.message }));
    }
    const queryError: QueryError = {
      message: visible ? error.message ?? "Veritabani hatasi." : "Veritabani islemi tamamlanamadi.",
      code: error.code
    };
    if (visible && error.detail) queryError.details = error.detail;
    if (visible && error.hint) queryError.hint = error.hint;
    return { error: queryError, status: statusFor(error.code) };
  }
  console.error(JSON.stringify({
    level: "error",
    event: "db_query_failed",
    message: error instanceof Error ? error.message : String(error)
  }));
  return { error: { message: "Veritabani islemi tamamlanamadi.", code: "internal_error" }, status: 500 };
}

export interface ExecuteOptions extends CompileOptions {
  /** Server ici cagrilarda hata ayrintilarini korur; istemci gecidinde kapali tutulur. */
  exposeErrorDetails?: boolean;
}

export async function executeQuery(spec: QuerySpec, context: DbContext, options: ExecuteOptions = {}): Promise<QueryResult<unknown>> {
  try {
    const catalog = await getCatalog(getPool());
    const compiled = compileQuery(spec, catalog, options);

    return await withDbContext(context, async (client) => {
      const count = compiled.count
        ? Number((await client.query<{ count: number }>(compiled.count.text, compiled.count.values)).rows[0]?.count ?? 0)
        : null;

      if (!compiled.data) {
        return { data: null, error: null, count, status: 200 };
      }

      const result = await client.query<{ row: unknown }>(compiled.data.text, compiled.data.values);
      const status = spec.action === "insert" || spec.action === "upsert" ? 201 : 200;

      if (!compiled.returnsRows) {
        return { data: null, error: null, count, status: status === 201 ? 201 : 204 };
      }

      const rows = result.rows.map((row) => row.row);
      if (spec.cardinality === "one" || spec.cardinality === "maybe") {
        if (rows.length > 1 || (rows.length === 0 && spec.cardinality === "one")) {
          throw new CardinalityError(rows.length);
        }
        return { data: rows[0] ?? null, error: null, count, status };
      }

      return { data: rows, error: null, count, status };
    });
  } catch (error) {
    const mapped = toQueryError(error, options.exposeErrorDetails ?? false);
    return { data: null, error: mapped.error, count: null, status: mapped.status };
  }
}
