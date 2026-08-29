import { NextResponse } from "next/server";
import { requireActiveProfile } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireActiveProfile(request, "read");
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  return NextResponse.json({
    accessMode: auth.accessMode,
    subscriptionStatus: auth.subscriptionStatus
  });
}
