import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { buildDailyActivity } from "../../../../lib/platform-activity";
import { requirePlatformAdmin } from "../../../../lib/server/guards";

export const runtime = "nodejs";

const ACTIVITY_DAYS = 90;

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "platform-dashboard");
  if (rateLimited) return rateLimited;

  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const now = new Date();
  const activitySince = new Date(now.getTime() - ACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    metricsResult,
    organizationsResult,
    plansResult,
    eventsResult,
    auditResult,
    activityPaymentsResult,
    activityOrganizationsResult
  ] = await Promise.all([
    auth.service.rpc("platform_dashboard_metrics"),
    auth.service
      .from("organizations")
      .select("id,name,slug,status,billing_email,created_at,closed_at")
      .order("created_at", { ascending: false })
      .limit(200),
    auth.service
      .from("plans")
      .select("id,code,name,description,currency,monthly_price_minor,yearly_price_minor,is_active,is_public")
      .order("monthly_price_minor", { ascending: true, nullsFirst: false })
      .limit(100),
    auth.service
      .from("payment_events")
      .select("id,organization_id,provider,event_type,signature_verified,processed_at,received_at,processing_error")
      .order("received_at", { ascending: false })
      .limit(20),
    auth.service
      .from("audit_logs")
      .select("id,organization_id,actor_id,action,entity_table,entity_id,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    // Grafik serisi: yalnizca basarili tahsilatlar; ham satirlar yanita girmez.
    auth.service
      .from("payments")
      .select("amount_minor,refunded_amount_minor,paid_at")
      .eq("status", "succeeded")
      .gte("paid_at", activitySince)
      .limit(5000),
    auth.service
      .from("organizations")
      .select("created_at")
      .gte("created_at", activitySince)
      .limit(5000)
  ]);

  if (
    metricsResult.error ||
    organizationsResult.error ||
    plansResult.error ||
    eventsResult.error ||
    auditResult.error ||
    activityPaymentsResult.error ||
    activityOrganizationsResult.error
  ) {
    return NextResponse.json({ message: "Platform paneli verileri alınamadı." }, { status: 500 });
  }

  const organizationIds = (organizationsResult.data ?? []).map((organization) => organization.id);
  const subscriptionResult = organizationIds.length > 0
    ? await auth.service
        .from("subscriptions")
        .select("organization_id,status,billing_interval,plan_id,current_period_starts_at,current_period_ends_at,grace_period_ends_at,is_current")
        .in("organization_id", organizationIds)
        .eq("is_current", true)
    : { data: [], error: null };

  if (subscriptionResult.error) {
    return NextResponse.json({ message: "Platform abonelikleri alınamadı." }, { status: 500 });
  }

  const subscriptionsByOrganization = new Map(
    (subscriptionResult.data ?? []).map((subscription) => [subscription.organization_id, subscription])
  );

  const activity = buildDailyActivity({
    payments: (activityPaymentsResult.data ?? []).map((payment) => ({
      // bigint kolonlari surucuden metin olarak gelebilir.
      amount_minor: Number(payment.amount_minor),
      refunded_amount_minor: Number(payment.refunded_amount_minor ?? 0),
      paid_at: payment.paid_at
    })),
    organizations: activityOrganizationsResult.data ?? [],
    days: ACTIVITY_DAYS,
    now
  });

  return NextResponse.json({
    metrics: metricsResult.data ?? {},
    activity,
    plans: plansResult.data ?? [],
    organizations: (organizationsResult.data ?? []).map((organization) => ({
      ...organization,
      subscription: subscriptionsByOrganization.get(organization.id) ?? null
    })),
    paymentEvents: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      organizationId: event.organization_id,
      provider: event.provider,
      eventType: event.event_type,
      signatureVerified: event.signature_verified,
      processedAt: event.processed_at,
      receivedAt: event.received_at,
      hasError: Boolean(event.processing_error)
    })),
    auditLogs: (auditResult.data ?? []).map((audit) => ({
      id: audit.id,
      organizationId: audit.organization_id,
      actorId: audit.actor_id,
      action: audit.action,
      entityTable: audit.entity_table,
      entityId: audit.entity_id,
      createdAt: audit.created_at
    }))
  });
}
