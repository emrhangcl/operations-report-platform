import "server-only";

import { QueryBuilder, type QueryTransport } from "@operations/data-client";
import { deleteUser } from "./auth/users";
import { withServiceContext, type DbContext } from "./db";
import { executeQuery } from "./query/execute";
import { callFunction } from "./query/rpc";
import { createStorageApi } from "./storage";

function createClient(context: DbContext) {
  const transport: QueryTransport = (spec) => executeQuery(spec, context, { exposeErrorDetails: true });
  return {
    from: (table: string) => new QueryBuilder(transport, table),
    rpc: (fn: string, args?: Record<string, unknown>) => callFunction(fn, args, context),
    storage: createStorageApi(context)
  };
}

const authAdmin = {
  /** Giris hesabini siler; oturumlar ve tek kullanimlik belirtecler cascade ile silinir. */
  async deleteUser(userId: string) {
    try {
      const deleted = await withServiceContext((client) => deleteUser(client, userId));
      return deleted
        ? { data: { id: userId }, error: null }
        : { data: null, error: { message: "Kullanici bulunamadi.", code: "user_not_found" } };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Kullanici silinemedi.",
          code: (error as { code?: string }).code ?? "unexpected_failure"
        }
      };
    }
  }
};

/**
 * RLS'i atlayan server istemcisi. Yalnizca kimligi ve organizasyon yetkisi dogrulanmis server
 * islemlerinde kullanilir; sorgular organizasyon filtresini acikca icermelidir.
 */
export function createServiceClient() {
  return { ...createClient({ role: "service_role" }), auth: { admin: authAdmin } };
}

/** Belirli bir kullanici adina, RLS politikalarina tabi calisan server istemcisi. */
export function createUserClient(userId: string) {
  return createClient({ role: "authenticated", userId });
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
