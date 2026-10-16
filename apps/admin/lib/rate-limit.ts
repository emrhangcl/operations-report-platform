import "server-only";

import { FixedWindowRateLimiter } from "@operations/shared";
import { NextResponse } from "next/server";
import { getRequestId } from "./observability";

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;
const limiters = new Map<string, FixedWindowRateLimiter>();

function getLimiter(limit: number, windowMs: number) {
  const key = `${limit}:${windowMs}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new FixedWindowRateLimiter(limit, windowMs);
    limiters.set(key, limiter);
  }
  return limiter;
}

function clientIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown").slice(0, 120);
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  /** Kimligi dogrulanmis isteklerde IP yerine kullanici bazli sayac kullanilir. */
  identity?: string;
}

export function enforceRateLimit(request: Request, scope: string, options: RateLimitOptions = {}) {
  const limiter = getLimiter(options.limit ?? DEFAULT_LIMIT, options.windowMs ?? DEFAULT_WINDOW_MS);
  const decision = limiter.check(`${scope}:${options.identity ?? clientIdentity(request)}`);
  if (decision.allowed) return null;

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
        "Retry-After": String(decision.retryAfterSeconds),
        "X-Request-ID": requestId
      }
    }
  );
}
