"use client";

import { QueryBuilder, type QueryResult, type QuerySpec } from "@operations/data-client";

// Tarayici istemcisi. Oturum belirteci httpOnly cerezde durur ve JavaScript'e hic acilmaz; her
// istek yalnizca hangi oturumun (yonetici/personel) kullanilacagini `X-Auth-Scope` ile bildirir.

export type BrowserScope = "admin" | "personnel";

export interface SessionUser {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

export interface BrowserSession {
  user: SessionUser;
  expires_at: string;
}

type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";
type AuthListener = (event: AuthEvent, session: BrowserSession | null) => void;
type ClientError = { message: string; status?: number };

interface ScopeState {
  session: { value: BrowserSession | null; expiresAt: number } | null;
  sessionRequest: Promise<BrowserSession | null> | null;
  listeners: Set<AuthListener>;
}

interface BrowserState {
  scopes: Record<BrowserScope, ScopeState>;
  clients: Partial<Record<BrowserScope, BrowserClient>>;
  readCache: Map<string, { expiresAt: number; result: QueryResult<unknown> }>;
  readRequests: Map<string, Promise<QueryResult<unknown>>>;
}

declare global {
  interface Window {
    __operationsBrowserState?: BrowserState;
  }
}

const READ_CACHE_TTL_MS = 15_000;
const MAX_READ_CACHE_ENTRIES = 200;
const SESSION_CACHE_TTL_MS = 30_000;

function createState(): BrowserState {
  const scopeState = (): ScopeState => ({ session: null, sessionRequest: null, listeners: new Set() });
  return {
    scopes: { admin: scopeState(), personnel: scopeState() },
    clients: {},
    readCache: new Map(),
    readRequests: new Map()
  };
}

const fallbackState = createState();

function getState() {
  if (typeof window === "undefined") return fallbackState;
  window.__operationsBrowserState ??= createState();
  return window.__operationsBrowserState;
}

/** Uygulamanin kendi API rotalarina yapilan isteklerde kullanilacak oturum basligi. */
export function scopeHeaders(scope: BrowserScope): Record<string, string> {
  return { "X-Auth-Scope": scope };
}

export function clearReadCache() {
  const { readCache, readRequests } = getState();
  readCache.clear();
  readRequests.clear();
}

function pruneReadCache() {
  const { readCache } = getState();
  const now = Date.now();
  for (const [key, cached] of readCache) {
    if (cached.expiresAt <= now) readCache.delete(key);
  }
  while (readCache.size > MAX_READ_CACHE_ENTRIES) {
    const oldestKey = readCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    readCache.delete(oldestKey);
  }
}

function emit(scope: BrowserScope, event: AuthEvent, session: BrowserSession | null) {
  for (const listener of getState().scopes[scope].listeners) {
    try {
      listener(event, session);
    } catch {
      // Dinleyici hatalari diger dinleyicileri etkilemez.
    }
  }
}

function markSignedOut(scope: BrowserScope) {
  const state = getState().scopes[scope];
  const hadSession = Boolean(state.session?.value);
  state.session = { value: null, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
  state.sessionRequest = null;
  clearReadCache();
  if (hadSession) emit(scope, "SIGNED_OUT", null);
}

async function executeSpec(scope: BrowserScope, spec: QuerySpec): Promise<QueryResult<unknown>> {
  const response = await fetch("/api/data", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...scopeHeaders(scope) },
    body: JSON.stringify(spec)
  });
  const result = await response.json().catch(() => null) as QueryResult<unknown> | null;
  if (!result) {
    return { data: null, error: { message: "Sunucu yaniti okunamadi.", code: "invalid_response" }, count: null, status: response.status };
  }
  if (result.error?.code === "session_expired") markSignedOut(scope);
  return result;
}

function createTransport(scope: BrowserScope) {
  return async (spec: QuerySpec): Promise<QueryResult<unknown>> => {
    if (spec.action !== "select") {
      const result = await executeSpec(scope, spec);
      if (!result.error) clearReadCache();
      return result;
    }

    pruneReadCache();
    const { readCache, readRequests } = getState();
    const key = `${scope}|${JSON.stringify(spec)}`;
    const cached = readCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.result);

    const pending = readRequests.get(key);
    if (pending) return structuredClone(await pending);

    const request = executeSpec(scope, spec).then((result) => {
      if (!result.error) readCache.set(key, { expiresAt: Date.now() + READ_CACHE_TTL_MS, result });
      return result;
    }).finally(() => {
      if (readRequests.get(key) === request) readRequests.delete(key);
    });
    readRequests.set(key, request);
    return structuredClone(await request);
  };
}

