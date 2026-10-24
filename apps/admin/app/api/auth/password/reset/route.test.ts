import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resetPasswordWithToken: vi.fn() }));

vi.mock("../../../../../lib/server/auth/flows", () => ({ resetPasswordWithToken: mocks.resetPasswordWithToken }));
vi.mock("../../../../../lib/rate-limit", () => ({ enforceRateLimit: () => null }));

import { POST } from "./route";

const validToken = "a".repeat(43);
const invalidLinkMessage = "Bağlantı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.";

describe("password reset", () => {
  beforeEach(() => vi.clearAllMocks());

  const invoke = async (body: unknown) => {
    const response = await POST(new Request("http://localhost/api/auth/password/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }));
    return { status: response.status, body: await response.json() as { message?: string; ok?: boolean } };
  };

  it.each([
    ["malformed", "bozuk-token"],
    ["missing", undefined]
  ])("returns the invalid link message for a %s token even with a valid password", async (_, token) => {
    const result = await invoke({ token, password: "gecerli-parola-123" });
    expect(result).toEqual({ status: 400, body: { message: invalidLinkMessage } });
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("uses the same message for a well-formed but expired token", async () => {
    mocks.resetPasswordWithToken.mockResolvedValue(false);
    const result = await invoke({ token: validToken, password: "gecerli-parola-123" });
    expect(result).toEqual({ status: 400, body: { message: invalidLinkMessage } });
  });

  it("rejects a password shorter than 10 characters", async () => {
    const result = await invoke({ token: validToken, password: "kisa" });
    expect(result).toEqual({ status: 400, body: { message: "Yeni parola en az 10 karakter olmalıdır." } });
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("rejects a password longer than 256 characters", async () => {
    const result = await invoke({ token: validToken, password: "a".repeat(257) });
    expect(result).toEqual({ status: 400, body: { message: "Yeni parola en fazla 256 karakter olabilir." } });
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("rejects a missing password with the length message", async () => {
    const result = await invoke({ token: validToken });
    expect(result).toEqual({ status: 400, body: { message: "Yeni parola en az 10 karakter olmalıdır." } });
  });

  it("resets the password for a valid token and password", async () => {
    mocks.resetPasswordWithToken.mockResolvedValue(true);
    const result = await invoke({ token: validToken, password: "gecerli-parola-123" });
    expect(result).toEqual({ status: 200, body: { ok: true } });
    expect(mocks.resetPasswordWithToken).toHaveBeenCalledWith(validToken, "gecerli-parola-123", expect.anything());
  });
});
