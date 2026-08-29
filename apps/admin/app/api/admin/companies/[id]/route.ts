import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";
import { enforceRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "admin-company-delete");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;
  const { data: company, error: lookupError } = await admin.service
    .from("companies")
    .select("id")
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ message: "Firma okunamadı." }, { status: 500 });
  }

  if (!company) {
    return NextResponse.json({ message: "Firma bulunamadı." }, { status: 404 });
  }

  await admin.service
    .from("reports")
    .update({ company_id: null })
    .eq("company_id", id)
    .eq("organization_id", admin.organizationId);

  const { error } = await admin.service
    .from("companies")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (error) {
    return NextResponse.json({ message: "Firma silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "company_deleted",
    entity_table: "companies",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
