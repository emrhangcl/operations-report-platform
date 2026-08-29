import { NextResponse } from "next/server";
import { z } from "zod";
import { userAccountSchema } from "@tunca/validation";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const body = await request.json() as unknown;
  const parsed = userAccountSchema
    .extend({
      password: z.string().min(8)
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Personel bilgileri geçersiz." }, { status: 400 });
  }

  const { first_name, last_name, email, phone, password, is_active, role } = parsed.data;

  const { data, error } = await admin.service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name,
      last_name
    }
  });

  if (error || !data.user) {
    return NextResponse.json({ message: "Kullanıcı hesabı oluşturulamadı." }, { status: 500 });
  }

  const { error: profileError } = await admin.service.from("profiles").upsert({
    id: data.user.id,
    organization_id: admin.organizationId,
    first_name,
    last_name,
    email,
    phone: phone || null,
    role,
    is_active
  });

  if (profileError) {
    await admin.service.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ message: "Personel profili kaydedilemedi." }, { status: 500 });
  }

  const { error: membershipError } = await admin.service.from("organization_members").upsert({
    organization_id: admin.organizationId,
    profile_id: data.user.id,
    role: role === "ADMIN" ? "ADMIN" : "PERSONNEL",
    is_active,
    created_by_profile_id: admin.userId
  });

  if (membershipError) {
    await admin.service.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ message: "Organizasyon üyeliği kaydedilemedi." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "user_account_created",
    entity_table: "profiles",
    entity_id: data.user.id,
    after_data: { email, first_name, last_name, role }
  });

  return NextResponse.json({ id: data.user.id });
}
