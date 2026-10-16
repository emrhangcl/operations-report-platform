import { NextResponse } from "next/server";
import { logout } from "../../../../lib/server/auth/flows";
import { authenticateRequest, clearSessionCookie, getRequestMeta, readRequestScope } from "../../../../lib/server/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const scope = readRequestScope(request);
  const auth = await authenticateRequest(request);
  if (auth) await logout(auth.token, getRequestMeta(request), auth.session.userId);

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (scope) clearSessionCookie(response, scope);
  return response;
}
