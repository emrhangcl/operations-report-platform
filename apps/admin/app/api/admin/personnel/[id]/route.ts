import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/server/guards";
import { enforceRateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = enforceRateLimit(request, "admin-personnel-delete");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
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

  const { error: profileError } = await admin.service
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("organization_id", admin.organizationId);

  if (profileError) {
    console.error("Personnel profile delete failed", {
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
      message: profileError.message
    });
    return NextResponse.json(
      {
        message: profileError.code === "23503"
          ? "Personel, bağlı kayıtları güvenli biçimde korunamadığı için silinemedi. Veritabanı güncellemesi gerekli."
          : "Personel profili silinemedi."
      },
      { status: profileError.code === "23503" ? 409 : 500 }
    );
  }

  const { error: userError } = await admin.service.auth.admin.deleteUser(id);
  if (userError && !isMissingAuthUserError(userError.message)) {
    console.error("Personnel auth user delete failed", userError);
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

function isMissingAuthUserError(message?: string) {
  return /not found|does not exist|no user/i.test(message ?? "");
}
