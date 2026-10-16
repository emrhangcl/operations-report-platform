import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("../../../../../lib/server/guards", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../../../lib/rate-limit", () => ({ enforceRateLimit: () => null }));

import { DELETE } from "./route";

describe("personnel deletion", () => {
  beforeEach(() => vi.clearAllMocks());

  function setup({ deleteError = null, found = true }:
    { deleteError?: { code?: string; message: string } | null; found?: boolean } = {}) {
    const calls: string[] = [];
    const filters: Array<[string, string, unknown]> = [];
    const service = {
      from(table: string) {
        let operation = "select";
        const query = {
          select() { return query; },
          delete() { operation = "delete"; return query; },
          insert() { operation = "insert"; return query; },
          eq(key: string, value: unknown) { filters.push([table, key, value]); return query; },
          maybeSingle() { return query; },
          then(resolve: (result: unknown) => void) {
            calls.push(`${table}:${operation}`);
            const data = table === "profiles" && operation === "select" && found
              ? { id: "personnel", first_name: "Ada", last_name: "Yilmaz", email: "ada@example.test", role: "PERSONNEL" }
              : null;
            const error = table === "profiles" && operation === "delete" ? deleteError : null;
            return Promise.resolve({ data, error }).then(resolve);
          }
        };
        return query;
      },
      auth: {
        admin: {
          deleteUser: vi.fn(async () => {
            calls.push("auth:delete");
            return { error: null };
          })
        }
      }
    };
    mocks.requireAdmin.mockResolvedValue({
      ok: true,
      service,
      organizationId: "organization-a",
      userId: "admin"
    });
    return { calls, filters };
  }

  const invoke = (id = "personnel") => DELETE(
    new Request(`http://localhost/api/admin/personnel/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) }
  );

  it("scopes the profile lookup and deletion to the admin organization", async () => {
    const { calls, filters } = setup();

    expect((await invoke()).status).toBe(200);
    expect(calls).toEqual(["profiles:select", "profiles:delete", "auth:delete", "audit_logs:insert"]);
    expect(filters).toContainEqual(["profiles", "organization_id", "organization-a"]);
    expect(filters.filter(([table, key]) => table === "profiles" && key === "organization_id")).toHaveLength(2);
  });

  it("does not delete auth identity when history-preserving constraints block profile deletion", async () => {
    const { calls } = setup({ deleteError: { code: "23503", message: "foreign key violation" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await invoke();
    const body = await response.json() as { message: string };

    expect(response.status).toBe(409);
    expect(body.message).toContain("Veritabanı güncellemesi gerekli");
    expect(calls).toEqual(["profiles:select", "profiles:delete"]);
    log.mockRestore();
  });

  it("does not touch a profile outside the authorized organization", async () => {
    const { calls } = setup({ found: false });

    expect((await invoke()).status).toBe(404);
    expect(calls).toEqual(["profiles:select"]);
  });

  it("prevents an admin from deleting their own account", async () => {
    setup();

    expect((await invoke("admin")).status).toBe(400);
  });
});
