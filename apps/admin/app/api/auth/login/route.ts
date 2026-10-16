import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "../../../../lib/api-response";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { login, type LoginFailureReason } from "../../../../lib/server/auth/flows";
import { getRequestMeta, isSameOriginRequest, setSessionCookie } from "../../../../lib/server/auth/http";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(256),
  client: z.enum(["web", "mobile"]).default("web")
});

// Yanlis parola ve kilitli hesap ayni mesaji alir; boylece hesabin varligi disariya sizmaz.
const failureMessages: Record<LoginFailureReason, string> = {
  invalid_credentials: "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.",
  locked: "Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.",
  email_not_confirmed: "Giriş için önce e-posta adresinizi doğrulayın.",
  no_active_profile: "Aktif kullanıcı profili bulunamadı.",
  no_active_membership: "Aktif organizasyon üyeliği bulunamadı."
};

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "auth-login", { limit: 10 });
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ message: failureMessages.invalid_credentials }, { status: 400 });
  }

  // Web girisinde baska bir sitenin kullaniciyi kendi hesabiyla oturum actirmasini engeller.
  if (parsed.data.client === "web" && !isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  try {
    const result = await login({
      email: parsed.data.email,
      password: parsed.data.password,
      clientType: parsed.data.client,
      meta: getRequestMeta(request)
    });

    if (!result.ok) {
      return NextResponse.json(
        { message: failureMessages[result.reason] },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (parsed.data.client === "mobile") {
      return NextResponse.json(
        {
          scope: result.scope,
          redirectTo: result.redirectTo,
          access_token: result.token,
          expires_at: result.expiresAt.toISOString()
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const response = NextResponse.json(
      { scope: result.scope, redirectTo: result.redirectTo },
      { headers: { "Cache-Control": "no-store" } }
    );
    setSessionCookie(response, result.scope, result.token, result.expiresAt);
    return response;
  } catch (error) {
    return apiError(request, 500, "Giriş şu anda tamamlanamıyor.", "auth_login_failed", error);
  }
}
