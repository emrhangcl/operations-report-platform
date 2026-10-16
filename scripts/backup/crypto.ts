// Yedek dosyalari icin akis tabanli AES-256-GCM sifreleme.
//
// Bicim: MAGIC (8) | anahtar kimligi (8) | IV (12) | sifreli icerik | dogrulama etiketi (16)
// Dogrulama etiketi dosyanin sonundadir; boylece buyuk veritabani dokumleri bellege alinmadan ve
// diske acik yazilmadan sifrelenir. AAD, yedek setinin zaman damgasini ve dosya adini icerir.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { Transform, type Readable } from "node:stream";

const MAGIC = Buffer.from("OPSBAK1\0", "ascii");
const KEY_ID_LENGTH = 8;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + KEY_ID_LENGTH + IV_LENGTH;

export interface BackupKey {
  id: Buffer;
  key: Buffer;
}

export function parseBackupKey(encoded: string | undefined): BackupKey {
  if (!encoded) throw new Error("BACKUP_ENCRYPTION_KEY tanimli degil. `pnpm setup:local` ile olusturun.");
  const key = Buffer.from(encoded.trim(), "base64url");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY 32 bayt (base64url) olmalidir.");
  return { id: createHash("sha256").update(key).digest().subarray(0, KEY_ID_LENGTH), key };
}

export function backupAssociatedData(setName: string, fileName: string) {
  return `backup\n${setName}\n${fileName}`;
}

/** Akisi sifreler: once baslik, sonra sifreli veri, en sonda dogrulama etiketi yazilir. */
export function createEncryptStream(backupKey: BackupKey, associatedData: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", backupKey.key, iv);
  cipher.setAAD(Buffer.from(associatedData, "utf8"));
  let headerWritten = false;

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      if (!headerWritten) {
        this.push(Buffer.concat([MAGIC, backupKey.id, iv]));
        headerWritten = true;
      }
      callback(null, cipher.update(chunk));
    },
    flush(callback) {
      if (!headerWritten) this.push(Buffer.concat([MAGIC, backupKey.id, iv]));
      this.push(cipher.final());
      this.push(cipher.getAuthTag());
      callback();
    }
  });
}

/**
 * Sifreli dosyayi cozulmus bir akis olarak dondurur. Dogrulama etiketi akisin sonunda kontrol
 * edilir; icerik degistirilmisse akis hata ile sonlanir.
 */
export async function createDecryptStream(path: string, backupKey: BackupKey, associatedData: string): Promise<Readable> {
  const handle = await open(path, "r");
  let header: Buffer;
  let tag: Buffer;
  let size: number;
  try {
    size = (await handle.stat()).size;
    if (size < HEADER_LENGTH + TAG_LENGTH) throw new Error(`${path}: yedek dosyasi cok kisa.`);
    header = Buffer.alloc(HEADER_LENGTH);
    await handle.read(header, 0, HEADER_LENGTH, 0);
    tag = Buffer.alloc(TAG_LENGTH);
    await handle.read(tag, 0, TAG_LENGTH, size - TAG_LENGTH);
  } finally {
    await handle.close();
  }

  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error(`${path}: yedek bicimi taninmadi.`);
  if (!header.subarray(MAGIC.length, MAGIC.length + KEY_ID_LENGTH).equals(backupKey.id)) {
    throw new Error(`${path}: yedek farkli bir anahtarla sifrelenmis.`);
  }

  const decipher = createDecipheriv("aes-256-gcm", backupKey.key, header.subarray(MAGIC.length + KEY_ID_LENGTH));
  decipher.setAAD(Buffer.from(associatedData, "utf8"));
  decipher.setAuthTag(tag);

  const source = createReadStream(path, { start: HEADER_LENGTH, end: size - TAG_LENGTH - 1 });
  source.on("error", (error) => decipher.destroy(error));
  return source.pipe(decipher);
}
