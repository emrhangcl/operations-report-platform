import { randomUUID } from "node:crypto";
import { organizationRegistrationSchema } from "@operations/validation";
import { NextResponse } from "next/server";
import { apiError } from "../../../../lib/api-response";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { sendEmailVerification } from "../../../../lib/server/auth/flows";
import { getRequestMeta, isSameOriginRequest } from "../../../../lib/server/auth/http";
import { AuthUserError, createUser, recordSecurityEvent } from "../../../../lib/server/auth/users";
import { getServerConfig } from "../../../../lib/server/config";
import { withServiceContext } from "../../../../lib/server/db";

export const runtime = "nodejs";

class RegistrationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function organizationSlug(name: string) {
  const normalized = name
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${normalized || "firma"}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const rateLimited = await enforceRateLimit(request, "organization-register");
  if (rateLimited) return rateLimited;

  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ message: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const body = await readJsonBody(request, 32 * 1024);
  if (!body.ok) return apiError(request, body.status, body.message, "organization_registration_invalid_body");

  const parsed = organizationRegistrationSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ message: "Kayıt bilgilerini kontrol edin." }, { status: 400 });
  }

  const values = parsed.data;
  const requireVerification = getServerConfig().requireEmailVerification;

  try {
    // Hesap, firma, profil, uyelik, abonelik ve denetim kaydi tek transaction icinde olusur.
    await withServiceContext(async (client) => {
      let selectedPlanId: string | null = null;
      if (values.plan_id) {
        const plan = await client.query<{ id: string }>(
          "select id from public.plans where id = $1 and is_active and is_public",
          [values.plan_id]
        );
        if (!plan.rows[0]) throw new RegistrationError("Seçilen paket kullanılamıyor.", 400);
        selectedPlanId = plan.rows[0].id;
      }

      const user = await createUser(client, {
        email: values.email,
        password: values.password,
        emailConfirmed: !requireVerification,
        metadata: { first_name: values.first_name, last_name: values.last_name }
      });

      const organization = await client.query<{ id: string }>(
        `insert into public.organizations (name, slug, status, billing_email)
         values ($1, $2, 'suspended', $3)
         returning id`,
        [values.organization_name, organizationSlug(values.organization_name), user.email]
      );
      const organizationId = organization.rows[0]!.id;

      await client.query(
        `insert into public.profiles (id, organization_id, first_name, last_name, email, phone, role, is_active)
         values ($1, $2, $3, $4, $5, $6, 'ADMIN', true)`,
        [user.id, organizationId, values.first_name, values.last_name, user.email, values.phone || null]
      );
      await client.query(
        `insert into public.organization_members (organization_id, profile_id, role, is_active)
         values ($1, $2, 'OWNER', true)`,
        [organizationId, user.id]
      );
      await client.query(
        `insert into public.subscriptions (organization_id, plan_id, status, billing_interval)
         values ($1, $2, 'pending', $3)`,
        [organizationId, selectedPlanId, values.billing_interval]
      );
      await client.query(
        `insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, after_data)
         values ($1, $2, 'organization_registered', 'organizations', $1, $3::jsonb)`,
        [organizationId, user.id, JSON.stringify({ billing_interval: values.billing_interval, plan_id: selectedPlanId })]
      );
      await recordSecurityEvent(client, "account_registered", { userId: user.id, email: user.email, meta: getRequestMeta(request) });

      if (requireVerification) await sendEmailVerification(client, user.id, user.email);
    });

    return NextResponse.json({ requires_email_verification: requireVerification }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthUserError && error.code === "email_exists") {
      return NextResponse.json({ message: "Bu e-posta ile kayıt tamamlanamadı." }, { status: 409 });
    }
    if (error instanceof RegistrationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return apiError(
      request,
      500,
      "Kayıt şu anda tamamlanamıyor. Lütfen daha sonra tekrar deneyin.",
      "organization_registration_failed",
      error
    );
  }
}
