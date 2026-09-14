import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
import { removeOrganizationLogo, uploadOrganizationLogo } from "./organization-branding";

const organizationId = "91000000-0000-4000-8000-000000000001";
const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "logo.png", { type: "image/png" });

function setup(pending: boolean, changedDuringUpload = false) {
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async (paths: string[]) => { void paths; return { error: null }; });
  const update = vi.fn();
  let updating = false;
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), is: vi.fn(() => query),
    update: vi.fn(() => { updating = true; update(); return query; }),
    maybeSingle: vi.fn(async () => ({ error: null, data: updating
      ? changedDuringUpload ? null : { id: organizationId }
      : { name: "Company", logo_path: `${organizationId}/old.png`, deletion_started_at: pending ? "2026-09-14" : null } }))
  };
  const service = { from: () => query, storage: { from: () => ({ upload, remove }) } } as unknown as SupabaseClient;
  return { service, upload, remove, update, query };
}

describe("organization logo deletion freeze", () => {
  it("rejects uploading a logo after permanent deletion starts", async () => {
    const state = setup(true);
    await expect(uploadOrganizationLogo(state.service, organizationId, png)).rejects.toMatchObject({ status: 409 });
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
  it("rejects removing a logo after permanent deletion starts", async () => {
    const state = setup(true);
    await expect(removeOrganizationLogo(state.service, organizationId)).rejects.toMatchObject({ status: 409 });
    expect(state.remove).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
  it("cleans its new upload if deletion starts before the conditional update", async () => {
    const state = setup(false, true);
    await expect(uploadOrganizationLogo(state.service, organizationId, png)).rejects.toThrow();
    expect(state.query.is).toHaveBeenCalledWith("deletion_started_at", null);
    expect(state.remove).toHaveBeenCalledOnce();
    expect(state.remove.mock.calls[0]?.[0]).not.toContain(`${organizationId}/old.png`);
  });
});
