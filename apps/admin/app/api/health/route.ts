import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    {
      service: "operations-portal",
      status: "ok"
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
