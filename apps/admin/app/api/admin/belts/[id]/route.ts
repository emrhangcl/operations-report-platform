import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";
import { enforceRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "admin-belt-delete");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;
  const { data: belt, error: lookupError } = await admin.service
    .from("belts")
    .select("id")
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ message: "Bant okunamadı." }, { status: 500 });
  }

  if (!belt) {
    return NextResponse.json({ message: "Bant bulunamadı." }, { status: 404 });
  }

  const { error } = await admin.service
    .from("belts")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (error) {
    return NextResponse.json({ message: "Bant silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "belt_deleted",
    entity_table: "belts",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
