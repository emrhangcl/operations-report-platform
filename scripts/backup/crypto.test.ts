import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backupAssociatedData, createDecryptStream, createEncryptStream, parseBackupKey } from "./crypto";

let dir: string;
const key = parseBackupKey(randomBytes(32).toString("base64url"));
const aad = backupAssociatedData("2026-10-16T02-00-00Z", "database.dump.enc");
const payload = Buffer.concat([Buffer.from("PGDMP"), randomBytes(300_000)]);

async function encryptToFile(path: string, data: Buffer, associatedData = aad) {
  await pipeline(Readable.from([data.subarray(0, 1000), data.subarray(1000)]), createEncryptStream(key, associatedData), createWriteStream(path));
}

async function decryptFile(path: string, associatedData = aad) {
  const chunks: Buffer[] = [];
  for await (const chunk of await createDecryptStream(path, key, associatedData)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ops-backup-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("backup stream encryption", () => {
  it("round-trips streamed data and hides the plaintext", async () => {
    const path = join(dir, "roundtrip.enc");
    await encryptToFile(path, payload);
    const stored = await readFile(path);
    expect(stored.subarray(0, 8).toString("latin1")).toBe("OPSBAK1\0");
    expect(stored.includes(Buffer.from("PGDMP"))).toBe(false);
    expect((await decryptFile(path)).equals(payload)).toBe(true);
  });

  it("fails when a single byte is changed", async () => {
    const path = join(dir, "tampered.enc");
    await encryptToFile(path, payload);
    const stored = await readFile(path);
    stored[50_000]! ^= 0x01;
    await writeFile(path, stored);
    await expect(decryptFile(path)).rejects.toThrow();
  });

  it("fails when a file is moved into another backup set", async () => {
    const path = join(dir, "moved.enc");
    await encryptToFile(path, payload);
    await expect(decryptFile(path, backupAssociatedData("2026-10-17T02-00-00Z", "database.dump.enc"))).rejects.toThrow();
  });

  it("refuses a different key before reading any data", async () => {
    const path = join(dir, "other-key.enc");
    await encryptToFile(path, payload);
    const otherKey = parseBackupKey(randomBytes(32).toString("base64url"));
    await expect(createDecryptStream(path, otherKey, aad)).rejects.toThrow(/farkli bir anahtar/);
  });
});
