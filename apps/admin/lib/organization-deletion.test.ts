import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { deletePlatformOrganization } from "./organization-deletion";

const organizationId = "91000000-0000-4000-8000-000000000001";
const actorId = "92000000-0000-4000-8000-000000000001";
const userId = "92000000-0000-4000-8000-000000000002";

function setup(options: { storageError?: boolean; authCode?: string; rpcError?: string; invalidPath?: boolean; self?: boolean } = {}) {
  const calls: string[] = [];
  const rpc = vi.fn(async (name: string) => {
    calls.push(name);
    return { error: name === options.rpcError ? { code: "23514", message: "protected_organization_accounts" } : null,
      data: name === "platform_prepare_organization_deletion" ? {
        organization_id: organizationId, user_ids: [options.self ? actorId : userId],
        storage_objects: [{ bucket: "report-photos", name: `${options.invalidPath ? "other-organization" : organizationId}/report/photo.jpg` }]
      } : {} };
  });
  const remove = vi.fn(async () => { calls.push("storage.remove"); return { error: options.storageError ? { message: "unavailable" } : null }; });
  const deleteUser = vi.fn(async () => { calls.push("auth.deleteUser"); return { error: options.authCode ? { code: options.authCode } : null }; });
  const service = { rpc, storage: { from: () => ({ remove }) }, auth: { admin: { deleteUser } } } as unknown as SupabaseClient;
  return { service, calls, rpc, remove, deleteUser };
}

describe("platform organization deletion", () => {
  it("uses a durable server manifest and finishes only after storage, data and Auth cleanup", async () => {
    const state = setup();
    expect(await deletePlatformOrganization(state.service, organizationId, "company", actorId)).toEqual({ deletedAccounts: 1 });
    expect(state.calls).toEqual(["platform_prepare_organization_deletion", "platform_purge_organization_data", "storage.remove", "auth.deleteUser", "platform_finish_organization_deletion"]);
    expect(state.rpc).toHaveBeenCalledWith("platform_prepare_organization_deletion", { target_organization_id: organizationId, confirmation_slug: "company", actor_user_id: actorId });
    expect(state.deleteUser).toHaveBeenCalledWith(userId);
  });
  it.each([{ invalidPath: true }, { self: true }, { rpcError: "platform_prepare_organization_deletion" }])
  ("refuses unsafe scope before external cleanup: %j", async (options) => {
    const state = setup(options);
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).rejects.toThrow();
    expect(state.remove).not.toHaveBeenCalled();
    expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("does not delete Auth accounts after a storage cleanup failure", async () => {
    const state = setup({ storageError: true });
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).rejects.toThrow();
    expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("does not delete Auth users if the atomic data purge fails", async () => {
    const state = setup({ rpcError: "platform_purge_organization_data" });
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).rejects.toThrow();
    expect(state.remove).not.toHaveBeenCalled();
    expect(state.deleteUser).not.toHaveBeenCalled();
  });
  it("does not report success when an Auth account remains", async () => {
    const state = setup({ authCode: "unexpected_failure" });
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).rejects.toThrow();
    expect(state.calls).not.toContain("platform_finish_organization_deletion");
  });
  it("allows a retry when an Auth user was already deleted", async () => {
    const state = setup({ authCode: "user_not_found" });
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).resolves.toEqual({ deletedAccounts: 1 });
  });
  it("does not report success when final deletion fails", async () => {
    const state = setup({ rpcError: "platform_finish_organization_deletion" });
    await expect(deletePlatformOrganization(state.service, organizationId, "company", actorId)).rejects.toThrow();
  });
});
