import "server-only";

import { isIP } from "node:net";

// Istemci adresi yalnizca server.mjs'in (veya guvenilir reverse proxy'nin) yazdigi
// `x-ops-client-ip` basligindan okunur. Istemcinin gonderdigi X-Forwarded-For / X-Real-IP
// degerlerine guvenilmez; aksi halde hiz sinirlari sahte adreslerle atlatilabilir.

let warnedUnverified = false;

export function getClientIp(request: Request): string | null {
  const value = request.headers.get("x-ops-client-ip")?.trim();
  if (value && isIP(value)) return value;

  if (!warnedUnverified) {
    warnedUnverified = true;
    console.warn(JSON.stringify({
      level: "warn",
      event: "client_ip_unverified",
      message: "Istemci adresi dogrulanamadi; uygulamayi server.mjs ile veya x-ops-client-ip yazan bir proxy arkasinda calistirin."
    }));
  }
  return null;
}
