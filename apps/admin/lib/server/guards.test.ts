import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), rpc: vi.fn() }));

vi.mock("./auth/http", () => ({ authenticateRequest: mocks.authenticateRequest }));
vi.mock("./service-client", () => ({ createServiceClient: () => ({ rpc: mocks.rpc }) }));

import { requireActiveProfile, requireAdmin, requirePlatformAdmin } from "./guards";

const request = new Request("http://localhost:3000/api/admin/test");
const authenticated = { session: { userId: "user-1" }, transport: "cookie", token: "t" };

function context(overrides: Record<string, unknown> = {}) {
  return {
    data: [{
      organization_id: "org-1",
      organization_name: "Firma",
      organization_logo_path: null,
      profile_is_active: true,
      member_role: "ADMIN",
      membership_is_active: true,
      organization_status: "active",
      subscription_status: "lifetime",
      access_mode: "write",
      ...overrides
    }],
    error: null
  };
}

describe("authorization guards", () => {
  beforeEach(() => {
    mocks.authenticateRequest.mockReset();
    mocks.rpc.mockReset();
  });

  it("answers 401 without a valid session", async () => {
    mocks.authenticateRequest.mockResolvedValue(null);
    for (const guard of [requireAdmin, requireActiveProfile, requirePlatformAdmin]) {
      const result = await guard(request);
      expect(result).toMatchObject({ ok: false, status: 401 });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive profile", { profile_is_active: false }],
    ["inactive membership", { membership_is_active: false }],
    ["closed organization", { organization_status: "closed" }],
    ["blocked subscription", { access_mode: "blocked" }]
  ])("answers 403 for %s", async (_label, overrides) => {
    mocks.authenticateRequest.mockResolvedValue(authenticated);
    mocks.rpc.mockResolvedValue(context(overrides));
    await expect(requireActiveProfile(request)).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("separates read-only subscriptions from write access", async () => {
    mocks.authenticateRequest.mockResolvedValue(authenticated);
    mocks.rpc.mockResolvedValue(context({ access_mode: "read" }));
    await expect(requireActiveProfile(request, "read")).resolves.toMatchObject({ ok: true, accessMode: "read" });
    await expect(requireActiveProfile(request, "write")).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it("keeps personnel out of admin operations", async () => {
    mocks.authenticateRequest.mockResolvedValue(authenticated);
    mocks.rpc.mockResolvedValue(context({ member_role: "PERSONNEL" }));
    await expect(requireAdmin(request)).resolves.toMatchObject({ ok: false, status: 403 });
    await expect(requireActiveProfile(request)).resolves.toMatchObject({ ok: true, role: "PERSONNEL", organizationId: "org-1" });
  });

  it("requires an explicit platform administrator grant", async () => {
    mocks.authenticateRequest.mockResolvedValue(authenticated);
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(requirePlatformAdmin(request)).resolves.toMatchObject({ ok: false, status: 403 });
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(requirePlatformAdmin(request)).resolves.toMatchObject({ ok: true, userId: "user-1" });
  });
});
