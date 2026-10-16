import { NextResponse } from "next/server";
import { z } from "zod";
import { userAccountSchema } from "@operations/validation";
import { AuthUserError, createUser } from "../../../../../lib/server/auth/users";
import { withServiceContext } from "../../../../../lib/server/db";
import { requireAdmin } from "../../../../../lib/server/guards";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readJsonBody } from "../../../../../lib/request-body";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(request, "admin-personnel-create");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request);
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
  }

  const bodyResult = await readJsonBody(request, 16 * 1024);
  if (!bodyResult.ok) return NextResponse.json({ message: bodyResult.message }, { status: bodyResult.status });

  const body = bodyResult.value;
  const parsed = userAccountSchema
    .extend({
      password: z.string().min(8).max(256)
    })
    .safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Personel bilgileri geçersiz." }, { status: 400 });
  }

  const { first_name, last_name, email, phone, password, is_active, role } = parsed.data;

  try {
    // Hesap, profil, uyelik ve denetim kaydi tek transaction icinde olusur; biri basarisiz olursa
    // hicbiri kalici olmaz.
    const userId = await withServiceContext(async (client) => {
      const user = await createUser(client, {
        email,
        password,
        emailConfirmed: true,
        metadata: { first_name, last_name }
      });

      await client.query(
        `insert into public.profiles (id, organization_id, first_name, last_name, email, phone, role, is_active)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.id, admin.organizationId, first_name, last_name, user.email, phone || null, role, is_active]
      );
      await client.query(
        `insert into public.organization_members (organization_id, profile_id, role, is_active, created_by_profile_id)
         values ($1, $2, $3, $4, $5)`,
        [admin.organizationId, user.id, role === "ADMIN" ? "ADMIN" : "PERSONNEL", is_active, admin.userId]
      );
      await client.query(
        `insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, after_data)
         values ($1, $2, 'user_account_created', 'profiles', $3, $4::jsonb)`,
        [admin.organizationId, admin.userId, user.id, JSON.stringify({ email: user.email, first_name, last_name, role })]
      );
      return user.id;
    });

    return NextResponse.json({ id: userId });
  } catch (error) {
    if (error instanceof AuthUserError && error.code === "email_exists") {
      return NextResponse.json({ message: "Bu e-posta ile kayıtlı bir hesap zaten var." }, { status: 409 });
    }
    console.error(JSON.stringify({
      level: "error",
      event: "personnel_account_create_failed",
      message: error instanceof Error ? error.message : String(error)
    }));
    return NextResponse.json({ message: "Kullanıcı hesabı oluşturulamadı." }, { status: 500 });
  }
}
