import { NextResponse, type NextRequest } from "next/server";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,100}$/;

export function middleware(request: NextRequest) {
  const incomingRequestId = request.headers.get("x-request-id")?.trim();
  const requestId = incomingRequestId && requestIdPattern.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-ID", requestId);
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (request.nextUrl.protocol === "https:" || forwardedProtocol === "https") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
