#!/usr/bin/env node
// Tek komutla yerel kurulum: uygulama ayarlari (.env) -> PostgreSQL kumesi -> migration'lar.
// Tekrar calistirmak guvenlidir; var olan .env degerleri ve veritabani verisi korunur.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(repoRoot, ".env");

function readEnvKeys() {
  if (!existsSync(envPath)) return new Set();
  return new Set(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1])
      .filter(Boolean)
  );
}

function ensureAppEnv() {
  const existing = readEnvKeys();
  const defaults = {
    APP_ENV: "development",
    APP_URL: "http://localhost:3000",
    AUTH_SECRET: randomBytes(48).toString("base64url"),
    AUTH_REQUIRE_EMAIL_VERIFICATION: "false",
    // Diskteki dosyalari sifreler. Kaybolursa sifreli dosyalar acilamaz; ayrica guvenli yerde saklayin.
    STORAGE_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
    // Yedek dosyalarini sifreler. Veri klasorunden ayri tutulmalidir.
    BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("base64url")
  };
  const missing = Object.entries(defaults).filter(([key]) => !existing.has(key));
  if (missing.length === 0) {
    console.log("Uygulama ayarlari zaten mevcut (.env).");
    return;
  }
  const current = existsSync(envPath) ? readFileSync(envPath, "utf8").replace(/\s*$/, "\n") : "";
  const block = missing.map(([key, value]) => `${key}=${value}`).join("\n");
  writeFileSync(envPath, `${current}${current ? "\n" : ""}${block}\n`, { mode: 0o600 });
  console.log(`.env dosyasina eklendi: ${missing.map(([key]) => key).join(", ")}`);
}

function step(title, command, args) {
  console.log(`\n== ${title}`);
  // Windows'ta pnpm bir .cmd dosyasidir ve kabuk gerektirir; node ise dogrudan calistirilir.
  const useShell = process.platform === "win32" && command === "pnpm";
  const result = useShell
    ? spawnSync([command, ...args].join(" "), { cwd: repoRoot, stdio: "inherit", shell: true })
    : spawnSync(command, args, { cwd: repoRoot, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`${title} basarisiz oldu.`);
    process.exit(result.status ?? 1);
  }
}

ensureAppEnv();
step("PostgreSQL kurulumu", process.execPath, [join("scripts", "local", "postgres.mjs"), "init"]);
step("Gelistirme veritabani migration", "pnpm", ["exec", "tsx", join("scripts", "db", "migrate.ts")]);
step("Test veritabani migration", "pnpm", ["exec", "tsx", join("scripts", "db", "migrate.ts"), "--test"]);

console.log(`
Kurulum tamamlandi.
  Ilk platform sahibi hesabi : pnpm create-admin --platform
  Uygulamayi baslat          : pnpm dev:admin   (http://localhost:3000)
  Veritabani durumu          : pnpm db:status
`);
