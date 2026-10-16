// Veritabani migration calistiricisi.
//
//   pnpm db:migrate                 -> DATABASE_MIGRATION_URL uzerinde bekleyen migration'lari uygular
//   pnpm db:migrate --test          -> TEST_DATABASE_MIGRATION_URL uzerinde calisir
//   pnpm db:reset --test            -> test veritabanini sifirlar ve tum migration'lari yeniden uygular
//   pnpm db:reset --yes             -> gelistirme veritabanini sifirlar (TUM VERI SILINIR)
//
// Uygulanmis bir migration dosyasi sonradan degistirilirse checksum uyusmazligi ile durur; gecmis
// migration'lar degistirilmez, her degisiklik yeni dosya olarak eklenir.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const migrationsDir = join(repoRoot, "db", "migrations");

const MIGRATION_LOCK_KEY = 482_190_331;
const MANAGED_SCHEMAS = ["public", "private", "auth", "storage", "migrations"];

interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export function loadMigrationFiles(directory = migrationsDir): MigrationFile[] {
  return readdirSync(directory)
    .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(directory, name), "utf8").replace(/\r\n/g, "\n");
      return {
        version: name.slice(0, 4),
        name,
        sql,
        checksum: createHash("sha256").update(sql).digest("hex")
      };
    });
}

export async function resetSchemas(client: pg.Client) {
  await client.query(`drop schema if exists ${MANAGED_SCHEMAS.join(", ")} cascade`);
  await client.query("create schema public");
  await client.query("revoke all on schema public from public");
}

export async function applyMigrations(connectionString: string, options: { reset?: boolean; log?: (line: string) => void } = {}) {
  const log = options.log ?? ((line: string) => console.log(line));
  const client = new pg.Client({ connectionString, application_name: "operations-migrate" });
  await client.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);

    if (options.reset) {
      log("Semalar sifirlaniyor...");
      await resetSchemas(client);
    }

    await client.query(`
      create schema if not exists migrations;
      revoke all on schema migrations from public;
      create table if not exists migrations.applied (
        version text primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now(),
        applied_by text not null default current_user,
        duration_ms integer not null
      );
    `);

    const applied = new Map(
      (await client.query<{ version: string; name: string; checksum: string }>(
        "select version, name, checksum from migrations.applied"
      )).rows.map((row) => [row.version, row])
    );

    const files = loadMigrationFiles();
    const versions = new Set<string>();
    for (const file of files) {
      if (versions.has(file.version)) throw new Error(`Ayni surum numarasi iki kez kullanilmis: ${file.version}`);
      versions.add(file.version);
    }

    let appliedCount = 0;
    for (const file of files) {
      const existing = applied.get(file.version);
      if (existing) {
        if (existing.checksum !== file.checksum) {
          throw new Error(
            `${file.name} uygulandiktan sonra degistirilmis (checksum uyusmazligi). ` +
            "Gecmis migration'lari degistirmeyin; yeni bir migration ekleyin."
          );
        }
        continue;
      }

      const startedAt = Date.now();
      await client.query("begin");
      try {
        await client.query(file.sql);
        await client.query(
          "insert into migrations.applied (version, name, checksum, duration_ms) values ($1, $2, $3, $4)",
          [file.version, file.name, file.checksum, Date.now() - startedAt]
        );
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${file.name} uygulanamadi: ${message}`);
      }
      appliedCount += 1;
      log(`uygulandi  ${file.name} (${Date.now() - startedAt} ms)`);
    }

    for (const version of applied.keys()) {
      if (!versions.has(version)) log(`uyari: veritabaninda olup dosyasi bulunmayan migration: ${version}`);
    }

    log(appliedCount === 0 ? "Veritabani guncel." : `${appliedCount} migration uygulandi.`);
    return appliedCount;
  } finally {
    await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
    await client.end();
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const envPath = join(repoRoot, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);

  const useTest = args.has("--test");
  const reset = args.has("--reset");
  const connectionString = useTest ? process.env.TEST_DATABASE_MIGRATION_URL : process.env.DATABASE_MIGRATION_URL;

  if (!connectionString) {
    throw new Error(`${useTest ? "TEST_DATABASE_MIGRATION_URL" : "DATABASE_MIGRATION_URL"} tanimli degil. Once \`pnpm db:init\` calistirin.`);
  }
  if (reset && !useTest && !args.has("--yes")) {
    throw new Error("Gelistirme veritabani sifirlanacak ve tum veri silinecek. Onaylamak icin --yes ekleyin.");
  }

  await applyMigrations(connectionString, { reset });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
