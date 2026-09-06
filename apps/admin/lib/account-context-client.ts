"use client";

import { getBrowserSupabase } from "./supabase-browser";

export type AccountScope = "admin" | "personnel";

export interface AccountContextPayload {
  accessMode: "read" | "write";
  subscriptionStatus: string | null;
  role: "ADMIN" | "PERSONNEL";
  organizationName: string;
  logoUrl: string | null;
}

export class AccountContextError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

interface AccountContextState {
  cache: Map<AccountScope, { token: string; expiresAt: number; value: AccountContextPayload }>;
  inFlight: Map<AccountScope, { token: string; request: Promise<AccountContextPayload> }>;
}

declare global {
  interface Window {
    __operationsAccountContextState?: AccountContextState;
  }
}

const CACHE_TTL_MS = 30_000;
const fallbackState: AccountContextState = { cache: new Map(), inFlight: new Map() };

function getAccountContextState() {
  if (typeof window === "undefined") return fallbackState;
  window.__operationsAccountContextState ??= { cache: new Map(), inFlight: new Map() };
  return window.__operationsAccountContextState;
}

export async function loadAccountContext(scope: AccountScope, force = false) {
  const { cache, inFlight } = getAccountContextState();
  const supabase = getBrowserSupabase(scope);
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const token = data.session?.access_token;

  if (!token) {
    throw new AccountContextError("Oturum bulunamadı.", 401);
  }

  const cached = cache.get(scope);
  if (!force && cached?.token === token && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pending = inFlight.get(scope);
  if (!force && pending?.token === token) {
    return pending.request;
  }

  const request = fetch("/api/account/access", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` }
  }).then(async (response) => {
    const body = await response.json().catch(() => ({})) as AccountContextPayload & { message?: string };
    if (!response.ok) {
      throw new AccountContextError(body.message ?? "Hesap erişimi doğrulanamadı.", response.status);
    }

    cache.set(scope, { token, expiresAt: Date.now() + CACHE_TTL_MS, value: body });
    return body;
  }).finally(() => {
    if (inFlight.get(scope)?.request === request) inFlight.delete(scope);
  });

  inFlight.set(scope, { token, request });
  return request;
}

export function updateAccountBrandingCache(
  scope: AccountScope,
  branding: Pick<AccountContextPayload, "organizationName" | "logoUrl">
) {
  const { cache } = getAccountContextState();
  const cached = cache.get(scope);
  if (!cached) return;
  cache.set(scope, {
    ...cached,
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: { ...cached.value, ...branding }
  });
}

export function clearAccountContextCache(scope?: AccountScope) {
  const { cache, inFlight } = getAccountContextState();
  if (scope) {
    cache.delete(scope);
    inFlight.delete(scope);
    return;
  }
  cache.clear();
  inFlight.clear();
}
