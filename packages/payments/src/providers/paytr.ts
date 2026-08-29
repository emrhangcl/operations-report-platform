import { createUnconfiguredPaymentAdapter } from "../unconfigured";
import type { PaymentProviderAdapter } from "../types";

export function createPaytrAdapter(): PaymentProviderAdapter {
  return createUnconfiguredPaymentAdapter("paytr");
}
