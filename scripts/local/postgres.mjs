#!/usr/bin/env node
// Yerel PostgreSQL yasam dongusu: init | start | stop | restart | status | psql
//
// Veri dizini repo disinda tutulur (varsayilan: %USERPROFILE%\OperationsPortal veya
// ~/.local/share/operations-portal). Sunucu yalnizca loopback adresini dinler ve tum
// baglantilar scram-sha-256 parola dogrulamasi ister.

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(repoRoot, ".env");
const isWindows = process.platform === "win32";

if (existsSync(envPath)) process.loadEnvFile(envPath);

// Windows'ta AppData altina yazilan yeni klasorler, paketlenmis (MSIX) uygulamalardan calisan
// sureclerde paket ozel alanina sanallastirilabilir. Veri dizini bu nedenle kullanici profilinin
// kokunde tutulur; boylece her surec ve PostgreSQL servisi ayni fiziksel klasoru gorur.
const dataRoot = process.env.OPS_DATA_DIR || (isWindows
  ? join(homedir(), "OperationsPortal")
  : join(homedir(), ".local", "share", "operations-portal"));
const pgBinDir = process.env.PG_BIN_DIR || (isWindows
  ? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Programs", "PostgreSQL", "18", "bin")
  : "");
const pgData = join(dataRoot, "postgres", "data");
const pgLogDir = join(dataRoot, "postgres", "log");
const secretsDir = join(dataRoot, "secrets");
const superuserPasswordFile = join(secretsDir, "postgres-superuser.txt");
const port = Number(process.env.OPS_PG_PORT || 5432);
const host = "127.0.0.1";
const databases = ["operations_portal", "operations_portal_test"];

function bin(name) {
  const executable = isWindows ? `${name}.exe` : name;
  return pgBinDir ? join(pgBinDir, executable) : executable;
}

