// Veritabani guvenlik testleri (pgTAP).
//
//   pnpm db:test            -> test veritabanini sifirlar, migration'lari uygular ve db/tests/*.test.sql calistirir
//   pnpm db:test tenant     -> yalnizca adinda "tenant" gecen test dosyalarini calistirir
//
// Testler yalnizca TEST_DATABASE_MIGRATION_URL uzerinde calisir; gelistirme veritabanina dokunulmaz.
// Her test dosyasi kendi transaction'inda calisir ve sonunda geri alinir.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { applyMigrations } from "./migrate";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const testsDir = join(repoRoot, "db", "tests");

interface FileResult {
  file: string;
  planned: number | null;
  passed: number;
  failed: string[];
  error: string | null;
}

function psqlPath() {
  const binDir = process.env.PG_BIN_DIR;
  const executable = process.platform === "win32" ? "psql.exe" : "psql";
  return binDir ? join(binDir, executable) : executable;
}

async function prepareDatabase(connectionString: string) {
  await applyMigrations(connectionString, { reset: true, log: () => undefined });
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      create schema if not exists extensions;
      create extension if not exists pgtap with schema extensions;
      grant usage on schema extensions to anon, authenticated, service_role;
    `);
  } finally {
    await client.end();
  }
}

function runFile(connectionString: string, file: string): FileResult {
  const sql = readFileSync(join(testsDir, file), "utf8");
  const result = spawnSync(psqlPath(), [connectionString, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    env: { ...process.env, PGOPTIONS: "-c search_path=public,extensions -c client_min_messages=warning" },
    maxBuffer: 16 * 1024 * 1024
  });

  const lines = `${result.stdout ?? ""}`.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const plan = lines.map((line) => /^1\.\.(\d+)$/.exec(line)).find(Boolean);
  const passed = lines.filter((line) => /^ok \d+/.test(line)).length;
  const failed = lines.filter((line) => /^not ok \d+/.test(line));
  const error = result.status === 0 ? null : (result.stderr || "psql basarisiz oldu").trim();

  return { file, planned: plan ? Number(plan[1]) : null, passed, failed, error };
}

async function main() {
  const envPath = join(repoRoot, ".env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const connectionString = process.env.TEST_DATABASE_MIGRATION_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_MIGRATION_URL tanimli degil. Once `pnpm setup:local` calistirin.");

  const filter = process.argv[2];
  const files = readdirSync(testsDir)
    .filter((file) => file.endsWith(".test.sql") && (!filter || file.includes(filter)))
    .sort();

  console.log("Test veritabani hazirlaniyor (sifirlama + migration + pgTAP)...");
  await prepareDatabase(connectionString);

  let failures = 0;
  let total = 0;
  for (const file of files) {
    const result = runFile(connectionString, file);
    const planMismatch = result.planned !== null && result.planned !== result.passed + result.failed.length;
    const ok = !result.error && result.failed.length === 0 && !planMismatch && result.planned !== null;
    total += result.passed + result.failed.length;
    if (!ok) failures += 1;

    console.log(`${ok ? "GECTI " : "KALDI "} ${file}  (${result.passed}/${result.planned ?? "?"})`);
    for (const line of result.failed) console.log(`        ${line}`);
    if (planMismatch) console.log(`        plan ${result.planned}, calisan ${result.passed + result.failed.length}`);
    if (result.error) console.log(`        ${result.error.split("\n").slice(0, 6).join("\n        ")}`);
  }

  console.log(`\n${files.length} dosya, ${total} dogrulama, ${failures === 0 ? "hepsi gecti" : `${failures} dosya basarisiz`}.`);
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
