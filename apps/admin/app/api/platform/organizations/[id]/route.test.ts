import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requirePlatformAdmin: vi.fn(), deletePlatformOrganization: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../../lib/server/guards", () => ({ requirePlatformAdmin: mocks.requirePlatformAdmin }));
vi.mock("../../../../../lib/rate-limit", () => ({ enforceRateLimit: () => null }));
vi.mock("../../../../../lib/organization-branding", () => ({ createOrganizationLogoUrl: vi.fn() }));
vi.mock("../../../../../lib/organization-deletion", async () => ({ ...await vi.importActual<object>("../../../../../lib/organization-deletion"), deletePlatformOrganization: mocks.deletePlatformOrganization }));
import { DELETE, PATCH } from "./route";

const id = "91000000-0000-4000-8000-000000000001";
const rpc = vi.fn(async () => ({ error: null, data: { status: "active" } }));
const request = (body: unknown, method = "DELETE") => new Request(`http://localhost/api/platform/organizations/${id}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id }) };

describe("organization platform administration", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requirePlatformAdmin.mockResolvedValue({ ok: true, userId: "actor", service: { rpc } }); mocks.deletePlatformOrganization.mockResolvedValue({ deletedAccounts: 2 }); });
  it("rejects an ordinary tenant user before deletion", async () => {
    mocks.requirePlatformAdmin.mockResolvedValue({ ok: false, message: "Platform yöneticisi yetkisi gerekli.", status: 403 });
    expect((await DELETE(request({ confirmationSlug: "company", confirmDeletion: true }), params)).status).toBe(403);
    expect(mocks.deletePlatformOrganization).not.toHaveBeenCalled();
  });
  it.each([{ confirmationSlug: "company" }, { confirmationSlug: "company", confirmDeletion: false }, { confirmationSlug: "company", confirmDeletion: true, userIds: ["other"] }])
  ("rejects missing confirmation or a client-defined scope: %j", async (body) => {
    expect((await DELETE(request(body), params)).status).toBe(400);
    expect(mocks.deletePlatformOrganization).not.toHaveBeenCalled();
  });
  it("requires a UUID organization identity", async () => {
    expect((await DELETE(request({ confirmationSlug: "company", confirmDeletion: true }), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
    expect(mocks.deletePlatformOrganization).not.toHaveBeenCalled();
  });
  it("returns success only after the full deletion service succeeds", async () => {
    const response = await DELETE(request({ confirmationSlug: "company", confirmDeletion: true }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, deletedAccounts: 2 });
    expect(mocks.deletePlatformOrganization).toHaveBeenCalledWith({ rpc }, id, "company", "actor");
  });
  it("reactivates a closed organization through the authorized status RPC", async () => {
    expect((await PATCH(request({ action: "activate" }, "PATCH"), params)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("platform_set_organization_status", { target_organization_id: id, target_status: "active", actor_user_id: "actor" });
  });
});
