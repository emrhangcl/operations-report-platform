import { createIyzicoAdapter } from "./providers/iyzico";
import { createPaytrAdapter } from "./providers/paytr";
import { PaymentProviderNotConfiguredError } from "./unconfigured";
import { paymentProviderNames, type PaymentProviderAdapter, type PaymentProviderName } from "./types";

export * from "./signatures";
export * from "./types";
export { PaymentProviderNotConfiguredError } from "./unconfigured";

export function isPaymentProviderName(value: string): value is PaymentProviderName {
  return paymentProviderNames.includes(value as PaymentProviderName);
}

export function createPaymentProviderAdapter(value: string | undefined): PaymentProviderAdapter {
  const provider = value?.trim().toLocaleLowerCase("en-US") ?? "";

  if (!isPaymentProviderName(provider)) {
    throw new PaymentProviderNotConfiguredError(provider || "none");
  }

  return provider === "iyzico" ? createIyzicoAdapter() : createPaytrAdapter();
}
