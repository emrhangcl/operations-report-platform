import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createKeyring, decryptBuffer, encryptBuffer, isEncrypted, storageAssociatedData } from "./encryption";

const key = () => randomBytes(32).toString("base64url");
const aad = storageAssociatedData("report-photos", "org/report/photo.jpg");
const plaintext = Buffer.from("rapor fotografi icerigi");

describe("storage encryption", () => {
  it("round-trips data and never stores the plaintext", () => {
    const keyring = createKeyring(key());
    const encrypted = encryptBuffer(plaintext, aad, keyring);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(encrypted.includes(plaintext)).toBe(false);
    expect(decryptBuffer(encrypted, aad, keyring)).toEqual({ plaintext, wasEncrypted: true });
  });

  it("uses a fresh IV for every write", () => {
    const keyring = createKeyring(key());
    expect(encryptBuffer(plaintext, aad, keyring).equals(encryptBuffer(plaintext, aad, keyring))).toBe(false);
  });

  it("detects tampering", () => {
    const keyring = createKeyring(key());
    const encrypted = encryptBuffer(plaintext, aad, keyring);
    encrypted[encrypted.length - 1]! ^= 0x01;
    expect(() => decryptBuffer(encrypted, aad, keyring)).toThrow(/dogrulanamadi/);
  });

  it("binds ciphertext to its storage path", () => {
    const keyring = createKeyring(key());
    const encrypted = encryptBuffer(plaintext, aad, keyring);
    const otherPath = storageAssociatedData("report-photos", "other-org/report/photo.jpg");
    expect(() => decryptBuffer(encrypted, otherPath, keyring)).toThrow(/dogrulanamadi/);
  });

  it("rejects data encrypted with an unknown key", () => {
    const encrypted = encryptBuffer(plaintext, aad, createKeyring(key()));
    expect(() => decryptBuffer(encrypted, aad, createKeyring(key()))).toThrow(/anahtar bulunamadi/);
  });

  it("keeps reading files written with a previous key after rotation", () => {
    const oldKey = key();
    const encrypted = encryptBuffer(plaintext, aad, createKeyring(oldKey));
    const rotated = createKeyring(key(), [oldKey]);
    expect(decryptBuffer(encrypted, aad, rotated).plaintext).toEqual(plaintext);
  });

  it("passes legacy unencrypted files through unchanged", () => {
    const legacy = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(decryptBuffer(legacy, aad, createKeyring(key()))).toEqual({ plaintext: legacy, wasEncrypted: false });
  });

  it("refuses keys that are not 32 bytes", () => {
    expect(() => createKeyring(randomBytes(16).toString("base64url"))).toThrow(/32 bayt/);
  });
});
