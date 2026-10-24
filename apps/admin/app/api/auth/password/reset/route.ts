import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../../lib/api-response";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";
import { resetPasswordWithToken } from "../../../../../lib/server/auth/flows";
import { getRequestMeta } from "../../../../../lib/server/auth/http";

export const runtime = "nodejs";

const INVALID_LINK_MESSAGE = "Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.";

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const passwordSchema = z.string()
  .min(10, "Yeni parola en az 10 karakter olmalıdır.")
  .max(256, "Yeni parola en fazla 256 karakter olabilir.");

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "auth-password-reset", { limit: 10 });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 4 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });
  const input = (body.value ?? {}) as { token?: unknown; password?: unknown };
  // Biçimi bozuk token, süresi dolmuş token ile aynı mesajı alır; token'ın varlığı sızdırılmaz.
  const token = tokenSchema.safeParse(input.token);
  if (!token.success) return NextResponse.json({ message: INVALID_LINK_MESSAGE }, { status: 400 });
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) {
    const message = typeof input.password === "string"
      ? password.error.issues[0]?.message ?? "Yeni parola en az 10 karakter olmalıdır."
      : "Yeni parola en az 10 karakter olmalıdır.";
    return NextResponse.json({ message }, { status: 400 });
  }

  try {
    const updated = await resetPasswordWithToken(token.data, password.data, getRequestMeta(request));
    if (!updated) {
      return NextResponse.json({ message: INVALID_LINK_MESSAGE }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(request, 500, "Parola güncellenemedi.", "auth_password_reset_failed", error);
  }
}
