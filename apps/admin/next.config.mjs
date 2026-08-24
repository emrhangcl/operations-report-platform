import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicEnvKeys = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

function loadProjectEnv() {
  const envPath = resolve(projectRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const rawLine of envFile.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const entry = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();

    if (
      !publicEnvKeys.has(key) ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
      process.env[key] !== undefined
    ) {
      continue;
    }

    let value = entry.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadProjectEnv();

const supabaseImageHost = (() => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  try {
    return new URL(rawUrl).hostname;
  } catch {
    return undefined;
  }
})();

const publicEnv = Object.fromEntries(
  Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }).filter((entry) => entry[1] !== undefined)
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: publicEnv,
  ...(supabaseImageHost
    ? {
        images: {
          remotePatterns: [
            {
              protocol: "https",
              hostname: supabaseImageHost,
              pathname: "/storage/v1/object/sign/**"
            }
          ]
        }
      }
    : {}),
  outputFileTracingRoot: projectRoot,
  transpilePackages: ["@tunca/shared", "@tunca/types", "@tunca/validation"]
};

export default nextConfig;
