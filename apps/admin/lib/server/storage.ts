import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { getServerConfig } from "./config";
import { withDbContext, type DbClient, type DbContext } from "./db";
import { signValue, verifySignedValue } from "./auth/tokens";

// Dosya icerigi yerel diskte, metadata storage.objects tablosunda tutulur. Kullanici baglamindaki
// her islem once storage.objects uzerinde RLS'ten gecer; dosyaya ancak satir yetkisi varsa dokunulur.

export interface StorageError {
  message: string;
  statusCode: number;
}

export type StorageResult<T> = { data: T; error: null } | { data: null; error: StorageError };

const SIGNATURE_PURPOSE = "storage-object";
const segmentPattern = /^[A-Za-z0-9._-]{1,200}$/;
const bucketPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const MAX_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

class StorageFailure extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
  }
}

function failure<T>(error: unknown): StorageResult<T> {
  if (error instanceof StorageFailure) return { data: null, error: { message: error.message, statusCode: error.statusCode } };
  const code = (error as { code?: string }).code;
  if (code === "42501") return { data: null, error: { message: "Bu dosya islemi icin yetkiniz yok.", statusCode: 403 } };
  if (code === "23505") return { data: null, error: { message: "Dosya zaten mevcut.", statusCode: 409 } };
  if (code === "23514" || code?.startsWith("P0")) {
    return { data: null, error: { message: (error as Error).message, statusCode: 400 } };
  }
  console.error(JSON.stringify({ level: "error", event: "storage_failure", message: error instanceof Error ? error.message : String(error) }));
  return { data: null, error: { message: "Dosya islemi tamamlanamadi.", statusCode: 500 } };
}

export function validateObjectName(bucket: string, name: string) {
  if (!bucketPattern.test(bucket)) throw new StorageFailure("Gecersiz dosya alani.", 400);
  const segments = name.split("/");
  if (
    segments.length === 0 ||
    segments.length > 8 ||
    segments.some((segment) => !segmentPattern.test(segment) || segment === "." || segment === "..")
  ) {
    throw new StorageFailure("Gecersiz dosya yolu.", 400);
  }
  const root = resolve(getServerConfig().storageDir);
  const target = resolve(root, bucket, ...segments);
  if (!target.startsWith(root + sep)) throw new StorageFailure("Gecersiz dosya yolu.", 400);
  return target;
}

/** Bildirilen goruntu turunu dosyanin ilk baytlariyla dogrular. */
export function detectImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF" &&
    Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

async function readBucket(client: DbClient, bucket: string) {
  const result = await client.query<{ file_size_limit: number | null; allowed_mime_types: string[] | null }>(
    "select file_size_limit, allowed_mime_types from storage.buckets where id = $1",
    [bucket]
  );
  const row = result.rows[0];
  if (!row) throw new StorageFailure("Dosya alani bulunamadi.", 404);
  return row;
}

function signedPath(bucket: string, name: string, expiresInSeconds: number) {
  const seconds = Math.min(Math.max(Math.floor(expiresInSeconds), 1), MAX_SIGNED_URL_SECONDS);
  const exp = Math.floor(Date.now() / 1000) + seconds;
  const signature = signValue(SIGNATURE_PURPOSE, `${bucket}\n${name}\n${exp}`);
  const encodedName = name.split("/").map(encodeURIComponent).join("/");
  return `/api/storage/object/${bucket}/${encodedName}?exp=${exp}&sig=${signature}`;
}

