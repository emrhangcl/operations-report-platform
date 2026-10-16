import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Diskte duran dosyalar icin AES-256-GCM sifreleme.
//
// Bicim: MAGIC (8) | anahtar kimligi (8) | IV (12) | dogrulama etiketi (16) | sifreli icerik
// Anahtar kimligi, anahtarin SHA-256 ozetinin ilk 8 baytidir; boylece eski anahtarlarla yazilmis
// dosyalar anahtar degistirildikten sonra da okunabilir. AAD (ek dogrulanmis veri) dosyanin
// kova/yol bilgisidir: bir dosyanin sifreli icerigi baska bir dosyanin yerine konamaz.

const MAGIC = Buffer.from("OPSENC1\0", "ascii");
const KEY_ID_LENGTH = 8;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + KEY_ID_LENGTH + IV_LENGTH + TAG_LENGTH;

export interface EncryptionKey {
  id: Buffer;
  key: Buffer;
}

export interface Keyring {
  primary: EncryptionKey;
  byId: Map<string, EncryptionKey>;
}

export class EncryptionError extends Error {}

export function parseEncryptionKey(encoded: string): EncryptionKey {
  const key = Buffer.from(encoded.trim(), "base64url");
  if (key.length !== 32) throw new EncryptionError("Sifreleme anahtari 32 bayt (base64url) olmalidir.");
  return { id: createHash("sha256").update(key).digest().subarray(0, KEY_ID_LENGTH), key };
}

export function createKeyring(primary: string, previous: string[] = []): Keyring {
  const primaryKey = parseEncryptionKey(primary);
  const byId = new Map<string, EncryptionKey>([[primaryKey.id.toString("hex"), primaryKey]]);
  for (const encoded of previous) {
    const key = parseEncryptionKey(encoded);
    byId.set(key.id.toString("hex"), key);
  }
  return { primary: primaryKey, byId };
}

export function isEncrypted(data: Uint8Array) {
  return data.length >= HEADER_LENGTH && Buffer.from(data.subarray(0, MAGIC.length)).equals(MAGIC);
}

export function encryptBuffer(plaintext: Uint8Array, associatedData: string, keyring: Keyring) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", keyring.primary.key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, keyring.primary.id, iv, cipher.getAuthTag(), ciphertext]);
}

/** Sifreli veriyi cozer; sifrelenmemis (eski) veriyi oldugu gibi dondurur. */
export function decryptBuffer(data: Uint8Array, associatedData: string, keyring: Keyring) {
  if (!isEncrypted(data)) return { plaintext: Buffer.from(data), wasEncrypted: false };

  const buffer = Buffer.from(data);
  let offset = MAGIC.length;
  const keyId = buffer.subarray(offset, offset + KEY_ID_LENGTH);
  offset += KEY_ID_LENGTH;
  const iv = buffer.subarray(offset, offset + IV_LENGTH);
  offset += IV_LENGTH;
  const tag = buffer.subarray(offset, offset + TAG_LENGTH);
  offset += TAG_LENGTH;

  const entry = keyring.byId.get(keyId.toString("hex"));
  if (!entry) throw new EncryptionError("Dosyayi sifreleyen anahtar bulunamadi.");

  const decipher = createDecipheriv("aes-256-gcm", entry.key, iv);
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return { plaintext: Buffer.concat([decipher.update(buffer.subarray(offset)), decipher.final()]), wasEncrypted: true };
  } catch {
    throw new EncryptionError("Dosya dogrulanamadi: icerik degistirilmis veya yanlis yola tasinmis.");
  }
}

export function storageAssociatedData(bucket: string, name: string) {
  return `storage-object\n${bucket}\n${name}`;
}
