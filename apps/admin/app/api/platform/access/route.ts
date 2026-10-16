import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  return NextResponse.json({ ok: true });
}
