import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const publicEnvKeys = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS"
]);

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

const supabaseEndpoint = (() => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  try {
    return new URL(rawUrl);
  } catch {
    return undefined;
  }
})();

const supabaseConnectSources = supabaseEndpoint
  ? ` ${supabaseEndpoint.origin} ${supabaseEndpoint.protocol === "https:" ? "wss:" : "ws:"}//${supabaseEndpoint.host}`
  : "";
const supabaseImageSource = supabaseEndpoint ? ` ${supabaseEndpoint.origin}` : "";

const publicEnv = Object.fromEntries(
  Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS
  }).filter((entry) => entry[1] !== undefined)
);

const isProduction = process.env.NODE_ENV === "production";
const vercelObservabilityEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" || Boolean(process.env.VERCEL);
const vercelScriptSource = vercelObservabilityEnabled ? " https://va.vercel-scripts.com" : "";
const vercelConnectSources = vercelObservabilityEnabled
  ? " https://vitals.vercel-insights.com https://*.vercel-insights.com https://va.vercel-scripts.com"
  : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${vercelScriptSource}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co${supabaseImageSource}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${supabaseConnectSources}${vercelConnectSources}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: publicEnv,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()"
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off"
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin"
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin"
          }
        ]
      }
    ];
  },
  outputFileTracingIncludes: {
    "/api/reports/[id]/pdf": [
      "./node_modules/pdfmake/fonts/Roboto/*.ttf"
    ]
  },
  ...(supabaseEndpoint
    ? {
        images: {
          remotePatterns: [
            {
              protocol: supabaseEndpoint.protocol.slice(0, -1),
              hostname: supabaseEndpoint.hostname,
              port: supabaseEndpoint.port,
              pathname: "/storage/v1/object/sign/**"
            }
          ]
        }
      }
    : {}),
  outputFileTracingRoot: projectRoot,
  transpilePackages: ["@operations/shared", "@operations/types", "@operations/validation"],
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {})
};

export default nextConfig;
