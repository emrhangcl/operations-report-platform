import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../lib/api-response";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { verifyEmailWithToken } from "../../../../lib/server/auth/flows";
import { getRequestMeta } from "../../../../lib/server/auth/http";

export const runtime = "nodejs";

const schema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(request, "auth-verify-email", { limit: 10 });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 2 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ message: "Doğrulama bağlantısı geçersiz." }, { status: 400 });

  try {
    const verified = await verifyEmailWithToken(parsed.data.token, getRequestMeta(request));
    if (!verified) {
      return NextResponse.json({ message: "Doğrulama bağlantısı geçersiz veya süresi dolmuş." }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(request, 500, "E-posta doğrulanamadı.", "auth_verify_email_failed", error);
  }
}
