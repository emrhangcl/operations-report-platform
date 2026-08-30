import "server-only";

import { FixedWindowRateLimiter } from "@operations/shared";
import { NextResponse } from "next/server";
import { getRequestId } from "./observability";

const limiter = new FixedWindowRateLimiter(30, 60_000);

function clientIdentity(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return (forwarded || realIp || "unknown").slice(0, 120);
}

export function enforceRateLimit(request: Request, scope: string) {
  const decision = limiter.check(`${scope}:${clientIdentity(request)}`);
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
