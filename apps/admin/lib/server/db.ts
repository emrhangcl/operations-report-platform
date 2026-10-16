import "server-only";

import pg from "pg";
import { getServerConfig } from "./config";

export type DbRole = "anon" | "authenticated" | "service_role";

export interface DbContext {
  role: DbRole;
  userId?: string | null;
}

export type DbClient = pg.PoolClient;

// Rol adlari SQL'e parametre olarak verilemez; yalnizca bu sabit liste kullanilir.
const roleStatements: Record<DbRole, string> = {
  anon: "set local role anon",
  authenticated: "set local role authenticated",
  service_role: "set local role service_role"
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// int8 (count(*) vb.) JS number'a donusturulur; degerler Number.MAX_SAFE_INTEGER altindadir.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

const globalForDb = globalThis as typeof globalThis & { __operationsPgPool?: pg.Pool };

export function getPool() {
  if (!globalForDb.__operationsPgPool) {
    const pool = new pg.Pool({
      connectionString: getServerConfig().databaseUrl,
      application_name: "operations-portal",
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
    pool.on("error", (error) => {
      console.error(JSON.stringify({ level: "error", event: "db_pool_error", message: error.message }));
    });
    globalForDb.__operationsPgPool = pool;
  }
  return globalForDb.__operationsPgPool;
}

export async function closePool() {
  const pool = globalForDb.__operationsPgPool;
  delete globalForDb.__operationsPgPool;
  await pool?.end();
}

/**
 * Islemi tek bir transaction icinde, verilen veritabani rolu ve kullanici baglami ile calistirir.
 * `authenticated` rolu RLS'e tabidir ve `auth.uid()` burada verilen kullaniciyi dondurur.
 */
export async function withDbContext<T>(context: DbContext, work: (client: DbClient) => Promise<T>): Promise<T> {
  if (context.userId && !uuidPattern.test(context.userId)) {
    throw new Error("Gecersiz kullanici kimligi.");
  }
  if (context.role === "authenticated" && !context.userId) {
    throw new Error("authenticated rolu kullanici kimligi gerektirir.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(roleStatements[context.role]);
    await client.query("select set_config('app.user_id', $1, true)", [context.userId ?? ""]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function withServiceContext<T>(work: (client: DbClient) => Promise<T>) {
  return withDbContext({ role: "service_role" }, work);
}

export function withUserContext<T>(userId: string, work: (client: DbClient) => Promise<T>) {
  return withDbContext({ role: "authenticated", userId }, work);
}
