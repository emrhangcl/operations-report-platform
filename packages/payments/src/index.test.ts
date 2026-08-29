import { describe, expect, it } from "vitest";
import {
  assertHmacSignature,
  createPaymentProviderAdapter,
  hmacSha256Hex,
  InvalidPaymentSignatureError,
  PaymentProviderNotConfiguredError
} from "./index";

describe("payment provider boundary", () => {
  it("computes the documented HMAC-SHA256 hex value", () => {
    expect(
      hmacSha256Hex("key", "The quick brown fox jumps over the lazy dog")
    ).toBe("f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  });

  it("rejects missing and altered signatures", () => {
    const message = "provider-event";
    const expected = hmacSha256Hex("secret", message);

    expect(() => assertHmacSignature({
      secret: "secret",
      message,
      provided: expected,
      encoding: "hex"
    })).not.toThrow();

    expect(() => assertHmacSignature({
      secret: "secret",
      message,
      provided: `${expected.slice(0, -1)}0`,
      encoding: "hex"
    })).toThrow(InvalidPaymentSignatureError);
  });

  it("does not create a successful fake adapter without provider configuration", async () => {
    expect(() => createPaymentProviderAdapter(undefined)).toThrow(PaymentProviderNotConfiguredError);
    const adapter = createPaymentProviderAdapter("iyzico");

    await expect(adapter.createCheckout({
      organizationId: "organization",
      subscriptionId: "subscription",
      planCode: "monthly",
      billingInterval: "monthly",
      amountMinor: 100,
      currency: "TRY",
      customerEmail: "billing@example.test",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel"
    })).rejects.toThrow(PaymentProviderNotConfiguredError);
  });
});
