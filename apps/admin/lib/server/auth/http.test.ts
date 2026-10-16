import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveSession: vi.fn() }));

vi.mock("../config", () => ({
  getServerConfig: () => ({ appUrl: new URL("http://localhost:3000"), secureCookies: false })
}));
vi.mock("./sessions", () => ({
  isSessionScope: (value: unknown) => value === "admin" || value === "personnel",
  resolveSession: mocks.resolveSession
}));

import { authenticateRequest, hasSessionCredentials, isSameOriginRequest } from "./http";

const token = "a".repeat(43);

function request(method: string, headers: Record<string, string>) {
  return new Request("http://localhost:3000/api/data", { method, headers });
}

function session(overrides: Record<string, unknown> = {}) {
  return { sessionId: "s", userId: "u", email: "a@b.c", emailConfirmedAt: null, scope: "admin", client: "web", expiresAt: new Date(), ...overrides };
}

describe("isSameOriginRequest", () => {
  it("accepts the application origin and rejects foreign origins", () => {
    expect(isSameOriginRequest(request("POST", { Origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOriginRequest(request("POST", { Origin: "https://evil.example" }))).toBe(false);
  });

  it("falls back to Sec-Fetch-Site and Referer, and fails closed without them", () => {
    expect(isSameOriginRequest(request("POST", { "Sec-Fetch-Site": "same-origin" }))).toBe(true);
    expect(isSameOriginRequest(request("POST", { "Sec-Fetch-Site": "cross-site" }))).toBe(false);
    expect(isSameOriginRequest(request("POST", { Referer: "http://localhost:3000/app" }))).toBe(true);
    expect(isSameOriginRequest(request("POST", {}))).toBe(false);
  });
});

describe("authenticateRequest", () => {
  beforeEach(() => mocks.resolveSession.mockReset());

  it("ignores session cookies unless the request names its scope", async () => {
    await expect(authenticateRequest(request("GET", { Cookie: `ops_admin_session=${token}` }))).resolves.toBeNull();
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it("accepts a same-origin cookie session for the requested scope", async () => {
    mocks.resolveSession.mockResolvedValue(session());
    const result = await authenticateRequest(request("POST", {
      Cookie: `ops_admin_session=${token}`,
      "X-Auth-Scope": "admin",
      Origin: "http://localhost:3000"
    }));
    expect(result?.transport).toBe("cookie");
  });

  it("rejects cross-origin writes that carry a valid cookie (CSRF)", async () => {
    mocks.resolveSession.mockResolvedValue(session());
    await expect(authenticateRequest(request("POST", {
      Cookie: `ops_admin_session=${token}`,
      "X-Auth-Scope": "admin",
      Origin: "https://evil.example"
    }))).resolves.toBeNull();
    expect(mocks.resolveSession).not.toHaveBeenCalled();
  });

  it("does not let one scope's cookie authenticate the other scope", async () => {
    mocks.resolveSession.mockResolvedValue(session({ scope: "admin" }));
    await expect(authenticateRequest(request("GET", {
      Cookie: `ops_personnel_session=${token}`,
      "X-Auth-Scope": "personnel"
    }))).resolves.toBeNull();
  });

  it("accepts bearer tokens only for mobile sessions", async () => {
    mocks.resolveSession.mockResolvedValueOnce(session({ client: "web" }));
    await expect(authenticateRequest(request("GET", { Authorization: `Bearer ${token}` }))).resolves.toBeNull();

    mocks.resolveSession.mockResolvedValueOnce(session({ client: "mobile", scope: "personnel" }));
    const mobile = await authenticateRequest(request("POST", { Authorization: `Bearer ${token}` }));
    expect(mobile?.transport).toBe("bearer");
  });

  it("reports whether credentials were presented at all", () => {
    expect(hasSessionCredentials(request("GET", {}))).toBe(false);
    expect(hasSessionCredentials(request("GET", { "X-Auth-Scope": "admin" }))).toBe(false);
    expect(hasSessionCredentials(request("GET", { "X-Auth-Scope": "admin", Cookie: `ops_admin_session=${token}` }))).toBe(true);
  });
});
