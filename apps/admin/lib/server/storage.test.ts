import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const storageDir = resolve("/tmp/operations-storage-test");

vi.mock("./config", () => ({ getServerConfig: () => ({ storageDir, authSecret: "x".repeat(48) }) }));

import { detectImageType, validateObjectName, verifySignedObject } from "./storage";

describe("validateObjectName", () => {
  it("maps a valid object path inside the bucket directory", () => {
    expect(validateObjectName("report-photos", "org/report/photo.jpg")).toBe(resolve(storageDir, "report-photos", "org", "report", "photo.jpg"));
  });

  it.each([
    "../secrets.txt",
    "org/../../etc/passwd",
    "org//photo.jpg",
    "/absolute.jpg",
    "org/photo.jpg\u0000.png",
    "org\\photo.jpg",
    "org/./photo.jpg",
    "a/b/c/d/e/f/g/h/i.jpg"
  ])("rejects unsafe path %s", (name) => {
    expect(() => validateObjectName("report-photos", name)).toThrow();
  });

  it("rejects unsafe bucket names", () => {
    expect(() => validateObjectName("../report-photos", "org/photo.jpg")).toThrow();
    expect(() => validateObjectName("Report_Photos", "org/photo.jpg")).toThrow();
  });
});

describe("detectImageType", () => {
  it("recognises image signatures and nothing else", () => {
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("MZ\u0090\u0000"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("verifySignedObject", () => {
  it("rejects missing, expired or malformed signatures", () => {
    const future = String(Math.floor(Date.now() / 1000) + 60);
    expect(verifySignedObject("report-photos", "a/b.jpg", null, "sig")).toBe(false);
    expect(verifySignedObject("report-photos", "a/b.jpg", "1", "sig")).toBe(false);
    expect(verifySignedObject("report-photos", "a/b.jpg", "not-a-number", "sig")).toBe(false);
    expect(verifySignedObject("report-photos", "a/b.jpg", future, "forged")).toBe(false);
  });
});
