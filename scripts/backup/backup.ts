// Sifreli yedekleme ve geri yukleme tatbikati.
//
//   pnpm backup            -> veritabani + dosyalar, sifreli yedek seti olusturur
//   pnpm backup:list       -> mevcut yedek setlerini listeler
//   pnpm backup:verify     -> en son seti test veritabanina geri yukleyip dogrular
//
// Veritabani dokumu ve dosya arsivi diske hic acik yazilmaz; pg_dump / tar ciktisi dogrudan
// sifreleme akisina baglanir. Sifreleme anahtari (BACKUP_ENCRYPTION_KEY) yedekle birlikte
// saklanmaz. Ayarlar: BACKUP_DIR (varsayilan OPS_DATA_DIR/backups), BACKUP_RETENTION (14),
// BACKUP_COPY_DIR (istege bagli ikinci konum, or. harici disk).

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { resetSchemas } from "../db/migrate";
import { backupAssociatedData, createDecryptStream, createEncryptStream, parseBackupKey } from "./crypto";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const isWindows = process.platform === "win32";
const dataDir = process.env.OPS_DATA_DIR || (isWindows ? join(homedir(), "OperationsPortal") : join(homedir(), ".local", "share", "operations-portal"));
const backupDir = process.env.BACKUP_DIR || join(dataDir, "backups");
const retention = Math.max(1, Number(process.env.BACKUP_RETENTION || 14));
const setPattern = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;
const DATABASE_FILE = "database.dump.enc";
const STORAGE_FILE = "storage.tar.enc";
const COUNTED_TABLES = [
  "auth.users",
  "public.organizations",
  "public.profiles",
  "public.companies",
  "public.reports",
  "public.report_photos",
  "public.installation_assignments",
  "public.audit_logs",
  "storage.objects"
];

interface Manifest {
  format: 1;
  created_at: string;
  database: string;
  server_version: string;
  migrations: string[];
  row_counts: Record<string, number>;
  storage_files: number;
  files: { name: string; bytes: number; sha256: string }[];
}

function pgBin(name: string) {
  const executable = isWindows ? `${name}.exe` : name;
  return process.env.PG_BIN_DIR ? join(process.env.PG_BIN_DIR, executable) : executable;
}

function tarBin() {
  // Windows'ta Git Bash'in GNU tar'i yerine sistemle gelen bsdtar kullanilir.
  return isWindows ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} tanimli degil. Once \`pnpm setup:local\` calistirin.`);
  return value;
}

async function sha256File(path: string) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

/** Bir surecin stdout'unu sifreleyerek dosyaya yazar; surec hata ile biterse reddeder. */
async function encryptProcessOutput(command: string, args: string[], target: string, associatedData: string) {
  const backupKey = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const exited = new Promise<void>((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", (code) => (code === 0 ? resolveExit() : rejectExit(new Error(`${command} ${code} koduyla bitti: ${stderr.trim()}`))));
  });
  await Promise.all([pipeline(child.stdout, createEncryptStream(backupKey, associatedData), createWriteStream(target, { mode: 0o600 })), exited]);
}

async function collectDatabaseFacts(connectionString: string) {
  const client = new pg.Client({ connectionString, application_name: "operations-backup" });
  await client.connect();
  try {
    const version = (await client.query<{ server_version: string }>("show server_version")).rows[0]!.server_version;
    const migrations = (await client.query<{ version: string }>("select version from migrations.applied order by version")).rows.map((row) => row.version);
    const rowCounts: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      rowCounts[table] = Number((await client.query<{ count: string }>(`select count(*) as count from ${table}`)).rows[0]!.count);
    }
    return { version, migrations, rowCounts, database: client.database ?? "" };
  } finally {
    await client.end();
  }
}

