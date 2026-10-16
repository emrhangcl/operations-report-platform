import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getServerConfig } from "../config";

/** 256 bit rastgele, URL guvenli belirtec. Veritabaninda yalnizca ozeti saklanir. */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function hmac(purpose: string, value: string) {
  // Amac etiketi ayni anahtarla farkli baglamlarda uretilen imzalarin birbirinin yerine
  // kullanilmasini engeller.
  return createHmac("sha256", getServerConfig().authSecret).update(`${purpose}\n${value}`, "utf8").digest("base64url");
}

export function signValue(purpose: string, value: string) {
  return hmac(purpose, value);
}

export function verifySignedValue(purpose: string, value: string, signature: string) {
  const expected = Buffer.from(hmac(purpose, value), "utf8");
  const actual = Buffer.from(signature, "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
