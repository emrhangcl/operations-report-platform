// @ts-check
// Istemci adresinin soket ve guvenilir proxy zincirinden belirlenmesi (server.mjs tarafindan kullanilir).

import { isIP } from "node:net";

/** @param {string | null | undefined} address */
export function normalizeAddress(address) {
  if (!address) return null;
  const value = address.startsWith("::ffff:") ? address.slice(7) : address;
  return isIP(value) ? value : null;
}

/** @param {string | undefined} value */
export function parseTrustedProxies(value) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => normalizeAddress(item.trim()))
      .filter(/** @returns {item is string} */ (item) => Boolean(item))
  );
}

/**
 * Soket adresi guvenilir bir proxy degilse istemci odur; istemcinin gonderdigi zincir yok sayilir.
 * Guvenilir proxy'den gelen isteklerde zincirin sagindan baslanir ve ilk guvenilmeyen adres secilir.
 *
 * @param {string | null | undefined} socketAddress
 * @param {string | null | undefined} forwardedFor
 * @param {Set<string>} trustedProxies
 */
export function resolveClientAddress(socketAddress, forwardedFor, trustedProxies) {
  const peer = normalizeAddress(socketAddress);
  if (!peer || !trustedProxies.has(peer) || !forwardedFor) return peer;

  const chain = forwardedFor.split(",").map((item) => normalizeAddress(item.trim()));
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = chain[index];
    if (!candidate) return peer;
    if (!trustedProxies.has(candidate)) return candidate;
  }
  return peer;
}