async function listSets() {
  if (!existsSync(backupDir)) return [];
  return (await readdir(backupDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && setPattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function createBackup() {
  const connectionString = requiredEnv("DATABASE_MIGRATION_URL");
  parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);

  const setName = new Date().toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-");
  const finalDir = join(backupDir, setName);
  const workDir = `${finalDir}.partial`;
  await mkdir(workDir, { recursive: true });

  try {
    const facts = await collectDatabaseFacts(connectionString);

    console.log("Veritabani dokumu sifreleniyor...");
    await encryptProcessOutput(
      pgBin("pg_dump"),
      ["--format=custom", "--compress=6", connectionString],
      join(workDir, DATABASE_FILE),
      backupAssociatedData(setName, DATABASE_FILE)
    );

    const storageDir = join(dataDir, "storage");
    let storageFiles = 0;
    if (existsSync(storageDir)) {
      const countFiles = async (dir: string): Promise<number> =>
        (await Promise.all((await readdir(dir, { withFileTypes: true })).map((entry) =>
          entry.isDirectory() ? countFiles(join(dir, entry.name)) : Promise.resolve(entry.name.endsWith(".tmp") ? 0 : 1)))).reduce((sum, value) => sum + value, 0);
      storageFiles = await countFiles(storageDir);
      console.log(`Dosya arsivi sifreleniyor (${storageFiles} dosya)...`);
      await encryptProcessOutput(
        tarBin(),
        ["-cf", "-", "--exclude", "*.tmp", "-C", dataDir, "storage"],
        join(workDir, STORAGE_FILE),
        backupAssociatedData(setName, STORAGE_FILE)
      );
    }

    const files = [];
    for (const name of [DATABASE_FILE, STORAGE_FILE]) {
      const path = join(workDir, name);
      if (!existsSync(path)) continue;
      files.push({ name, bytes: (await stat(path)).size, sha256: await sha256File(path) });
    }

    const manifest: Manifest = {
      format: 1,
      created_at: new Date().toISOString(),
      database: facts.database,
      server_version: facts.version,
      migrations: facts.migrations,
      row_counts: facts.rowCounts,
      storage_files: storageFiles,
      files
    };
    await writeFile(join(workDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await rename(workDir, finalDir);
    console.log(`Yedek olusturuldu: ${finalDir}`);

    if (process.env.BACKUP_COPY_DIR) {
      const copyTarget = join(process.env.BACKUP_COPY_DIR, setName);
      await cp(finalDir, copyTarget, { recursive: true });
      console.log(`Ikinci konuma kopyalandi: ${copyTarget}`);
    }

    const sets = await listSets();
    for (const old of sets.slice(0, Math.max(0, sets.length - retention))) {
      await rm(join(backupDir, old), { recursive: true, force: true });
      console.log(`Saklama suresi dolan yedek silindi: ${old}`);
    }
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }
}

async function runRestore(setDir: string, setName: string, connectionString: string) {
  const backupKey = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const decrypted = await createDecryptStream(join(setDir, DATABASE_FILE), backupKey, backupAssociatedData(setName, DATABASE_FILE));
  const child = spawn(pgBin("pg_restore"), ["--exit-on-error", "--no-owner", `--dbname=${connectionString}`], {
    stdio: ["pipe", "ignore", "pipe"]
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  const exited = new Promise<void>((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", (code) => (code === 0 ? resolveExit() : rejectExit(new Error(`pg_restore ${code} koduyla bitti: ${stderr.trim()}`))));
  });
  await Promise.all([pipeline(decrypted, child.stdin), exited]);
}

async function countArchiveEntries(setDir: string, setName: string) {
  const backupKey = parseBackupKey(process.env.BACKUP_ENCRYPTION_KEY);
  const decrypted = await createDecryptStream(join(setDir, STORAGE_FILE), backupKey, backupAssociatedData(setName, STORAGE_FILE));
  const child = spawn(tarBin(), ["-tf", "-"], { stdio: ["pipe", "pipe", "pipe"] });
  let listing = "";
  child.stdout.on("data", (chunk) => { listing += String(chunk); });
  const exited = new Promise<void>((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", (code) => (code === 0 ? resolveExit() : rejectExit(new Error(`tar ${code} koduyla bitti`))));
  });
  await Promise.all([pipeline(decrypted, child.stdin), exited]);
  return listing.split(/\r?\n/).filter((line) => line && !line.endsWith("/")).length;
}

async function verifyBackup() {
  const testUrl = requiredEnv("TEST_DATABASE_MIGRATION_URL");
  const requested = process.argv.find((arg) => setPattern.test(arg));
  const sets = await listSets();
  const setName = requested ?? sets.at(-1);
  if (!setName) throw new Error(`Dogrulanacak yedek bulunamadi (${backupDir}).`);
  const setDir = join(backupDir, setName);
  const manifest = JSON.parse(await readFile(join(setDir, "manifest.json"), "utf8")) as Manifest;
  const problems: string[] = [];

  console.log(`Yedek dogrulaniyor: ${setName}`);
  for (const file of manifest.files) {
    const actual = await sha256File(join(setDir, file.name));
    if (actual !== file.sha256) problems.push(`${file.name}: ozet uyusmuyor (dosya bozulmus veya degistirilmis).`);
  }
  if (problems.length > 0) {
    console.error(`DOGRULAMA BASARISIZ, geri yukleme denenmedi:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }

  // Geri yukleme tatbikati yalnizca test veritabaninda yapilir; gelistirme verisine dokunulmaz.
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  try {
    await resetSchemas(client);
  } finally {
    await client.end();
  }
  await runRestore(setDir, setName, testUrl);

  const restored = await collectDatabaseFacts(testUrl);
  for (const [table, expected] of Object.entries(manifest.row_counts)) {
    if (restored.rowCounts[table] !== expected) {
      problems.push(`${table}: beklenen ${expected} satir, geri yuklenen ${restored.rowCounts[table]}.`);
    }
  }
  if (restored.migrations.join(",") !== manifest.migrations.join(",")) problems.push("Migration listesi uyusmuyor.");

  if (manifest.files.some((file) => file.name === STORAGE_FILE)) {
    const entries = await countArchiveEntries(setDir, setName);
    if (entries !== manifest.storage_files) problems.push(`Dosya arsivi: beklenen ${manifest.storage_files}, bulunan ${entries}.`);
  }

  if (problems.length > 0) {
    console.error(`DOGRULAMA BASARISIZ:\n  ${problems.join("\n  ")}`);
    process.exitCode = 1;
    return;
  }
  const totalRows = Object.values(restored.rowCounts).reduce((sum, value) => sum + value, 0);
  console.log(`Dogrulama basarili: ${manifest.files.length} dosya ozeti, ${totalRows} satir (${COUNTED_TABLES.length} tablo), ${manifest.storage_files} dosya geri yuklendi.`);
  console.log("Not: test veritabani geri yuklenen yedekle degisti; testlerden once `pnpm db:test` onu yeniden kurar.");
}

async function printSets() {
  const sets = await listSets();
  if (sets.length === 0) {
    console.log(`Yedek yok (${backupDir}).`);
    return;
  }
  for (const name of sets) {
    const manifest = JSON.parse(await readFile(join(backupDir, name, "manifest.json"), "utf8")) as Manifest;
    const bytes = manifest.files.reduce((sum, file) => sum + file.bytes, 0);
    console.log(`${name}  ${(bytes / 1024 / 1024).toFixed(2)} MB  rapor=${manifest.row_counts["public.reports"] ?? 0}  dosya=${manifest.storage_files}`);
  }
}

const commands: Record<string, () => Promise<void>> = { create: createBackup, verify: verifyBackup, list: printSets };
const command = process.argv[2] ?? "create";

if (!commands[command]) {
  console.error(`Kullanim: tsx scripts/backup/backup.ts <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}

commands[command]!().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  // AES-GCM dogrulama hatasi: icerik degistirilmis, yanlis anahtar veya baska bir yedek setine ait.
  console.error(/unable to authenticate data/i.test(message)
    ? "Yedek dogrulanamadi: sifreli icerik degistirilmis, bozulmus ya da farkli bir anahtar/yedek setine ait."
    : message);
  process.exit(1);
});
