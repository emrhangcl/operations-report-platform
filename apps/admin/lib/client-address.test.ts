import { describe, expect, it } from "vitest";
import { normalizeAddress, parseTrustedProxies, resolveClientAddress } from "./client-address.mjs";

const none = parseTrustedProxies("");
const localProxy = parseTrustedProxies("127.0.0.1, ::1");

describe("resolveClientAddress", () => {
  it("ignores forwarded headers when there is no trusted proxy", () => {
    expect(resolveClientAddress("198.51.100.7", "203.0.113.9", none)).toBe("198.51.100.7");
    expect(resolveClientAddress("::ffff:198.51.100.7", "1.2.3.4, 5.6.7.8", none)).toBe("198.51.100.7");
  });

  it("ignores forwarded headers sent directly by an untrusted client", () => {
    expect(resolveClientAddress("198.51.100.7", "127.0.0.1", localProxy)).toBe("198.51.100.7");
  });

  it("takes the right-most untrusted address behind a trusted proxy", () => {
    // Istemci kendi sahte adresini zincirin basina ekler; proxy gercek adresi sona yazar.
    expect(resolveClientAddress("127.0.0.1", "203.0.113.66, 198.51.100.7", localProxy)).toBe("198.51.100.7");
    expect(resolveClientAddress("::1", "198.51.100.7, 127.0.0.1", localProxy)).toBe("198.51.100.7");
  });

  it("falls back to the proxy address when the chain is malformed", () => {
    expect(resolveClientAddress("127.0.0.1", "not-an-ip", localProxy)).toBe("127.0.0.1");
    expect(resolveClientAddress("127.0.0.1", undefined, localProxy)).toBe("127.0.0.1");
  });

  it("normalizes IPv4-mapped IPv6 and rejects garbage", () => {
    expect(normalizeAddress("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(normalizeAddress("10.0.0.1; drop")).toBeNull();
    expect(parseTrustedProxies("127.0.0.1,bogus,::1")).toEqual(new Set(["127.0.0.1", "::1"]));
  });
});
