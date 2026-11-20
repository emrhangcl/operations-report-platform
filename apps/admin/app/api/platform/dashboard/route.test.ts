import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/server/guards", () => ({ requirePlatformAdmin: mocks.requirePlatformAdmin }));
vi.mock("../../../../lib/rate-limit", () => ({ enforceRateLimit: () => null }));
import { GET } from "./route";

type Call = { table: string; filters: Array<[string, string, unknown]> };

function createService(rows: Record<string, unknown[]> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, filters: [] };
    calls.push(call);
    const builder = {
      select: () => builder,
      order: () => builder,
      limit: () => builder,
      in: (column: string, value: unknown) => { call.filters.push([column, "in", value]); return builder; },
      eq: (column: string, value: unknown) => { call.filters.push([column, "eq", value]); return builder; },
      gte: (column: string, value: unknown) => { call.filters.push([column, "gte", value]); return builder; },
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows[table] ?? [], error: null })
    };
    return builder;
  };
  const rpc = vi.fn(async () => ({ data: {}, error: null }));
  return { service: { from, rpc }, calls };
}

const request = () => new Request("http://localhost/api/platform/dashboard");

describe("platform dashboard api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non platform admin without touching the database", async () => {
    const { service, calls } = createService();
    mocks.requirePlatformAdmin.mockResolvedValue({ ok: false, message: "Platform yöneticisi yetkisi gerekli.", status: 403 });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
    expect(service.rpc).not.toHaveBeenCalled();
  });

  it("returns a 90 day activity series built from succeeded payments only", async () => {
    const { service, calls } = createService();
    mocks.requirePlatformAdmin.mockResolvedValue({ ok: true, userId: "owner", service });
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { activity: unknown[] };
    expect(body.activity).toHaveLength(90);
    const paymentQuery = calls.find((call) => call.table === "payments");
    expect(paymentQuery?.filters).toContainEqual(["status", "eq", "succeeded"]);
    expect(paymentQuery?.filters.some(([column, op]) => column === "paid_at" && op === "gte")).toBe(true);
  });

  it("sums bigint amounts that the database driver returns as strings", async () => {
    const paidAt = new Date().toISOString();
    const { service } = createService({
      payments: [
        { amount_minor: "10000", refunded_amount_minor: "0", paid_at: paidAt },
        { amount_minor: "500", refunded_amount_minor: "100", paid_at: paidAt }
      ]
    });
    mocks.requirePlatformAdmin.mockResolvedValue({ ok: true, userId: "owner", service });
    const body = (await (await GET(request())).json()) as { activity: Array<{ collectedMinor: number }> };
    expect(body.activity.reduce((sum, day) => sum + day.collectedMinor, 0)).toBe(10400);
  });
});
