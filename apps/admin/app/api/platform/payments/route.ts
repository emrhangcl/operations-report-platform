import { NextResponse } from "next/server";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { requirePlatformAdmin } from "../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = await enforceRateLimit(request, "platform-payments-read");
  if (rateLimited) return rateLimited;
  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) return NextResponse.json({ message: auth.message }, { status: auth.status });

  const [paymentsResult, eventsResult] = await Promise.all([
    auth.service.from("payments").select("id,organization_id,provider,status,amount_minor,refunded_amount_minor,currency,paid_at,created_at").order("created_at", { ascending: false }).limit(100),
    auth.service.from("payment_events").select("id,organization_id,provider,event_type,signature_verified,processed_at,received_at,processing_error").order("received_at", { ascending: false }).limit(50)
  ]);
  if (paymentsResult.error || eventsResult.error) return NextResponse.json({ message: "Ödeme kayıtları alınamadı." }, { status: 500 });

  const organizationIds = Array.from(new Set([
    ...(paymentsResult.data ?? []).map((item) => item.organization_id),
    ...(eventsResult.data ?? []).map((item) => item.organization_id).filter(Boolean)
  ]));
  const organizationsResult = organizationIds.length
    ? await auth.service.from("organizations").select("id,name").in("id", organizationIds)
    : { data: [], error: null };
  if (organizationsResult.error) return NextResponse.json({ message: "Firma bilgileri alınamadı." }, { status: 500 });
  const names = new Map((organizationsResult.data ?? []).map((organization) => [organization.id, organization.name]));

  return NextResponse.json({
    payments: (paymentsResult.data ?? []).map((payment) => ({ ...payment, organization_name: names.get(payment.organization_id) ?? "Bilinmeyen firma" })),
    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      organizationId: event.organization_id,
      organizationName: names.get(event.organization_id ?? "") ?? "Platform",
      provider: event.provider,
      eventType: event.event_type,
      signatureVerified: event.signature_verified,
      processedAt: event.processed_at,
      receivedAt: event.received_at,
      hasError: Boolean(event.processing_error)
    }))
  });
}