function run(name, args, options = {}) {
  const result = spawnSync(bin(name), args, {
    stdio: options.capture ? "pipe" : "inherit",
    encoding: "utf8",
    env: { ...process.env, ...options.env },
    input: options.input
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture ? `\n${result.stdout ?? ""}${result.stderr ?? ""}` : "";
    throw new Error(`${name} ${args.join(" ")} basarisiz oldu (kod ${result.status}).${detail}`);
  }
  return result;
}

function secret(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

function isInitialized() {
  return existsSync(join(pgData, "PG_VERSION"));
}

function isRunning() {
  if (!isInitialized()) return false;
  return run("pg_ctl", ["-D", pgData, "status"], { capture: true, allowFailure: true }).status === 0;
}

function superuserEnv() {
  if (!existsSync(superuserPasswordFile)) {
    throw new Error(`Superuser parola dosyasi bulunamadi: ${superuserPasswordFile}`);
  }
  return { PGPASSWORD: readFileSync(superuserPasswordFile, "utf8").trim() };
}

function psqlAsSuperuser(database, sql, options = {}) {
  return run("psql", [
    "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    "-h", host, "-p", String(port), "-U", "postgres", "-d", database
  ], { input: sql, env: superuserEnv(), capture: true, ...options });
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function upsertEnv(values) {
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));
  const next = lines.map((line) => {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match || !pending.has(match[1])) return line;
    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  if (pending.size > 0) {
    if (next.length > 0 && next.at(-1) !== "") next.push("");
    for (const [key, value] of pending) next.push(`${key}=${value}`);
  }
  writeFileSync(envPath, `${next.join("\n").replace(/\n+$/, "")}\n`, { mode: 0o600 });
}

const hbaConf = `# Operasyon Portali - yalnizca loopback, yalnizca scram-sha-256.
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
`;

const operationsConf = `# Operasyon Portali yerel sunucu ayarlari (scripts/local/postgres.mjs tarafindan yazilir)
listen_addresses = '${host}'
port = ${port}
password_encryption = 'scram-sha-256'
max_connections = 50
logging_collector = on
log_directory = '${pgLogDir.replaceAll("\\", "/")}'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d
log_line_prefix = '%m [%p] %q%u@%d app=%a '
log_connections = 'authentication'
log_min_duration_statement = 1000
log_lock_waits = on
log_statement = 'ddl'
timezone = 'UTC'
`;

function init() {
  mkdirSync(pgLogDir, { recursive: true });
  mkdirSync(secretsDir, { recursive: true });

  if (!isInitialized()) {
    if (!existsSync(superuserPasswordFile)) {
      writeFileSync(superuserPasswordFile, `${secret(32)}\n`, { mode: 0o600 });
    }
    console.log(`PostgreSQL kumesi olusturuluyor: ${pgData}`);
    run("initdb", [
      "-D", pgData,
      "-U", "postgres",
      `--pwfile=${superuserPasswordFile}`,
      "-E", "UTF8",
      "--locale-provider=icu",
      "--icu-locale=und",
      "--locale=C",
      "--auth-host=scram-sha-256",
      "--auth-local=scram-sha-256",
      "--data-checksums"
    ]);
    writeFileSync(join(pgData, "pg_hba.conf"), hbaConf);
    writeFileSync(join(pgData, "operations.conf"), operationsConf);
    const mainConf = join(pgData, "postgresql.conf");
    const current = readFileSync(mainConf, "utf8");
    if (!current.includes("include_if_exists = 'operations.conf'")) {
      writeFileSync(mainConf, `${current}\ninclude_if_exists = 'operations.conf'\n`);
    }
  } else {
    console.log("PostgreSQL kumesi zaten mevcut, initdb atlandi.");
  }

  start();
  bootstrapRoles();
}

function bootstrapRoles() {
  const ownerPassword = process.env.DATABASE_MIGRATION_URL
    ? decodeURIComponent(new URL(process.env.DATABASE_MIGRATION_URL).password)
    : secret();
  const appPassword = process.env.DATABASE_URL
    ? decodeURIComponent(new URL(process.env.DATABASE_URL).password)
    : secret();

  // Rol modeli:
  //   ops_owner     -> sema sahibi; yalnizca migration calistirir.
  //   ops_app       -> uygulama baglantisi; NOINHERIT oldugu icin kendi basina tablo yetkisi yoktur,
  //                    her transaction icinde SET LOCAL ROLE ile asagidaki rollerden birine gecer.
  //   anon / authenticated -> RLS'e tabi istek rolleri.
  //   service_role  -> yalnizca dogrulanmis server islemleri icin, RLS'i atlar.
  psqlAsSuperuser("postgres", `
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'ops_owner') then
        create role ops_owner login;
      end if;
      if not exists (select from pg_roles where rolname = 'ops_app') then
        create role ops_app login noinherit;
      end if;
      if not exists (select from pg_roles where rolname = 'anon') then
        create role anon nologin;
      end if;
      if not exists (select from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin;
      end if;
      if not exists (select from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
    end
    $$;
    alter role ops_owner with login nosuperuser nocreatedb nocreaterole password ${quoteLiteral(ownerPassword)};
    alter role ops_app with login noinherit nosuperuser nocreatedb nocreaterole connection limit 40 password ${quoteLiteral(appPassword)};
    alter role service_role with nologin bypassrls;
    grant anon, authenticated, service_role to ops_app;
    -- Migration/test rolu istek rollerine yalnizca SET ROLE ile gecebilir; yetkilerini miras almaz.
    grant anon, authenticated, service_role to ops_owner with inherit false, set true;
    alter role ops_app set statement_timeout = '30s';
    alter role ops_app set idle_in_transaction_session_timeout = '60s';
    alter role ops_app set lock_timeout = '10s';
  `);

  for (const database of databases) {
    const check = psqlAsSuperuser("postgres", `select 1 from pg_database where datname = ${quoteLiteral(database)};`);
    if (check.stdout.trim() !== "1") {
      console.log(`Veritabani olusturuluyor: ${database}`);
      psqlAsSuperuser("postgres", `create database ${database} owner ops_owner template template0 encoding 'UTF8' locale_provider 'icu' icu_locale 'und' locale 'C';`);
    }
    psqlAsSuperuser(database, `
      revoke all on database ${database} from public;
      grant connect, temporary on database ${database} to ops_app;
      grant all on database ${database} to ops_owner;
      alter schema public owner to ops_owner;
      revoke all on schema public from public;
    `);
  }

  const encode = encodeURIComponent;
  const updates = {
    DATABASE_URL: `postgres://ops_app:${encode(appPassword)}@${host}:${port}/operations_portal`,
    DATABASE_MIGRATION_URL: `postgres://ops_owner:${encode(ownerPassword)}@${host}:${port}/operations_portal`,
    TEST_DATABASE_URL: `postgres://ops_app:${encode(appPassword)}@${host}:${port}/operations_portal_test`,
    TEST_DATABASE_MIGRATION_URL: `postgres://ops_owner:${encode(ownerPassword)}@${host}:${port}/operations_portal_test`
  };
  if (!process.env.OPS_DATA_DIR) updates.OPS_DATA_DIR = dataRoot;
  if (!process.env.PG_BIN_DIR && pgBinDir) updates.PG_BIN_DIR = pgBinDir;
  upsertEnv(updates);
  console.log("Roller ve veritabanlari hazir. Baglanti bilgileri .env dosyasina yazildi.");
}

// Windows'ta postmaster her baglanti icin yeni surec acar ve bagli oldugu konsolu paylasir. Cagiran
// terminal kapandiginda konsol da kapanirsa sunucu 0xC000013A / 0xC0000142 ile duser. Bu nedenle
// sunucu WMI uzerinden, cagiran surec agacinin tamamen disinda ve gizli pencereyle baslatilir.
function startDetachedOnWindows(startupLog) {
  const commandLine = `"${bin("pg_ctl")}" -D "${pgData}" -l "${startupLog}" start`;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }",
    `$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${quotePowerShell(commandLine)}; CurrentDirectory = ${quotePowerShell(dataRoot)}; ProcessStartupInformation = $startup }`,
    "if ($result.ReturnValue -ne 0) { throw \"Win32_Process.Create basarisiz: $($result.ReturnValue)\" }"
  ].join("; ");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) {
    throw new Error(`PostgreSQL baslatma komutu calistirilamadi.\n${result.stdout}${result.stderr}`);
  }
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function start() {
  if (!isInitialized()) throw new Error("PostgreSQL kumesi yok. Once `pnpm db:init` calistirin.");
  if (isRunning()) {
    console.log(`PostgreSQL zaten calisiyor (${host}:${port}).`);
    return;
  }
  mkdirSync(pgLogDir, { recursive: true });
  const startupLog = join(pgLogDir, "startup.log");
  if (isWindows) {
    startDetachedOnWindows(startupLog);
  } else {
    const child = spawn(bin("pg_ctl"), ["-D", pgData, "-l", startupLog, "start"], {
      detached: true,
      stdio: "ignore",
      env: process.env
    });
    child.unref();
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const ready = spawnSync(bin("pg_isready"), ["-h", host, "-p", String(port), "-q"], { stdio: "ignore" });
    if (ready.status === 0) {
      console.log(`PostgreSQL basladi (${host}:${port}).`);
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  const tail = existsSync(startupLog) ? readFileSync(startupLog, "utf8").split(/\r?\n/).slice(-15).join("\n") : "";
  throw new Error(`PostgreSQL 60 saniye icinde hazir olmadi.\n${tail}`);
}

function stop() {
  if (!isRunning()) {
    console.log("PostgreSQL calismiyor.");
    return;
  }
  run("pg_ctl", ["-D", pgData, "-m", "fast", "-w", "stop"]);
}

function status() {
  console.log(`Veri dizini : ${pgData}`);
  console.log(`Binary      : ${pgBinDir || "(PATH)"}`);
  console.log(`Adres       : ${host}:${port}`);
  console.log(`Durum       : ${!isInitialized() ? "kurulmamis" : isRunning() ? "calisiyor" : "durdu"}`);
}

function psql() {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) throw new Error("DATABASE_MIGRATION_URL tanimli degil. Once `pnpm db:init` calistirin.");
  const result = spawnSync(bin("psql"), [url, ...process.argv.slice(3)], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

const commands = { init, start, stop, status, psql, restart: () => { stop(); start(); } };
const command = process.argv[2];

if (!command || !(command in commands)) {
  console.error(`Kullanim: node scripts/local/postgres.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(1);
}

try {
  commands[command]();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
