import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
