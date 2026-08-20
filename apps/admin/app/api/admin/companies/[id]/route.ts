import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;

  await admin.service
    .from("reports")
    .update({ company_id: null })
    .eq("company_id", id);

  const { error } = await admin.service
    .from("companies")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: "Firma silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    actor_id: admin.userId,
    action: "company_deleted",
    entity_table: "companies",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
