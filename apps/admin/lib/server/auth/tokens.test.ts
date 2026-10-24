import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ authSecret: "test-auth-secret-0123456789abcdef" }));

vi.mock("server-only", () => ({}));
vi.mock("../config", () => ({ getServerConfig: () => config }));

import { generateToken, hashToken, signValue, verifySignedValue } from "./tokens";

describe("generateToken", () => {
  it("returns a 43 character URL-safe token", () => {
    expect(generateToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("returns a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashToken", () => {
  it("is a deterministic 64 character hex SHA-256 digest", () => {
    expect(hashToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken(generateToken())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different inputs", () => {
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
  });
});

describe("signValue / verifySignedValue", () => {
  beforeEach(() => {
    config.authSecret = "test-auth-secret-0123456789abcdef";
  });

  it("signs the purpose-tagged value with HMAC-SHA256 as base64url", () => {
    const expected = createHmac("sha256", config.authSecret).update("session\nuser-1", "utf8").digest("base64url");
    expect(signValue("session", "user-1")).toBe(expected);
  });

  it("accepts a valid signature", () => {
    const signature = signValue("session", "user-1");
    expect(verifySignedValue("session", "user-1", signature)).toBe(true);
  });

  it("rejects a tampered signature of the same length", () => {
    const signature = signValue("session", "user-1");
    const tampered = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(verifySignedValue("session", "user-1", tampered)).toBe(false);
  });

  it("rejects a signature created for another purpose", () => {
    const signature = signValue("password-reset", "user-1");
    expect(verifySignedValue("session", "user-1", signature)).toBe(false);
  });

  it("rejects a signature for a modified value", () => {
    const signature = signValue("session", "user-1");
    expect(verifySignedValue("session", "user-2", signature)).toBe(false);
  });

  it("rejects signatures of a different length without throwing", () => {
    const signature = signValue("session", "user-1");
    for (const candidate of ["", signature.slice(0, -1), `${signature}A`, "x".repeat(200)]) {
      expect(() => verifySignedValue("session", "user-1", candidate)).not.toThrow();
      expect(verifySignedValue("session", "user-1", candidate)).toBe(false);
    }
  });

  it("rejects signatures created with a different secret", () => {
    const signature = signValue("session", "user-1");
    config.authSecret = "another-auth-secret-0123456789abcd";
    expect(verifySignedValue("session", "user-1", signature)).toBe(false);
  });
});
