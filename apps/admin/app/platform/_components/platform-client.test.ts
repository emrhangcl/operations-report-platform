import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../../lib/browser-client", () => ({ scopeHeaders: () => ({ "X-Auth-Scope": "admin" }) }));
import { platformRequest } from "./platform-client";
afterEach(() => vi.unstubAllGlobals());

it("reloads server state after a partially completed deletion returns an error", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ deletion_started_at: null })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Auth cleanup failed" }), { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ deletion_started_at: "2026-09-14" })));
  vi.stubGlobal("fetch", fetchMock);
  expect(await platformRequest("/api/platform/organizations/review")).toEqual({ deletion_started_at: null });
  await expect(platformRequest("/api/platform/organizations/review", { method: "DELETE" })).rejects.toThrow("Auth cleanup failed");
  expect(await platformRequest("/api/platform/organizations/review")).toEqual({ deletion_started_at: "2026-09-14" });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
