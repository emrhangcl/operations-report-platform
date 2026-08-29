import { createHmac, timingSafeEqual } from "node:crypto";

export class InvalidPaymentSignatureError extends Error {
  constructor() {
    super("Payment webhook signature is invalid.");
    this.name = "InvalidPaymentSignatureError";
  }
}

export function hmacSha256Hex(secret: string, message: string) {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export function hmacSha256Base64(secret: string, message: string) {
  return createHmac("sha256", secret).update(message, "utf8").digest("base64");
}

export function signaturesMatch(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export function assertHmacSignature(input: {
  secret: string;
  message: string;
  provided: string | null | undefined;
  encoding: "hex" | "base64";
}) {
  const expected = input.encoding === "hex"
    ? hmacSha256Hex(input.secret, input.message)
    : hmacSha256Base64(input.secret, input.message);

  if (!input.provided || !signaturesMatch(input.provided, expected)) {
    throw new InvalidPaymentSignatureError();
  }
}
