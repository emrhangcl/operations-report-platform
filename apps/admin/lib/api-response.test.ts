import { beforeEach, describe, expect, it, vi } from "vitest";

import { logRequestError } from "./observability";
import { apiError, withRequestId } from "./api-response";

vi.mock("./observability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./observability")>();
  return { ...actual, logRequestError: vi.fn() };
});

const url = "http://localhost:3000/api/admin/test";

function requestWith(headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers });
}

describe("apiError", () => {
  beforeEach(() => {
    vi.mocked(logRequestError).mockClear();
  });

  it("returns the given status with message, request id and no-store headers", async () => {
    const response = apiError(requestWith({ "x-request-id": "req-400" }), 400, "Geçersiz istek.");

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-ID")).toBe("req-400");
    await expect(response.json()).resolves.toEqual({ message: "Geçersiz istek.", request_id: "req-400" });
  });

  it("generates a request id when the incoming one is invalid", async () => {
    const response = apiError(requestWith({ "x-request-id": "geçersiz kimlik" }), 404, "Bulunamadı.");
    const body = (await response.json()) as { request_id: string };

    expect(response.status).toBe(404);
    expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("X-Request-ID")).toBe(body.request_id);
  });

  it("logs the error with the given event when an error is passed", () => {
    const request = requestWith({ "x-request-id": "req-500" });
    const error = new Error("veritabanı hatası");

    apiError(request, 500, "Sunucu hatası.", "report_save_failed", error);

    expect(logRequestError).toHaveBeenCalledTimes(1);
    expect(logRequestError).toHaveBeenCalledWith(request, "report_save_failed", error);
  });

  it("does not log when no error is passed", () => {
    apiError(requestWith(), 403, "Yetkiniz yok.");

    expect(logRequestError).not.toHaveBeenCalled();
  });
});

describe("withRequestId", () => {
  it("adds the incoming request id header and returns the same response", () => {
    const response = new Response("ok");

    const result = withRequestId(requestWith({ "x-request-id": "req-ok" }), response);

    expect(result).toBe(response);
    expect(result.headers.get("X-Request-ID")).toBe("req-ok");
  });

  it("adds a generated request id when the incoming one is missing", () => {
    const result = withRequestId(requestWith(), new Response("ok"));

    expect(result.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