export function verifySignedObject(bucket: string, name: string, exp: string | null, signature: string | null) {
  if (!exp || !signature || !/^\d{1,12}$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return verifySignedValue(SIGNATURE_PURPOSE, `${bucket}\n${name}\n${exp}`, signature);
}

export async function readObjectForSignedUrl(bucket: string, name: string) {
  const path = validateObjectName(bucket, name);
  const metadata = await withDbContext({ role: "service_role" }, async (client) => {
    const result = await client.query<{ metadata: { mimetype?: string } }>(
      "update storage.objects set last_accessed_at = now() where bucket_id = $1 and name = $2 returning metadata",
      [bucket, name]
    );
    return result.rows[0]?.metadata ?? null;
  });
  if (!metadata) return null;
  return { body: await readFile(path), contentType: metadata.mimetype ?? "application/octet-stream" };
}

export interface UploadOptions {
  contentType?: string;
  upsert?: boolean;
  cacheControl?: string;
}

export function createStorageApi(context: DbContext) {
  return {
    from(bucket: string) {
      return {
        async upload(name: string, body: Blob | ArrayBuffer | Uint8Array, options: UploadOptions = {}): Promise<StorageResult<{ path: string }>> {
          const pending: { tempPath: string | null } = { tempPath: null };
          try {
            const target = validateObjectName(bucket, name);
            const bytes = body instanceof Blob
              ? new Uint8Array(await body.arrayBuffer())
              : body instanceof Uint8Array ? body : new Uint8Array(body);
            const declaredType = options.contentType ?? (body instanceof Blob ? body.type : "") ?? "";

            await withDbContext(context, async (client) => {
              const bucketConfig = await readBucket(client, bucket);
              if (bucketConfig.file_size_limit && bytes.byteLength > bucketConfig.file_size_limit) {
                throw new StorageFailure("Dosya boyutu siniri asildi.", 413);
              }
              const detected = detectImageType(bytes);
              const contentType = detected ?? declaredType;
              if (bucketConfig.allowed_mime_types && !bucketConfig.allowed_mime_types.includes(contentType)) {
                throw new StorageFailure("Bu dosya turune izin verilmiyor.", 415);
              }
              if (declaredType.startsWith("image/") && detected !== declaredType && !(declaredType === "image/jpg" && detected === "image/jpeg")) {
                throw new StorageFailure("Dosya icerigi bildirilen turle uyusmuyor.", 415);
              }

              const metadata = {
                size: bytes.byteLength,
                mimetype: contentType,
                sha256: createHash("sha256").update(bytes).digest("hex"),
                ...(options.cacheControl ? { cacheControl: options.cacheControl } : {})
              };
              await client.query(
                `insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
                 values ($1, $2, $3::uuid, $3::text, $4::jsonb)
                 ${options.upsert ? "on conflict (bucket_id, name) do update set metadata = excluded.metadata, owner = excluded.owner, owner_id = excluded.owner_id" : ""}`,
                [bucket, name, context.userId ?? null, JSON.stringify(metadata)]
              );

              await mkdir(dirname(target), { recursive: true });
              pending.tempPath = `${target}.${randomBytes(6).toString("hex")}.tmp`;
              await writeFile(pending.tempPath, bytes, { mode: 0o600 });
            });

            // Dosya yalnizca metadata transaction'i basariyla commit edildikten sonra yerine tasinir.
            if (pending.tempPath) await rename(pending.tempPath, target);
            pending.tempPath = null;
            return { data: { path: name }, error: null };
          } catch (error) {
            return failure(error);
          } finally {
            if (pending.tempPath) await rm(pending.tempPath, { force: true }).catch(() => undefined);
          }
        },

        async download(name: string): Promise<StorageResult<Blob>> {
          try {
            const path = validateObjectName(bucket, name);
            const metadata = await withDbContext(context, async (client) => {
              const result = await client.query<{ metadata: { mimetype?: string } }>(
                "select metadata from storage.objects where bucket_id = $1 and name = $2",
                [bucket, name]
              );
              return result.rows[0]?.metadata ?? null;
            });
            if (!metadata) throw new StorageFailure("Dosya bulunamadi.", 404);
            const bytes = await readFile(path);
            return { data: new Blob([bytes], { type: metadata.mimetype ?? "application/octet-stream" }), error: null };
          } catch (error) {
            if ((error as { code?: string }).code === "ENOENT") return { data: null, error: { message: "Dosya bulunamadi.", statusCode: 404 } };
            return failure(error);
          }
        },

        async createSignedUrls(names: string[], expiresInSeconds: number): Promise<StorageResult<{ path: string; signedUrl: string | null; error: string | null }[]>> {
          try {
            for (const name of names) validateObjectName(bucket, name);
            const visible = await withDbContext(context, async (client) => {
              const result = await client.query<{ name: string }>(
                "select name from storage.objects where bucket_id = $1 and name = any($2::text[])",
                [bucket, names]
              );
              return new Set(result.rows.map((row) => row.name));
            });
            return {
              data: names.map((name) => visible.has(name)
                ? { path: name, signedUrl: signedPath(bucket, name, expiresInSeconds), error: null }
                : { path: name, signedUrl: null, error: "Dosya bulunamadi." }),
              error: null
            };
          } catch (error) {
            return failure(error);
          }
        },

        async createSignedUrl(name: string, expiresInSeconds: number): Promise<StorageResult<{ signedUrl: string }>> {
          const result = await this.createSignedUrls([name], expiresInSeconds);
          if (result.error) return result;
          const signedUrl = result.data[0]?.signedUrl;
          return signedUrl
            ? { data: { signedUrl }, error: null }
            : { data: null, error: { message: "Dosya bulunamadi.", statusCode: 404 } };
        },

        async remove(names: string[]): Promise<StorageResult<{ name: string }[]>> {
          try {
            const targets = new Map(names.map((name) => [name, validateObjectName(bucket, name)]));
            const removed = await withDbContext(context, async (client) => {
              const result = await client.query<{ name: string }>(
                "delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name",
                [bucket, names]
              );
              return result.rows.map((row) => row.name);
            });
            await Promise.all(removed.map((name) => rm(targets.get(name) as string, { force: true })));
            return { data: removed.map((name) => ({ name })), error: null };
          } catch (error) {
            return failure(error);
          }
        }
      };
    }
  };
}

export type StorageApi = ReturnType<typeof createStorageApi>;
