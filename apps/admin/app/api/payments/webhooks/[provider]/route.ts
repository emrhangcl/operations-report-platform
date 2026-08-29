import { createHash } from "node:crypto";
import {
  createPaymentProviderAdapter,
  InvalidPaymentSignatureError,
  isPaymentProviderName,
  PaymentProviderNotConfiguredError,
  type NormalizedPaymentEvent
} from "@tunca/payments";
import { NextResponse } from "next/server";
import { getServiceSupabase } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: rawProvider } = await params;
  const provider = rawProvider.trim().toLocaleLowerCase("en-US");

  if (!isPaymentProviderName(provider)) {
    return NextResponse.json({ message: "Ödeme sağlayıcısı bulunamadı." }, { status: 404 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ message: "Bildirim gövdesi çok büyük." }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ message: "Bildirim okunamadı." }, { status: 400 });
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ message: "Bildirim gövdesi çok büyük." }, { status: 413 });
  }

  let event: NormalizedPaymentEvent;
  try {
    const adapter = createPaymentProviderAdapter(process.env.PAYMENT_PROVIDER);
    if (adapter.name !== provider) {
      return NextResponse.json({ message: "Ödeme sağlayıcısı etkin değil." }, { status: 503 });
    }

    event = await adapter.verifyWebhook({ rawBody, headers: request.headers });
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) {
      return NextResponse.json({ message: "Ödeme sağlayıcısı henüz yapılandırılmadı." }, { status: 503 });
    }

    if (error instanceof InvalidPaymentSignatureError) {
      return NextResponse.json({ message: "Bildirim doğrulanamadı." }, { status: 401 });
    }

    return NextResponse.json({ message: "Bildirim işlenemedi." }, { status: 400 });
  }

  if (event.provider !== provider) {
    return NextResponse.json({ message: "Bildirim sağlayıcısı eşleşmiyor." }, { status: 400 });
  }

  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return NextResponse.json({ message: "Ödeme hizmeti yapılandırılmamış." }, { status: 503 });
  }

  const { data, error } = await service.rpc("process_verified_payment_event", {
    p_provider: event.provider,
    p_external_event_id: event.externalEventId,
    p_event_type: event.eventType,
    p_provider_customer_id: event.providerCustomerId,
    p_provider_subscription_id: event.providerSubscriptionId,
    p_external_payment_id: event.externalPaymentId,
    p_amount_minor: event.amountMinor,
    p_currency: event.currency,
    p_occurred_at: event.occurredAt,
    p_period_start_at: event.periodStartAt,
    p_period_end_at: event.periodEndAt,
    p_payload_hash: payloadHash
  });

  if (error) {
    return NextResponse.json({ message: "Ödeme bildirimi kaydedilemedi." }, { status: 500 });
  }

  const result = data as { applied?: boolean } | null;
  return NextResponse.json({ received: true, applied: result?.applied === true });
}
