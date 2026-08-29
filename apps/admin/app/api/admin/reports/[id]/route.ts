import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;
  const { data: report, error: reportLookupError } = await admin.service
    .from("reports")
    .select("id")
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();

  if (reportLookupError) {
    return NextResponse.json({ message: "Rapor okunamadı." }, { status: 500 });
  }

  if (!report) {
    return NextResponse.json({ message: "Rapor bulunamadı." }, { status: 404 });
  }

  const { data: photos, error: photoError } = await admin.service
    .from("report_photos")
    .select("storage_path")
    .eq("report_id", id)
    .eq("organization_id", admin.organizationId);

  if (photoError) {
    return NextResponse.json({ message: "Rapor fotoğrafları okunamadı." }, { status: 500 });
  }

  const storagePaths = ((photos ?? []) as Array<{ storage_path: string | null }>)
    .map((photo) => photo.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    await admin.service.storage.from("report-photos").remove(storagePaths);
  }

  const { error } = await admin.service
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (error) {
    return NextResponse.json({ message: "Rapor silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "report_deleted",
    entity_table: "reports",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