async function fetchSession(scope: BrowserScope, force = false): Promise<BrowserSession | null> {
  const state = getState().scopes[scope];
  if (!force && state.session && state.session.expiresAt > Date.now()) return state.session.value;
  if (!force && state.sessionRequest) return state.sessionRequest;

  const request = fetch("/api/auth/session", {
    cache: "no-store",
    credentials: "same-origin",
    headers: scopeHeaders(scope)
  }).then(async (response) => {
    if (!response.ok) return null;
    const body = await response.json().catch(() => null) as { user?: SessionUser; expires_at?: string } | null;
    return body?.user && body.expires_at ? { user: body.user, expires_at: body.expires_at } : null;
  }).catch(() => state.session?.value ?? null);

  state.sessionRequest = request;
  try {
    const session = await request;
    state.session = { value: session, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
    return session;
  } finally {
    if (state.sessionRequest === request) state.sessionRequest = null;
  }
}

async function postJson<T>(url: string, scope: BrowserScope, body: unknown): Promise<{ data: T | null; error: ClientError | null }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...scopeHeaders(scope) },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({})) as { data?: T; message?: string } & T;
    if (response.status === 401) markSignedOut(scope);
    if (!response.ok) return { data: null, error: { message: payload.message ?? "Istek tamamlanamadi.", status: response.status } };
    return { data: (payload.data ?? payload) as T, error: null };
  } catch {
    return { data: null, error: { message: "Sunucuya ulasilamadi." } };
  }
}

function createStorage(scope: BrowserScope) {
  return {
    from(bucket: string) {
      const objectUrl = (path: string) => `/api/storage/object/${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;

      const createSignedUrls = (paths: string[], expiresIn: number) =>
        postJson<{ path: string; signedUrl: string | null; error: string | null }[]>("/api/storage/sign", scope, { bucket, paths, expiresIn });

      return {
        async upload(path: string, file: Blob, options: { contentType?: string; upsert?: boolean } = {}) {
          try {
            const response = await fetch(`${objectUrl(path)}${options.upsert ? "?upsert=true" : ""}`, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": options.contentType || file.type || "application/octet-stream", ...scopeHeaders(scope) },
              body: file
            });
            const payload = await response.json().catch(() => ({})) as { path?: string; message?: string };
            if (response.status === 401) markSignedOut(scope);
            if (!response.ok || !payload.path) {
              return { data: null, error: { message: payload.message ?? "Dosya yuklenemedi.", status: response.status } };
            }
            return { data: { path: payload.path }, error: null };
          } catch {
            return { data: null, error: { message: "Sunucuya ulasilamadi." } };
          }
        },

        createSignedUrls,

        async createSignedUrl(path: string, expiresIn: number) {
          const result = await createSignedUrls([path], expiresIn);
          const signedUrl = result.data?.[0]?.signedUrl;
          return signedUrl
            ? { data: { signedUrl }, error: null }
            : { data: null, error: result.error ?? { message: "Dosya bulunamadi.", status: 404 } };
        },

        async download(path: string) {
          const signed = await createSignedUrls([path], 60);
          const signedUrl = signed.data?.[0]?.signedUrl;
          if (!signedUrl) return { data: null, error: signed.error ?? { message: "Dosya bulunamadi.", status: 404 } };
          const response = await fetch(signedUrl, { cache: "no-store", credentials: "same-origin" });
          if (!response.ok) return { data: null, error: { message: "Dosya indirilemedi.", status: response.status } };
          return { data: await response.blob(), error: null };
        },

        remove(paths: string[]) {
          return postJson<{ name: string }[]>("/api/storage/remove", scope, { bucket, paths });
        }
      };
    }
  };
}

function createAuth(scope: BrowserScope) {
  return {
    async getSession() {
      return { data: { session: await fetchSession(scope) }, error: null };
    },

    async getUser() {
      const session = await fetchSession(scope, true);
      return { data: { user: session?.user ?? null }, error: session ? null : { message: "Oturum bulunamadi." } };
    },

    /** Girisi sunucu yapar; dogru oturum kapsamini (yonetici/personel) ve yonlendirmeyi o belirler. */
    async signInWithPassword(credentials: { email: string; password: string }) {
      const result = await postJson<{ scope: BrowserScope; redirectTo: string }>("/api/auth/login", scope, {
        email: credentials.email,
        password: credentials.password,
        client: "web"
      });
      if (result.data) {
        clearReadCache();
        const session = await fetchSession(result.data.scope, true);
        emit(result.data.scope, "SIGNED_IN", session);
      }
      return result;
    },

    async signOut() {
      await postJson("/api/auth/logout", scope, {});
      markSignedOut(scope);
      return { error: null };
    },

    onAuthStateChange(callback: AuthListener) {
      const { listeners } = getState().scopes[scope];
      listeners.add(callback);
      void fetchSession(scope).then((session) => {
        if (listeners.has(callback)) callback("INITIAL_SESSION", session);
      });
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    }
  };
}

function createBrowserClient(scope: BrowserScope) {
  const transport = createTransport(scope);
  return {
    scope,
    from: (table: string) => new QueryBuilder(transport, table),
    auth: createAuth(scope),
    storage: createStorage(scope)
  };
}

export type BrowserClient = ReturnType<typeof createBrowserClient>;

export function getBrowserClient(scope: BrowserScope = "admin"): BrowserClient {
  const { clients } = getState();
  clients[scope] ??= createBrowserClient(scope);
  return clients[scope];
}
