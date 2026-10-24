// Tek komutlu on dagitim kontrolu.
//
//   pnpm run preflight     -> typecheck, lint, test, design:check, build ve (baglanti varsa) db:test
//
// Bir adim kalsa bile sonraki adimlar calisir; sonda ozet tablo basilir.
// Herhangi bir adim kaldiysa cikis kodu 1 olur. Atlanan adim cikis kodunu bozmaz ama tabloda
// "ATLANDI (neden)" olarak gorunur. Baglanti dizeleri ve .env icerigi hicbir zaman yazdirilmaz.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PASSED = "GEÇTİ";
export const FAILED = "KALDI";
export const SKIPPED = "ATLANDI";

export const defaultSteps = [
  { name: "typecheck", script: "typecheck" },
  { name: "lint", script: "lint" },
  { name: "test", script: "test" },
  { name: "design:check", script: "design:check" },
  { name: "build", script: "build" },
  { name: "db:test", script: "db:test", precondition: () => checkTestDatabase(databaseEnv()) }
];

// db:test kendi .env dosyasini yukler; burada yalnizca on kontrol icin okunur ve diger adimlarin
// ortamina eklenmez (build/test davranisi dogrudan calistirmayla ayni kalir).
function databaseEnv() {
  const envPath = path.join(repositoryRoot, ".env");
  return existsSync(envPath) ? { ...parseEnv(readFileSync(envPath, "utf8")), ...process.env } : process.env;
}

// Test veritabanina ulasilabiliyor mu? Donus: null (calistir) ya da atlama nedeni.
// Hata mesaji baglanti bilgisi icerebilecegi icin yalnizca hata kodu raporlanir.
export async function checkTestDatabase(env = process.env) {
  const connectionString = env.TEST_DATABASE_MIGRATION_URL;
  if (!connectionString) return "TEST_DATABASE_MIGRATION_URL tanımlı değil";

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    await client.query("select 1");
    return null;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "bilinmiyor";
    return `test veritabanına bağlanılamadı (kod: ${code})`;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function runPnpmScript(script) {
  const result = spawnSync("pnpm", ["run", script], {
    cwd: repositoryRoot,
    shell: process.platform === "win32",
    stdio: "inherit"
  });
  if (result.error) {
    console.error(`[preflight] ${script} başlatılamadı: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

export function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)} sn`;
}

export async function runPreflight({ steps = defaultSteps, run = runPnpmScript, log = console.log, now = Date.now } = {}) {
  const results = [];

  for (const step of steps) {
    const skipReason = step.precondition ? await step.precondition() : null;
    if (skipReason) {
      const result = { name: step.name, status: SKIPPED, reason: skipReason, durationMs: 0 };
      results.push(result);
      log(`[preflight] ${step.name}: ${SKIPPED} (${skipReason})`);
      continue;
    }

    log(`\n[preflight] ${step.name} başlıyor…`);
    const startedAt = now();
    const exitCode = await run(step.script);
    const durationMs = now() - startedAt;
    const status = exitCode === 0 ? PASSED : FAILED;
    results.push({ name: step.name, status, reason: exitCode === 0 ? null : `çıkış kodu ${exitCode}`, durationMs });
    log(`[preflight] ${step.name}: ${status} (${formatDuration(durationMs)})`);
  }

  log(`\n${formatSummary(results)}`);
  const exitCode = results.some((result) => result.status === FAILED) ? 1 : 0;
  log(exitCode === 0 ? "\nÖn dağıtım kontrolü geçti." : "\nÖn dağıtım kontrolü KALDI: release yapılmaz.");
  return { results, exitCode };
}

export function formatSummary(results) {
  const rows = results.map((result) => [
    result.name,
    result.reason ? `${result.status} (${result.reason})` : result.status,
    result.status === SKIPPED ? "-" : formatDuration(result.durationMs)
  ]);
  const header = ["Adım", "Sonuç", "Süre"];
  const widths = header.map((title, index) => Math.max(title.length, ...rows.map((row) => row[index].length)));
  const line = (cells) => `| ${cells.map((cell, index) => cell.padEnd(widths[index])).join(" | ")} |`;
  return [line(header), `|${widths.map((width) => "-".repeat(width + 2)).join("|")}|`, ...rows.map(line)].join("\n");
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  const { exitCode } = await runPreflight();
  process.exit(exitCode);
}
