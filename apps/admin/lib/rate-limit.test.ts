import { describe, expect, it } from "vitest";

import { enforceRateLimit } from "./rate-limit";

const url = "http://localhost:3000/api/admin/test";
let scopeCounter = 0;

// Sınırlayıcılar modül düzeyinde paylaşılır; her test kendi kapsamını kullanır ki sayaçlar karışmasın.
function uniqueScope() {
  scopeCounter += 1;
  return `test-scope-${scopeCounter}`;
}

function requestWith(headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers });
}

describe("enforceRateLimit", () => {
  it("returns null while requests stay within the limit", () => {
    const scope = uniqueScope();
    const request = requestWith({ "x-forwarded-for": "203.0.113.1" });

    expect(enforceRateLimit(request, scope, { limit: 2 })).toBeNull();
    expect(enforceRateLimit(request, scope, { limit: 2 })).toBeNull();
  });

  it("returns a 429 response with message, request id and headers once the limit is exceeded", async () => {
    const scope = uniqueScope();
    const request = requestWith({ "x-forwarded-for": "203.0.113.2", "x-request-id": "req-429" });

    enforceRateLimit(request, scope, { limit: 1 });
    const response = enforceRateLimit(request, scope, { limit: 1 });

    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(response!.headers.get("Cache-Control")).toBe("no-store");
    expect(response!.headers.get("X-Request-ID")).toBe("req-429");
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    await expect(response!.json()).resolves.toEqual({
      message: "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
      request_id: "req-429"
    });
  });

  it("generates a request id when the incoming one is missing", async () => {
    const scope = uniqueScope();
    const request = requestWith({ "x-forwarded-for": "203.0.113.3" });

    enforceRateLimit(request, scope, { limit: 1 });
    const response = enforceRateLimit(request, scope, { limit: 1 });
    const body = (await response!.json()) as { request_id: string };

    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response!.headers.get("X-Request-ID")).toBe(body.request_id);
  });

  it("uses the first x-forwarded-for value as the client identity", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }), scope, { limit: 1 });

    // Aynı ilk IP, farklı ara vekil: aynı sayaç.
    expect(
      enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.1, 10.0.0.2" }), scope, { limit: 1 })?.status
    ).toBe(429);
    // Farklı ilk IP: ayrı sayaç.
    expect(
      enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" }), scope, { limit: 1 })
    ).toBeNull();
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.10", "x-real-ip": "192.0.2.1" }), scope, {
      limit: 1
    });

    expect(enforceRateLimit(requestWith({ "x-real-ip": "192.0.2.1" }), scope, { limit: 1 })).toBeNull();
    expect(enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.10" }), scope, { limit: 1 })?.status).toBe(
      429
    );
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith({ "x-real-ip": "192.0.2.5" }), scope, { limit: 1 });

    expect(enforceRateLimit(requestWith({ "x-real-ip": "192.0.2.5" }), scope, { limit: 1 })?.status).toBe(429);
    expect(enforceRateLimit(requestWith({ "x-real-ip": "192.0.2.6" }), scope, { limit: 1 })).toBeNull();
  });

  it("counts requests without forwarding headers under a shared unknown identity", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith(), scope, { limit: 1 });

    expect(enforceRateLimit(requestWith(), scope, { limit: 1 })?.status).toBe(429);
  });

  it("counts by options.identity instead of the client IP when provided", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.20" }), scope, { limit: 1, identity: "user-a" });

    // Aynı kullanıcı, farklı IP: aynı sayaç.
    expect(
      enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.21" }), scope, { limit: 1, identity: "user-a" })
        ?.status
    ).toBe(429);
    // Aynı IP, farklı kullanıcı: ayrı sayaç.
    expect(
      enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.20" }), scope, { limit: 1, identity: "user-b" })
    ).toBeNull();
  });

  it("keeps separate counters for different scopes", () => {
    const firstScope = uniqueScope();
    const secondScope = uniqueScope();
    const request = requestWith({ "x-forwarded-for": "198.51.100.30" });

    enforceRateLimit(request, firstScope, { limit: 1 });
    expect(enforceRateLimit(request, firstScope, { limit: 1 })?.status).toBe(429);

    expect(enforceRateLimit(request, secondScope, { limit: 1 })).toBeNull();
  });

  // Mevcut davranışın belgesi: x-forwarded-for istemciden gelebilir; vekil başlığı temizlemezse
  // her istekte farklı değer gönderen istemci IP sınırını aşabilir.
  it("trusts the client-supplied x-forwarded-for value as is", () => {
    const scope = uniqueScope();

    enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.40" }), scope, { limit: 1 });

    expect(enforceRateLimit(requestWith({ "x-forwarded-for": "198.51.100.41" }), scope, { limit: 1 })).toBeNull();
  });
});
