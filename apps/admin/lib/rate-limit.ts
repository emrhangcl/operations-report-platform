import "server-only";

import { FixedWindowRateLimiter } from "@operations/shared";
import { NextResponse } from "next/server";
import { getRequestId } from "./observability";
import { getClientIp } from "./server/client-ip";
import { consumeRateLimit } from "./server/rate-limit-store";

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;

// Veritabanina ulasilamazsa sinir kaldirilmaz; surec belleginde tutulan yedek sayac devreye girer.
const fallbackLimiters = new Map<string, FixedWindowRateLimiter>();
let warnedFallback = false;

function getFallbackLimiter(limit: number, windowMs: number) {
  const key = `${limit}:${windowMs}`;
  let limiter = fallbackLimiters.get(key);
  if (!limiter) {
    limiter = new FixedWindowRateLimiter(limit, windowMs);
    fallbackLimiters.set(key, limiter);
  }
  return limiter;
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  /** Kimligi dogrulanmis isteklerde IP yerine kullanici bazli sayac kullanilir. */
  identity?: string;
}

export function tooManyRequests(request: Request, retryAfterSeconds: number) {
  const requestId = getRequestId(request);
  return NextResponse.json(
    {
      message: "Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.",
      request_id: requestId
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfterSeconds),
        "X-Request-ID": requestId
      }
    }
  );
}

export async function enforceRateLimit(request: Request, scope: string, options: RateLimitOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const key = `${scope}:${options.identity ?? getClientIp(request) ?? "unverified"}`;

  let allowed: boolean;
  let retryAfterSeconds: number;
  try {
    const decision = await consumeRateLimit(key, limit, Math.ceil(windowMs / 1000));
    allowed = decision.allowed;
    retryAfterSeconds = decision.retryAfterSeconds;
  } catch (error) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.error(JSON.stringify({
        level: "error",
        event: "rate_limit_store_unavailable",
        message: error instanceof Error ? error.message : String(error)
      }));
    }
    const decision = getFallbackLimiter(limit, windowMs).check(key);
    allowed = decision.allowed;
    retryAfterSeconds = decision.retryAfterSeconds;
  }

  return allowed ? null : tooManyRequests(request, retryAfterSeconds);
}
