import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  createPaymentProviderAdapter: vi.fn(),
  verifyWebhook: vi.fn(),
  enforceRateLimit: vi.fn(),
  createServiceClient: vi.fn(),
  rpc: vi.fn()
}));
vi.mock("server-only", () => ({}));
vi.mock("@operations/payments", async () => ({ ...await vi.importActual<object>("@operations/payments"), createPaymentProviderAdapter: mocks.createPaymentProviderAdapter }));
vi.mock("../../../../../lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("../../../../../lib/server/service-client", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("../../../../../lib/observability", () => ({ getRequestId: () => "test-request", logRequestError: vi.fn() }));
import { InvalidPaymentSignatureError, PaymentProviderNotConfiguredError, type NormalizedPaymentEvent } from "@operations/payments";
import { POST } from "./route";

const rawBody = JSON.stringify({ id: "evt_1", type: "payment.succeeded" });
const event: NormalizedPaymentEvent = {
  provider: "iyzico",
  externalEventId: "evt_1",
  eventType: "payment.succeeded",
  providerCustomerId: "cus_1",
  providerSubscriptionId: "sub_1",
  externalPaymentId: "pay_1",
  amountMinor: 49900,
  currency: "TRY",
  occurredAt: "2026-10-24T10:00:00.000Z",
  periodStartAt: "2026-10-24T00:00:00.000Z",
  periodEndAt: "2026-11-24T00:00:00.000Z"
};
const request = (body: string = rawBody) => new Request("http://localhost/api/payments/webhooks/iyzico", { method: "POST", headers: { "content-type": "application/json" }, body });
const params = (provider = "iyzico") => ({ params: Promise.resolve({ provider }) });

describe("payment webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceRateLimit.mockReturnValue(null);
    mocks.verifyWebhook.mockResolvedValue(event);
    mocks.createPaymentProviderAdapter.mockReturnValue({ name: "iyzico", verifyWebhook: mocks.verifyWebhook });
    mocks.rpc.mockResolvedValue({ data: { applied: true }, error: null });
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc });
  });

  it("returns 404 for an unknown provider before reading the body", async () => {
    const response = await POST(request(), params("stripe"));
    expect(response.status).toBe(404);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createPaymentProviderAdapter).not.toHaveBeenCalled();
  });

  it("returns the rate limit response without reading the body", async () => {
    mocks.enforceRateLimit.mockReturnValue(new Response(null, { status: 429 }));
    const req = request();
    const response = await POST(req, params());
    expect(response.status).toBe(429);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(req, "payment-webhook:iyzico");
    expect(req.bodyUsed).toBe(false);
    expect(mocks.createPaymentProviderAdapter).not.toHaveBeenCalled();
  });

  it("returns 413 for a body above 256 KB", async () => {
    const response = await POST(request("x".repeat(256 * 1024 + 1)), params());
    expect(response.status).toBe(413);
    expect(mocks.createPaymentProviderAdapter).not.toHaveBeenCalled();
  });

  it("returns 503 when the requested provider is not the active one", async () => {
    mocks.createPaymentProviderAdapter.mockReturnValue({ name: "paytr", verifyWebhook: mocks.verifyWebhook });
    const response = await POST(request(), params());
    expect(response.status).toBe(503);
    expect(mocks.verifyWebhook).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 when no payment provider is configured", async () => {
    mocks.createPaymentProviderAdapter.mockImplementation(() => { throw new PaymentProviderNotConfiguredError("none"); });
    expect((await POST(request(), params())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 503 when the active provider is not configured", async () => {
    mocks.verifyWebhook.mockRejectedValue(new PaymentProviderNotConfiguredError("iyzico"));
    expect((await POST(request(), params())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid signature and records nothing", async () => {
    mocks.verifyWebhook.mockRejectedValue(new InvalidPaymentSignatureError());
    expect((await POST(request(), params())).status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 400 when the verified event belongs to another provider", async () => {
    mocks.verifyWebhook.mockResolvedValue({ ...event, provider: "paytr" });
    expect((await POST(request(), params())).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("normalizes the provider path segment", async () => {
    expect((await POST(request(), params(" IYZICO "))).status).toBe(200);
  });

  it("records a verified event exactly once with the raw body hash", async () => {
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, applied: true });
    expect(mocks.verifyWebhook).toHaveBeenCalledWith({ rawBody, headers: expect.any(Headers) });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("process_verified_payment_event", {
      p_provider: "iyzico",
      p_external_event_id: "evt_1",
      p_event_type: "payment.succeeded",
      p_provider_customer_id: "cus_1",
      p_provider_subscription_id: "sub_1",
      p_external_payment_id: "pay_1",
      p_amount_minor: 49900,
      p_currency: "TRY",
      p_occurred_at: "2026-10-24T10:00:00.000Z",
      p_period_start_at: "2026-10-24T00:00:00.000Z",
      p_period_end_at: "2026-11-24T00:00:00.000Z",
      p_payload_hash: createHash("sha256").update(rawBody, "utf8").digest("hex")
    });
  });

  it("reports a redelivered event as not applied", async () => {
    mocks.rpc.mockResolvedValue({ data: { applied: false }, error: null });
    const response = await POST(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, applied: false });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when the service client is not configured", async () => {
    mocks.createServiceClient.mockImplementation(() => { throw new Error("missing"); });
    expect((await POST(request(), params())).status).toBe(503);
  });

  it("returns 500 when the event cannot be persisted", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("db") });
    expect((await POST(request(), params())).status).toBe(500);
  });
});
