import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../lib/server/auth/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ user: null }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    {
      user: {
        id: auth.session.userId,
        email: auth.session.email,
        email_confirmed_at: auth.session.emailConfirmedAt
      },
      scope: auth.session.scope,
      expires_at: auth.session.expiresAt.toISOString()
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
