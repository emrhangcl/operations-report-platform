import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;
  const { error } = await admin.service
    .from("belts")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: "Bant silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    actor_id: admin.userId,
    action: "belt_deleted",
    entity_table: "belts",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
