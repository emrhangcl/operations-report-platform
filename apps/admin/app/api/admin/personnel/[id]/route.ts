import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const { id } = await params;
  if (id === admin.userId) {
    return NextResponse.json({ message: "Kendi admin hesabınızı buradan silemezsiniz." }, { status: 400 });
  }

  const [{ count: reportCount }, { count: photoCount }] = await Promise.all([
    admin.service
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("created_by_user_id", id),
    admin.service
      .from("report_photos")
      .select("id", { count: "exact", head: true })
      .eq("created_by", id)
  ]);

  if ((reportCount ?? 0) > 0 || (photoCount ?? 0) > 0) {
    return NextResponse.json(
      { message: "Bu personelin rapor kaydı var. Önce ilgili raporları silin." },
      { status: 409 }
    );
  }

  const { error: profileError } = await admin.service
    .from("profiles")
    .delete()
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ message: "Personel profili silinemedi." }, { status: 500 });
  }

  const { error: userError } = await admin.service.auth.admin.deleteUser(id);
  if (userError) {
    return NextResponse.json({ message: "Kullanıcı hesabı silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    actor_id: admin.userId,
    action: "user_deleted",
    entity_table: "profiles",
    entity_id: id
  });

  return NextResponse.json({ ok: true });
}
