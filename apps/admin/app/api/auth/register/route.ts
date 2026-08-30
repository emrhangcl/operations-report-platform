import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { organizationRegistrationSchema } from "@operations/validation";
import { NextResponse } from "next/server";
import { apiError } from "../../../../lib/api-response";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { readJsonBody } from "../../../../lib/request-body";
import { getServiceSupabase, getSupabaseConfig } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return `${normalized || "firma"}-${randomUUID().slice(0, 8)}`;
}

function canonicalOrigin(request: Request) {
  const configuredUrl = process.env.APP_URL;

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL is required in production.");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "organization-register");
  if (rateLimited) return rateLimited;

  const body = await readJsonBody(request, 32 * 1024);
  if (!body.ok) return apiError(request, body.status, body.message, "organization_registration_invalid_body");

  const parsed = organizationRegistrationSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ message: "Kayıt bilgilerini kontrol edin." }, { status: 400 });
  }

  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ message: "Kayıt hizmeti yapılandırılmamış." }, { status: 503 });
  }

  const service = getServiceSupabase();
  const values = parsed.data;
  let createdUserId: string | null = null;
  let createdOrganizationId: string | null = null;

  try {
    let selectedPlanId: string | null = null;

    if (values.plan_id) {
      const { data: plan, error: planError } = await service
        .from("plans")
        .select("id")
        .eq("id", values.plan_id)
        .eq("is_active", true)
        .eq("is_public", true)
        .maybeSingle();

      if (planError || !plan) {
        return NextResponse.json({ message: "Seçilen paket kullanılamıyor." }, { status: 400 });
      }

      selectedPlanId = plan.id;
    }

    const publicClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: signUp, error: signUpError } = await publicClient.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${canonicalOrigin(request)}/verify-email`,
        data: {
          first_name: values.first_name,
          last_name: values.last_name
        }
      }
    });

    if (signUpError || !signUp.user || signUp.user.identities?.length === 0) {
      return NextResponse.json(
        { message: "Bu e-posta ile kayıt tamamlanamadı." },
        { status: 409 }
      );
    }

    createdUserId = signUp.user.id;

    const { data: organization, error: organizationError } = await service
      .from("organizations")
      .insert({
        name: values.organization_name,
        slug: organizationSlug(values.organization_name),
        status: "suspended",
        billing_email: values.email
      })
      .select("id")
      .single();

    if (organizationError || !organization) {
      throw new Error("Organization could not be created.");
    }

    createdOrganizationId = organization.id;

    const { error: profileError } = await service.from("profiles").insert({
      id: createdUserId,
      organization_id: createdOrganizationId,
      first_name: values.first_name,
      last_name: values.last_name,
      email: values.email,
      phone: values.phone || null,
      role: "ADMIN",
      is_active: true
    });

    if (profileError) {
      throw new Error("Profile could not be created.");
    }

    const { error: membershipError } = await service.from("organization_members").insert({
      organization_id: createdOrganizationId,
      profile_id: createdUserId,
      role: "OWNER",
      is_active: true
    });

    if (membershipError) {
      throw new Error("Membership could not be created.");
    }

    const { error: subscriptionError } = await service.from("subscriptions").insert({
      organization_id: createdOrganizationId,
      plan_id: selectedPlanId,
      status: "pending",
      billing_interval: values.billing_interval
    });

    if (subscriptionError) {
      throw new Error("Subscription could not be created.");
    }

    await service.from("audit_logs").insert({
      organization_id: createdOrganizationId,
      actor_id: createdUserId,
      action: "organization_registered",
      entity_table: "organizations",
      entity_id: createdOrganizationId,
      after_data: {
        billing_interval: values.billing_interval,
        plan_id: selectedPlanId
      }
    });

    createdUserId = null;
    createdOrganizationId = null;

    return NextResponse.json(
      {
        requires_email_verification: !signUp.session
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdUserId) {
      await service.auth.admin.deleteUser(createdUserId);
    }

    if (createdOrganizationId) {
      await service.from("subscriptions").delete().eq("organization_id", createdOrganizationId);
      await service.from("organizations").delete().eq("id", createdOrganizationId);
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
