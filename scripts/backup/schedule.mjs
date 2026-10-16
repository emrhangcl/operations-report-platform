#!/usr/bin/env node
// Gunluk sifreli yedegi Windows Gorev Zamanlayici'ya kaydeder.
//
//   node scripts/backup/schedule.mjs install   (pnpm backup:schedule)
//   node scripts/backup/schedule.mjs remove    (pnpm backup:unschedule)
//   node scripts/backup/schedule.mjs status
//
// Gorev oturum acmis kullanici adina, yonetici yetkisi olmadan calisir. Saat BACKUP_TIME (SS:DD,
// varsayilan 02:00) ile degistirilebilir. Linux/macOS'ta esdeger cron satiri yazdirilir.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const taskName = "OperationsPortal-Yedek";
const time = process.env.BACKUP_TIME || "02:00";
const runner = join(repoRoot, "scripts", "backup", "run-backup.cmd");
const command = process.argv[2];

if (!/^\d{2}:\d{2}$/.test(time)) {
  console.error("BACKUP_TIME SS:DD biciminde olmalidir (or. 02:00).");
  process.exit(1);
}

if (process.platform !== "win32") {
  const [hour, minute] = time.split(":");
  console.log("Bu komut Windows icindir. crontab -e ile su satiri ekleyin:");
  console.log(`${Number(minute)} ${Number(hour)} * * * cd ${repoRoot} && pnpm backup >> "$HOME/.local/share/operations-portal/backups/backup.log" 2>&1`);
  process.exit(0);
}

function schtasks(args) {
  const result = spawnSync("schtasks", args, { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim() };
}

if (command === "install") {
  const result = schtasks(["/Create", "/TN", taskName, "/TR", `"${runner}"`, "/SC", "DAILY", "/ST", time, "/F"]);
  if (!result.ok) {
    console.error(`Gorev olusturulamadi:\n${result.output}`);
    process.exit(1);
  }
  console.log(`Gunluk yedek gorevi kuruldu: "${taskName}", her gun ${time}. Kaldirmak icin: pnpm backup:unschedule`);
} else if (command === "remove") {
  const result = schtasks(["/Delete", "/TN", taskName, "/F"]);
  console.log(result.ok ? `"${taskName}" gorevi kaldirildi.` : `Gorev bulunamadi veya kaldirilamadi:\n${result.output}`);
} else if (command === "status") {
  const result = schtasks(["/Query", "/TN", taskName, "/FO", "LIST"]);
  console.log(result.ok ? result.output : `"${taskName}" gorevi kurulu degil.`);
} else {
  console.error("Kullanim: node scripts/backup/schedule.mjs <install|remove|status>");
  process.exit(1);
}
