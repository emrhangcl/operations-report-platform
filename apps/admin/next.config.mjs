import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// Yerel kurulum tek bir kok .env kullanir; burada yalnizca guvenlik basliklarini etkileyen
// APP_URL okunur. Sirlar istemci paketine hic tasinmaz.
function readProjectEnv(name) {
  if (process.env[name] !== undefined) return process.env[name];
  const envPath = resolve(projectRoot, ".env");
  if (!existsSync(envPath)) return undefined;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const entry = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0 || entry.slice(0, separatorIndex).trim() !== name) continue;
    let value = entry.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return undefined;
}

const isProduction = process.env.NODE_ENV === "production";
const servedOverHttps = (readProjectEnv("APP_URL") ?? "").startsWith("https://");
// Dev-only allowance so Impeccable Live Mode can load.
const __impeccableLiveDev =
  process.env.NODE_ENV === "development" ? " http://localhost:8400" : "";

// Uygulama ucuncu taraf servise baglanmaz: veri, dosya ve kimlik dogrulama ayni kaynaktan sunulur.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${__impeccableLiveDev}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${__impeccableLiveDev}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  ...(servedOverHttps ? ["upgrade-insecure-requests"] : [])
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
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
      "./node_modules/pdfmake/fonts/Roboto/*.ttf",
      "./public/operations-app-icon.png"
    ]
  },
  // pg yerel modul yuklemelerini dinamik yaptigi icin server paketine dahil edilmez.
  serverExternalPackages: ["pg"],
  outputFileTracingRoot: projectRoot,
  transpilePackages: ["@operations/data-client", "@operations/shared", "@operations/types", "@operations/validation"],
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" } : {})
};

export default nextConfig;
