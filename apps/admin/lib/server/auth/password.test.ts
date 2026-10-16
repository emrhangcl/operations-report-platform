import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes with scrypt and a random salt", async () => {
    const first = await hashPassword("dogru-parola-123");
    const second = await hashPassword("dogru-parola-123");
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/);
    expect(first).not.toBe(second);
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("dogru-parola-123");
    await expect(verifyPassword("dogru-parola-123", stored)).resolves.toBe(true);
    await expect(verifyPassword("yanlis-parola-123", stored)).resolves.toBe(false);
  });

  it("treats NFKC-equivalent passwords as equal", async () => {
    const stored = await hashPassword("ﬁrma-parola");
    await expect(verifyPassword("firma-parola", stored)).resolves.toBe(true);
  });

  it("never accepts a missing or malformed hash", async () => {
    await expect(verifyPassword("herhangi", null)).resolves.toBe(false);
    await expect(verifyPassword("herhangi", "plain-text")).resolves.toBe(false);
    await expect(verifyPassword("x".repeat(300), await hashPassword("kisa-parola"))).resolves.toBe(false);
  });

  it("flags hashes created with weaker parameters for rehashing", async () => {
    expect(needsRehash(await hashPassword("parola-123456"))).toBe(false);
    expect(needsRehash("scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86))).toBe(true);
  });
});
