import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(
  repositoryRoot,
  ".agents",
  "skills",
  "impeccable",
  "scripts",
  process.platform === "win32" ? "impeccable.cmd" : "impeccable"
);

const result = spawnSync(
  launcher,
  ["detect", "--no-advisory", "apps/admin/app", "apps/admin/components"],
  {
    cwd: repositoryRoot,
    shell: process.platform === "win32",
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
