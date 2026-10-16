import "server-only";

import type { NextResponse } from "next/server";
import { getClientIp } from "../client-ip";
import { getServerConfig } from "../config";
import { isSessionScope, resolveSession, type ActiveSession, type RequestMeta, type SessionScope } from "./sessions";

// Web istemcileri oturumu httpOnly + SameSite=Strict cerezle tasir; JavaScript belirtece erisemez.
// Hangi cerezin kullanilacagini `X-Auth-Scope` basligi belirler. Bu ozel baslik ayni zamanda
// capraz kaynakli formlarin istek uretmesini engeller (CSRF). Mobil istemci Bearer belirtec kullanir.

export const AUTH_SCOPE_HEADER = "x-auth-scope";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function sessionCookieName(scope: SessionScope) {
  const base = scope === "admin" ? "ops_admin_session" : "ops_personnel_session";
  return getServerConfig().secureCookies ? `__Host-${base}` : base;
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function getRequestMeta(request: Request): RequestMeta {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? null
  };
}

/** Durum degistiren cerezli isteklerin uygulamanin kendi kaynagindan geldigini dogrular. */
export function isSameOriginRequest(request: Request) {
  const allowed = new Set([getServerConfig().appUrl.origin, new URL(request.url).origin]);
  const origin = request.headers.get("origin");
  if (origin) return allowed.has(origin);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return allowed.has(new URL(referer).origin);
    } catch {
      return false;
    }
  }
  return false;
}

export interface AuthenticatedRequest {
  session: ActiveSession;
  transport: "cookie" | "bearer";
  token: string;
}

export function readRequestScope(request: Request): SessionScope | null {
  const scope = request.headers.get(AUTH_SCOPE_HEADER);
  return isSessionScope(scope) ? scope : null;
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest | null> {
  const bearer = /^Bearer\s+([A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (bearer) {
    const session = await resolveSession(bearer);
    // Bearer yalnizca mobil oturumlar icindir; web oturum belirteci tarayicida JS'e hic acilmaz.
    if (!session || session.client !== "mobile") return null;
    return { session, transport: "bearer", token: bearer };
  }

  const scope = readRequestScope(request);
  if (!scope) return null;
  if (unsafeMethods.has(request.method) && !isSameOriginRequest(request)) return null;

  const token = readCookie(request, sessionCookieName(scope));
  if (!token) return null;
  const session = await resolveSession(token);
  if (!session || session.scope !== scope || session.client !== "web") return null;
  return { session, transport: "cookie", token };
}

export function setSessionCookie(response: NextResponse, scope: SessionScope, token: string, expiresAt: Date) {
  response.cookies.set(sessionCookieName(scope), token, {
    httpOnly: true,
    secure: getServerConfig().secureCookies,
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high"
  });
}

export function clearSessionCookie(response: NextResponse, scope: SessionScope) {
  response.cookies.set(sessionCookieName(scope), "", {
    httpOnly: true,
    secure: getServerConfig().secureCookies,
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}

export function readSessionCookie(request: Request, scope: SessionScope) {
  return readCookie(request, sessionCookieName(scope));
}

/** Istek bir oturum belirteci tasiyor mu? (Gecerli olup olmadigindan bagimsiz.) */
export function hasSessionCredentials(request: Request) {
  if (/^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? "")) return true;
  const scope = readRequestScope(request);
  return Boolean(scope && readCookie(request, sessionCookieName(scope)));
}
