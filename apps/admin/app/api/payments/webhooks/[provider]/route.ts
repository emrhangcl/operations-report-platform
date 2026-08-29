import { createHash } from "node:crypto";
import {
  createPaymentProviderAdapter,
  InvalidPaymentSignatureError,
  isPaymentProviderName,
  PaymentProviderNotConfiguredError,
  type NormalizedPaymentEvent
} from "@tunca/payments";
import { NextResponse } from "next/server";
import { apiError, withRequestId } from "../../../../../lib/api-response";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { readTextBody } from "../../../../../lib/request-body";
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
    return apiError(request, 404, "Ödeme sağlayıcısı bulunamadı.", "payment_webhook_unknown_provider");
  }

  const rateLimited = enforceRateLimit(request, `payment-webhook:${provider}`);
  if (rateLimited) return rateLimited;

  const body = await readTextBody(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) {
    const event = body.status === 413 ? "payment_webhook_body_too_large" : "payment_webhook_body_read_failed";
    return apiError(request, body.status, body.status === 413 ? "Bildirim gövdesi çok büyük." : "Bildirim okunamadı.", event);
  }
  const rawBody = body.value;

  let event: NormalizedPaymentEvent;
  try {
    const adapter = createPaymentProviderAdapter(process.env.PAYMENT_PROVIDER);
    if (adapter.name !== provider) {
      return apiError(request, 503, "Ödeme sağlayıcısı etkin değil.", "payment_webhook_provider_disabled");
    }

    event = await adapter.verifyWebhook({ rawBody, headers: request.headers });
  } catch (error) {
    if (error instanceof PaymentProviderNotConfiguredError) {
      return apiError(request, 503, "Ödeme sağlayıcısı henüz yapılandırılmadı.", "payment_webhook_provider_unconfigured");
    }

    if (error instanceof InvalidPaymentSignatureError) {
      return apiError(request, 401, "Bildirim doğrulanamadı.", "payment_webhook_invalid_signature");
    }

    return apiError(request, 400, "Bildirim işlenemedi.", "payment_webhook_verification_failed", error);
  }

  if (event.provider !== provider) {
    return apiError(request, 400, "Bildirim sağlayıcısı eşleşmiyor.", "payment_webhook_provider_mismatch");
  }

  const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return apiError(request, 503, "Ödeme hizmeti yapılandırılmamış.", "payment_webhook_service_unconfigured");
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
    return apiError(request, 500, "Ödeme bildirimi kaydedilemedi.", "payment_webhook_persist_failed", error);
  }

  const result = data as { applied?: boolean } | null;
  return withRequestId(request, NextResponse.json({ received: true, applied: result?.applied === true }));
}
