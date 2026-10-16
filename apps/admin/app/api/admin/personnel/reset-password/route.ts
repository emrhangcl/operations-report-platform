import { NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetLink } from "../../../../../lib/server/auth/flows";
import { getRequestMeta } from "../../../../../lib/server/auth/http";
import { withServiceContext } from "../../../../../lib/server/db";
import { requireAdmin } from "../../../../../lib/server/guards";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "admin-personnel-reset-password");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
  }

  const body = await readJsonBody(request, 8 * 1024);
  if (!body.ok) return NextResponse.json({ message: body.message }, { status: body.status });

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ message: "E-posta geçersiz." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await admin.service
    .from("profiles")
    .select("id,email")
    .eq("organization_id", admin.organizationId)
    .eq("email", parsed.data.email.trim().toLowerCase())
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ message: "Personel profili okunamadı." }, { status: 500 });
  }

  if (!profile?.email) {
    return NextResponse.json({ message: "Personel bulunamadı." }, { status: 404 });
  }

  let actionLink: string;
  try {
    actionLink = await withServiceContext(async (client) => {
      const link = await createPasswordResetLink(client, profile.id, getRequestMeta(request));
      await client.query(
        `insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, after_data)
         values ($1, $2, 'personnel_password_reset', 'profiles', $3, $4::jsonb)`,
        [admin.organizationId, admin.userId, profile.id, JSON.stringify({ email: profile.email })]
      );
      return link;
    });
  } catch {
    return NextResponse.json({ message: "Şifre sıfırlama başlatılamadı." }, { status: 500 });
  }

  return NextResponse.json({ action_link: actionLink }, { headers: { "Cache-Control": "no-store" } });
}
