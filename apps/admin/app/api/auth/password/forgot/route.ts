import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../lib/api-response";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";
import { requestPasswordReset } from "../../../../../lib/server/auth/flows";
import { getRequestMeta } from "../../../../../lib/server/auth/http";

export const runtime = "nodejs";

const schema = z.object({ email: z.string().trim().min(3).max(320) });

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "auth-password-forgot", { limit: 5 });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ message: "E-posta adresini kontrol edin." }, { status: 400 });

  try {
    await requestPasswordReset(parsed.data.email, getRequestMeta(request));
  } catch (error) {
    return apiError(request, 500, "İstek işlenemedi. Lütfen daha sonra tekrar deneyin.", "auth_password_forgot_failed", error);
  }

  // Hesap var olsun olmasin ayni yanit doner.
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
