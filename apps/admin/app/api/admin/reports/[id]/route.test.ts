import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("../../../../../lib/server/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../../../lib/rate-limit", () => ({ enforceRateLimit: () => null }));
import { DELETE } from "./route";

describe("report deletion preserves signed evidence until parent deletion", () => {
  beforeEach(() => vi.clearAllMocks());
  function setup(failDelete = false, found = true) {
    const calls: string[] = [];
    const filters: Array<[string, string, unknown]> = [];
    const service = {
      from(table: string) {
        let operation = "select";
        const query = {
          select() { return query; }, eq(key: string, value: unknown) { filters.push([table, key, value]); return query; },
          maybeSingle() { return query; }, update() { operation = "update"; return query; },
          delete() { operation = "delete"; return query; }, insert() { operation = "insert"; return query; },
          then(resolve: (result: unknown) => void) {
            calls.push(`${table}:${operation}`);
            return Promise.resolve({ data: table === "reports" ? (found ? { id: "report" } : null) : table === "report_photos" ? [{ storage_path: "org/report/photo.jpg" }] : null,
              error: failDelete && operation === "delete" ? { message: "blocked" } : null }).then(resolve);
          }
        };
        return query;
      },
      storage: { from: () => ({ remove: async () => { calls.push("storage:remove"); return { error: null }; } }) }
    };
    mocks.requireAdmin.mockResolvedValue({ ok: true, service, organizationId: "org", userId: "admin" });
    return { calls, filters };
  }
  const invoke = () => DELETE(new Request("http://localhost/api/admin/reports/report", { method: "DELETE" }), { params: Promise.resolve({ id: "report" }) });
  it("deletes parent first, relies on atomic FK cascades, then cleans storage", async () => {
    const { calls, filters } = setup();
    expect((await invoke()).status).toBe(200);
    expect(calls.indexOf("storage:remove")).toBeGreaterThan(calls.indexOf("reports:delete"));
    expect(calls.filter((call) => call.endsWith(":delete"))).toEqual(["reports:delete"]);
    expect(filters).toContainEqual(["reports", "organization_id", "org"]);
  });
  it("does not remove approved attachments when the parent delete fails", async () => {
    const { calls } = setup(true);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await invoke()).status).toBe(500);
    expect(calls).not.toContain("storage:remove");
    log.mockRestore();
  });
  it("does not touch a report outside the authorized lookup", async () => {
    const { calls } = setup(false, false);
    expect((await invoke()).status).toBe(404);
    expect(calls).toEqual(["reports:select"]);
  });
  it("requires admin authorization before any data access", async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, message: "Yetkisiz", status: 403 });
    expect((await invoke()).status).toBe(403);
  });
});
