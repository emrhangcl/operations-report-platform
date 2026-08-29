export const paymentProviderNames = ["iyzico", "paytr"] as const;
export type PaymentProviderName = (typeof paymentProviderNames)[number];

export type PaymentEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.refunded"
  | "subscription.canceled";

export interface PaymentCheckoutRequest {
  organizationId: string;
  subscriptionId: string;
  planCode: string;
  billingInterval: "monthly" | "yearly";
  amountMinor: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentCheckoutResult {
  redirectUrl: string;
  providerSubscriptionId: string;
}

export interface PaymentWebhookRequest {
  rawBody: string;
  headers: Headers;
}

export interface NormalizedPaymentEvent {
  provider: PaymentProviderName;
  externalEventId: string;
  eventType: PaymentEventType;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  externalPaymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  occurredAt: string;
  periodStartAt: string | null;
  periodEndAt: string | null;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProviderName;
  createCheckout(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
  verifyWebhook(input: PaymentWebhookRequest): Promise<NormalizedPaymentEvent>;
}
