import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";
import { enforceRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "admin-report-delete");
  if (rateLimited) return rateLimited;

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

  const { error: assignmentError } = await admin.service
    .from("installation_assignments")
    .update({ report_id: null })
    .eq("report_id", id)
    .eq("organization_id", admin.organizationId);

  if (assignmentError) {
    console.error("Report assignment unlink failed", assignmentError);
    return NextResponse.json({ message: "Rapora bağlı montaj ataması temizlenemedi." }, { status: 500 });
  }

  // Child rows cascade in the same transaction. Signed evidence cannot be removed individually.
  const { error } = await admin.service
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (error) {
    console.error("Report delete failed", error);
    return NextResponse.json({ message: "Rapor silinemedi." }, { status: 500 });
  }

  if (storagePaths.length > 0) {
    const cleanup = await admin.service.storage.from("report-photos").remove(storagePaths);
    if (cleanup.error) {
      await admin.service.from("audit_logs").insert({
        organization_id: admin.organizationId, actor_id: admin.userId,
        action: "report_storage_cleanup_failed", entity_table: "reports", entity_id: id,
        after_data: { storage_paths: storagePaths }
      });
    }
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
