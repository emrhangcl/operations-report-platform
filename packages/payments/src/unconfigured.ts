import type {
  PaymentCheckoutRequest,
  PaymentCheckoutResult,
  PaymentProviderAdapter,
  PaymentProviderName,
  PaymentWebhookRequest,
  NormalizedPaymentEvent
} from "./types";

export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Payment provider is not configured: ${provider}`);
    this.name = "PaymentProviderNotConfiguredError";
  }
}

export function createUnconfiguredPaymentAdapter(provider: PaymentProviderName): PaymentProviderAdapter {
  const fail = () => {
    return new PaymentProviderNotConfiguredError(provider);
  };

  return {
    name: provider,
    async createCheckout(_input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult> {
      throw fail();
    },
    async verifyWebhook(_input: PaymentWebhookRequest): Promise<NormalizedPaymentEvent> {
      throw fail();
    }
  };
}
