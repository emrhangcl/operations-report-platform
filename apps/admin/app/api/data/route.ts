import type { QueryResult, QuerySpec } from "@operations/data-client";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { readJsonBody } from "../../../lib/request-body";
import { authenticateRequest, hasSessionCredentials } from "../../../lib/server/auth/http";
import { getServerConfig } from "../../../lib/server/config";
import { executeQuery } from "../../../lib/server/query/execute";
import { isClientOperationAllowed, querySpecSchema } from "../../../lib/server/query/gateway-policy";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024 * 1024;

function respond(result: QueryResult<unknown>) {
  return NextResponse.json(result, {
    status: result.error ? result.status : 200,
    headers: { "Cache-Control": "no-store" }
  });
}

function failure(status: number, code: string, message: string) {
  return respond({ data: null, error: { message, code }, count: null, status });
}

// Veri gecidi: istemci yalnizca yapilandirilmis sorgu tanimi gonderir. Katmanlar sirasiyla
// govde siniri -> sema dogrulamasi -> oturum -> tablo/islem izin listesi -> PostgreSQL rolu + RLS.
export async function POST(request: Request) {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) return failure(body.status, "invalid_body", body.message);

  const parsed = querySpecSchema.safeParse(body.value);
  if (!parsed.success) return failure(400, "query_invalid", "Geçersiz sorgu tanımı.");
  const spec = parsed.data as QuerySpec;

  const auth = await authenticateRequest(request);
  if (!auth && hasSessionCredentials(request)) {
    return failure(401, "session_expired", "Oturumun süresi doldu. Lütfen tekrar giriş yapın.");
  }

  const rateLimited = await enforceRateLimit(request, "data-gateway", auth
    ? { limit: 600, identity: auth.session.userId }
    : { limit: 60 });
  if (rateLimited) return rateLimited;

  if (!isClientOperationAllowed(spec, Boolean(auth))) {
    return failure(auth ? 403 : 401, "operation_not_allowed", "Bu veri işlemine izin verilmiyor.");
  }

  const result = await executeQuery(
    spec,
    auth ? { role: "authenticated", userId: auth.session.userId } : { role: "anon" },
    { maxRows: getServerConfig().maxClientRows }
  );
  return respond(result);
}
