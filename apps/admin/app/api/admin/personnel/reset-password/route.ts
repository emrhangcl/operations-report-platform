import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "E-posta geçersiz." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await admin.service
    .from("profiles")
    .select("email")
    .eq("organization_id", admin.organizationId)
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ message: "Personel profili okunamadı." }, { status: 500 });
  }

  if (!profile?.email) {
    return NextResponse.json({ message: "Personel bulunamadı." }, { status: 404 });
  }

  const { data, error } = await admin.service.auth.admin.generateLink({
    type: "recovery",
    email: profile.email
  });

  if (error) {
    return NextResponse.json({ message: "Şifre sıfırlama başlatılamadı." }, { status: 500 });
  }

  await admin.service.from("audit_logs").insert({
    organization_id: admin.organizationId,
    actor_id: admin.userId,
    action: "personnel_password_reset",
    entity_table: "profiles",
    after_data: { email: profile.email }
  });

  return NextResponse.json({ action_link: data.properties?.action_link ?? null });
}
