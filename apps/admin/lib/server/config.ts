import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createKeyring, type Keyring } from "./encryption";

// Next.js yalnizca apps/admin altindaki .env dosyalarini okur; yerel kurulum ise tek bir kok .env
// kullanir. Ortam degiskeni varsa her zaman o kazanir.
let projectEnvCache: Map<string, string> | null = null;

function loadProjectEnv() {
  if (projectEnvCache) return projectEnvCache;
  const values = new Map<string, string>();
  const candidates = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../..", ".env")];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const entry = line.startsWith("export ") ? line.slice(7).trimStart() : line;
      const separator = entry.indexOf("=");
      if (separator <= 0) continue;
      const key = entry.slice(0, separator).trim();
      let value = entry.slice(separator + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!values.has(key)) values.set(key, value);
    }
  }

  projectEnvCache = values;
  return values;
}

export function getEnv(name: string): string | undefined {
  const value = process.env[name] ?? loadProjectEnv().get(name);
  return value === "" ? undefined : value;
}

function getNumberEnv(name: string, fallback: number) {
  const raw = getEnv(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} pozitif bir sayi olmalidir.`);
  return value;
}

export class ConfigurationError extends Error {}

export interface ServerConfig {
  appEnv: string;
  appUrl: URL;
  isProduction: boolean;
  secureCookies: boolean;
  databaseUrl: string;
  authSecret: string;
  dataDir: string;
  storageDir: string;
  storageKeyring: Keyring;
  mailOutboxDir: string;
  requireEmailVerification: boolean;
  session: {
    adminTtlHours: number;
    adminIdleHours: number;
    personnelTtlHours: number;
    personnelIdleHours: number;
  };
  login: {
    maxFailedAttempts: number;
    lockMinutes: number;
    maxFailuresPerIp: number;
    ipBlockMinutes: number;
  };
  maxClientRows: number;
}

let configCache: ServerConfig | null = null;

function defaultDataDir() {
  return process.platform === "win32"
    ? join(homedir(), "OperationsPortal")
    : join(homedir(), ".local", "share", "operations-portal");
}

export function getServerConfig(): ServerConfig {
  if (configCache) return configCache;

  const appEnv = getEnv("APP_ENV") ?? (process.env.NODE_ENV === "production" ? "production" : "development");
  const isProduction = appEnv === "production";
  const databaseUrl = getEnv("DATABASE_URL");
  const authSecret = getEnv("AUTH_SECRET");
  const rawAppUrl = getEnv("APP_URL") ?? (isProduction ? undefined : "http://localhost:3000");

  if (!databaseUrl) throw new ConfigurationError("DATABASE_URL tanimli degil.");
  if (!authSecret || authSecret.length < 32) throw new ConfigurationError("AUTH_SECRET en az 32 karakter olmalidir.");
  if (!rawAppUrl) throw new ConfigurationError("APP_URL production ortaminda zorunludur.");
  const storageKey = getEnv("STORAGE_ENCRYPTION_KEY");
  if (!storageKey) {
    throw new ConfigurationError("STORAGE_ENCRYPTION_KEY tanimli degil. `pnpm setup:local` ile olusturun ve ayrica yedekleyin.");
  }

  const appUrl = new URL(rawAppUrl);
  const dataDir = getEnv("OPS_DATA_DIR") ?? defaultDataDir();

  configCache = {
    appEnv,
    appUrl,
    isProduction,
    secureCookies: appUrl.protocol === "https:",
    databaseUrl,
    authSecret,
    dataDir,
    storageDir: getEnv("STORAGE_DIR") ?? join(dataDir, "storage"),
    storageKeyring: createKeyring(
      storageKey,
      (getEnv("STORAGE_ENCRYPTION_PREVIOUS_KEYS") ?? "").split(",").map((value) => value.trim()).filter(Boolean)
    ),
    mailOutboxDir: getEnv("MAIL_OUTBOX_DIR") ?? join(dataDir, "mail-outbox"),
    requireEmailVerification: getEnv("AUTH_REQUIRE_EMAIL_VERIFICATION") === "true",
    session: {
      adminTtlHours: getNumberEnv("AUTH_ADMIN_SESSION_TTL_HOURS", 24 * 7),
      adminIdleHours: getNumberEnv("AUTH_ADMIN_SESSION_IDLE_HOURS", 24),
      personnelTtlHours: getNumberEnv("AUTH_PERSONNEL_SESSION_TTL_HOURS", 24 * 30),
      personnelIdleHours: getNumberEnv("AUTH_PERSONNEL_SESSION_IDLE_HOURS", 24 * 7)
    },
    login: {
      maxFailedAttempts: getNumberEnv("AUTH_MAX_FAILED_LOGINS", 8),
      lockMinutes: getNumberEnv("AUTH_LOCK_MINUTES", 15),
      maxFailuresPerIp: getNumberEnv("AUTH_IP_MAX_FAILURES", 20),
      ipBlockMinutes: getNumberEnv("AUTH_IP_BLOCK_MINUTES", 15)
    },
    maxClientRows: getNumberEnv("DATA_MAX_ROWS", 1000)
  };

  return configCache;
}

/** Testler ortam degiskenlerini degistirdiginde onbellegi temizler. */
export function resetServerConfigForTests() {
  configCache = null;
  projectEnvCache = null;
}
