import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../lib/api-response";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";
import { resetPasswordWithToken } from "../../../../../lib/server/auth/flows";
import { getRequestMeta } from "../../../../../lib/server/auth/http";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(10).max(256)
});

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(request, "auth-password-reset", { limit: 10 });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ message: "Yeni parola en az 10 karakter olmalıdır." }, { status: 400 });
  }

  try {
    const updated = await resetPasswordWithToken(parsed.data.token, parsed.data.password, getRequestMeta(request));
    if (!updated) {
      return NextResponse.json({ message: "Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin." }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(request, 500, "Parola güncellenemedi.", "auth_password_reset_failed", error);
  }
}
