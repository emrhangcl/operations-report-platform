// Operasyon Portali HTTP sunucusu.
//
//   node server.mjs --dev   -> gelistirme (next dev ile ayni)
//   node server.mjs         -> production (once `next build`)
//
// Next.js route'lari soket adresini goremez ve istemcinin gonderdigi `X-Forwarded-For` basligini
// oldugu gibi korur. Bu sarmalayici istemci adresini soketten belirler, istemciden gelen adres
// basliklarini siler ve dogrulanmis adresi `x-ops-client-ip` basligiyla iletir.
// `TRUST_PROXY_IPS` (virgulle ayrilmis) tanimliysa yalnizca bu adreslerden gelen isteklerde
// `X-Forwarded-For` zincirine bakilir.

import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { parseTrustedProxies, resolveClientAddress } from "./lib/client-address.mjs";

const dev = process.argv.includes("--dev");
const hostname = process.env.HOSTNAME || "localhost";
const port = Number(process.env.PORT || 3000);
const trustedProxies = parseTrustedProxies(process.env.TRUST_PROXY_IPS);

const app = next({ dev, hostname, port, dir: dirname(fileURLToPath(import.meta.url)) });
const handle = app.getRequestHandler();

await app.prepare();

createServer((request, response) => {
  const forwardedFor = request.headers["x-forwarded-for"];
  const client = resolveClientAddress(
    request.socket.remoteAddress,
    Array.isArray(forwardedFor) ? forwardedFor.join(",") : forwardedFor,
    trustedProxies
  );

  delete request.headers["x-forwarded-for"];
  delete request.headers["x-real-ip"];
  delete request.headers["x-ops-client-ip"];
  if (client) {
    request.headers["x-ops-client-ip"] = client;
    request.headers["x-forwarded-for"] = client;
  }

  handle(request, response);
}).listen(port, hostname, () => {
  console.log(`Operasyon Portali hazir: http://${hostname}:${port} (${dev ? "gelistirme" : "production"})`);
});
