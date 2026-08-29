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

  const { data: profile, error: profileLookupError } = await admin.service
    .from("profiles")
    .select("id,first_name,last_name,email,role")
    .eq("id", id)
    .eq("organization_id", admin.organizationId)
    .maybeSingle();

  if (profileLookupError) {
    return NextResponse.json({ message: "Personel profili okunamadı." }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ message: "Personel bulunamadı." }, { status: 404 });
  }

  const { error: userError } = await admin.service.auth.admin.deleteUser(id);
  if (userError) {
    return NextResponse.json({ message: "Kullanıcı hesabı silinemedi." }, { status: 500 });
  }

  const { error: profileError } = await admin.service
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (profileError) {
    return NextResponse.json({ message: "Personel profili silinemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "user_deleted",
    entity_table: "profiles",
    entity_id: id,
    before_data: profile
  });

  return NextResponse.json({ ok: true });
}
