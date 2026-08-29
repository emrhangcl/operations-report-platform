import { createUnconfiguredPaymentAdapter } from "../unconfigured";
import type { PaymentProviderAdapter } from "../types";

export function createIyzicoAdapter(): PaymentProviderAdapter {
  return createUnconfiguredPaymentAdapter("iyzico");
}
