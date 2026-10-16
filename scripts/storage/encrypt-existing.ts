// Diskte sifrelenmemis duran dosyalari sifreler (ve --rotate ile eski anahtarla sifrelenmis
// dosyalari guncel anahtarla yeniden sifreler).
//
//   pnpm storage:encrypt            -> yalnizca sifrelenmemis dosyalar
//   pnpm storage:encrypt --rotate   -> eski anahtar kimligine sahip dosyalar da
//
// Tekrar calistirmak guvenlidir. Her dosya once gecici dosyaya yazilir, cozulerek dogrulanir,
// sonra yerine tasinir.

import { randomBytes } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { getServerConfig } from "../../apps/admin/lib/server/config";
import { closePool, withServiceContext } from "../../apps/admin/lib/server/db";
import { decryptBuffer, encryptBuffer, isEncrypted, storageAssociatedData } from "../../apps/admin/lib/server/encryption";
import { validateObjectName } from "../../apps/admin/lib/server/storage";

const KEY_ID_OFFSET = 8;

async function main() {
  const rotate = process.argv.includes("--rotate");
  const keyring = getServerConfig().storageKeyring;
  const primaryId = keyring.primary.id.toString("hex");

  const objects = await withServiceContext(async (client) =>
    (await client.query<{ bucket_id: string; name: string }>("select bucket_id, name from storage.objects order by bucket_id, name")).rows
  );

  const counts = { encrypted: 0, rotated: 0, unchanged: 0, missing: 0, failed: 0 };
  for (const object of objects) {
    const aad = storageAssociatedData(object.bucket_id, object.name);
    let path: string;
    try {
      path = validateObjectName(object.bucket_id, object.name);
    } catch {
      counts.failed += 1;
      console.error(`gecersiz yol atlandi: ${object.bucket_id}/${object.name}`);
      continue;
    }

    let data: Buffer;
    try {
      data = await readFile(path);
    } catch {
      counts.missing += 1;
      console.error(`dosya bulunamadi: ${object.bucket_id}/${object.name}`);
      continue;
    }

    const encrypted = isEncrypted(data);
    const keyId = encrypted ? data.subarray(KEY_ID_OFFSET, KEY_ID_OFFSET + 8).toString("hex") : null;
    if (encrypted && (!rotate || keyId === primaryId)) {
      counts.unchanged += 1;
      continue;
    }

    const tempPath = `${path}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      const { plaintext } = decryptBuffer(data, aad, keyring);
      const next = encryptBuffer(plaintext, aad, keyring);
      // Yazmadan once dogrula: yeni icerik ayni duz metne cozulmeli.
      if (!decryptBuffer(next, aad, keyring).plaintext.equals(plaintext)) throw new Error("dogrulama basarisiz");
      await writeFile(tempPath, next, { mode: 0o600 });
      await rename(tempPath, path);
      if (encrypted) counts.rotated += 1;
      else counts.encrypted += 1;
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => undefined);
      counts.failed += 1;
      console.error(`sifrelenemedi: ${object.bucket_id}/${object.name}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(
    `${objects.length} dosya: ${counts.encrypted} sifrelendi, ${counts.rotated} yeni anahtara tasindi, ` +
    `${counts.unchanged} zaten guncel, ${counts.missing} eksik, ${counts.failed} hata.`
  );
  if (counts.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePool());
