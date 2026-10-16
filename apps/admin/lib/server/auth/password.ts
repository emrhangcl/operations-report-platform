import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Parola ozeti bicimi: scrypt$N$r$p$tuz$ozet (base64url). Parametreler ozetle birlikte saklandigi
// icin ileride artirilabilir; eski ozetler giriste `needsRehash` ile yenilenir.
const CURRENT = { N: 32_768, r: 8, p: 1, keyLength: 64 } as const;
const MAX_PASSWORD_LENGTH = 256;

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number; keyLength: number }) {
  const options: ScryptOptions = { N: params.N, r: params.r, p: params.p, maxmem: 128 * params.N * params.r * 2 };
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, params.keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  if (password.length > MAX_PASSWORD_LENGTH) throw new Error("Parola cok uzun.");
  const salt = randomBytes(16);
  const key = await derive(password, salt, CURRENT);
  return `scrypt$${CURRENT.N}$${CURRENT.r}$${CURRENT.p}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

function parse(stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (!N || !r || !p || N > 1 << 20 || r > 32 || p > 16) return null;
  const salt = Buffer.from(parts[4] as string, "base64url");
  const key = Buffer.from(parts[5] as string, "base64url");
  if (salt.length < 16 || key.length < 32) return null;
  return { N, r, p, salt, key };
}

// Kullanici bulunamadiginda da ayni maliyette bir dogrulama yapilir; boylece yanit suresi
// e-postanin kayitli olup olmadigini ele vermez.
let dummyHash: Promise<string> | null = null;

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false;
  const effective = stored ?? await (dummyHash ??= hashPassword(randomBytes(24).toString("base64url")));
  const parsed = parse(effective);
  if (!parsed) return false;
  const candidate = await derive(password, parsed.salt, { N: parsed.N, r: parsed.r, p: parsed.p, keyLength: parsed.key.length });
  return Boolean(stored) && candidate.length === parsed.key.length && timingSafeEqual(candidate, parsed.key);
}

export function needsRehash(stored: string) {
  const parsed = parse(stored);
  return !parsed || parsed.N !== CURRENT.N || parsed.r !== CURRENT.r || parsed.p !== CURRENT.p || parsed.key.length !== CURRENT.keyLength;
}
