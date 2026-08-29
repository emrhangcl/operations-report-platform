import { z } from "zod";
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["suspend", "activate", "start_closure", "grant_lifetime", "remove_lifetime", "change_plan"]),
  planId: z.string().uuid().nullable().optional(),
  billingInterval: z.enum(["monthly", "yearly"]).nullable().optional()
}).strict();

const organizationIdSchema = z.string().uuid();

async function getOrganizationId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return organizationIdSchema.safeParse(id).success ? id : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const id = await getOrganizationId(params);
  if (!id) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  const organizationResult = await auth.service
    .from("organizations")
    .select("id,name,slug,status,legal_name,tax_identifier,billing_email,timezone,created_at,updated_at,closed_at")
    .eq("id", id)
    .maybeSingle();

  if (organizationResult.error) {
    return NextResponse.json({ message: "Firma detayları alınamadı." }, { status: 500 });
  }

  if (!organizationResult.data) {
    return NextResponse.json({ message: "Firma bulunamadı." }, { status: 404 });
  }

  const [profilesResult, membersResult, subscriptionsResult, paymentsResult, auditResult, exportsResult] = await Promise.all([
    auth.service
      .from("profiles")
      .select("id,first_name,last_name,email,phone,role,is_active,created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: true }),
    auth.service
      .from("organization_members")
      .select("profile_id,role,is_active,created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: true }),
    auth.service
      .from("subscriptions")
      .select("id,status,billing_interval,plan_id,provider,current_period_starts_at,current_period_ends_at,grace_period_ends_at,canceled_at,created_at,updated_at,is_current")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    auth.service
      .from("payments")
      .select("id,provider,status,amount_minor,refunded_amount_minor,currency,paid_at,created_at,updated_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    auth.service
      .from("audit_logs")
      .select("id,actor_id,action,entity_table,entity_id,before_data,after_data,created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    auth.service.rpc("platform_list_export_requests", {
      target_organization_id: id,
      actor_user_id: auth.userId
    })
  ]);

  if (
    profilesResult.error ||
    membersResult.error ||
    subscriptionsResult.error ||
    paymentsResult.error ||
    auditResult.error ||
    exportsResult.error
  ) {
    return NextResponse.json({ message: "Firma geçmişi alınamadı." }, { status: 500 });
  }

  const profilesById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    organization: organizationResult.data,
    members: (membersResult.data ?? []).map((member) => ({
      ...member,
      profile: profilesById.get(member.profile_id) ?? null
    })),
    subscriptions: subscriptionsResult.data ?? [],
    payments: paymentsResult.data ?? [],
    auditLogs: auditResult.data ?? [],
    exportRequests: Array.isArray(exportsResult.data) ? exportsResult.data : []
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const id = await getOrganizationId(params);
  if (!id) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Geçerli bir işlem gönderin." }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Platform işlemi geçersiz." }, { status: 400 });
  }

  const values = parsed.data;
  let result;

  if (values.action === "suspend" || values.action === "activate" || values.action === "start_closure") {
    result = await auth.service.rpc("platform_set_organization_status", {
      target_organization_id: id,
      target_status: values.action === "suspend" ? "suspended" : values.action === "activate" ? "active" : "closed",
      actor_user_id: auth.userId
    });
  } else if (values.action === "grant_lifetime" || values.action === "remove_lifetime") {
    if (values.action === "remove_lifetime" && (!values.planId || !values.billingInterval)) {
      return NextResponse.json({ message: "Lifetime kaldırılırken paket ve dönem seçilmelidir." }, { status: 400 });
    }

    result = await auth.service.rpc("platform_set_lifetime", {
      target_organization_id: id,
      enable_lifetime: values.action === "grant_lifetime",
      target_plan_id: values.action === "remove_lifetime" ? values.planId : null,
      target_billing_interval: values.action === "remove_lifetime" ? values.billingInterval : "lifetime",
      actor_user_id: auth.userId
    });
  } else {
    if (!values.planId || !values.billingInterval) {
      return NextResponse.json({ message: "Paket değişikliği için paket ve dönem seçilmelidir." }, { status: 400 });
    }

    result = await auth.service.rpc("platform_change_plan", {
      target_organization_id: id,
      target_plan_id: values.planId,
      target_billing_interval: values.billingInterval,
      actor_user_id: auth.userId
    });
  }

  if (result.error) {
    return NextResponse.json({ message: "Platform işlemi uygulanamadı." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: result.data });
}
