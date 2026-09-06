"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BrowserSupabaseScope = "admin" | "personnel";

interface SupabaseBrowserState {
  clients: Partial<Record<BrowserSupabaseScope, SupabaseClient>>;
  readCache: Map<string, { expiresAt: number; response: Response }>;
  readRequests: Map<string, Promise<Response>>;
}

declare global {
  interface Window {
    __operationsSupabaseBrowserState?: SupabaseBrowserState;
  }
}

const storageKeys: Record<BrowserSupabaseScope, string> = {
  admin: "operations-admin-auth",
  personnel: "operations-personnel-auth"
};

const READ_CACHE_TTL_MS = 15_000;
const MAX_READ_CACHE_ENTRIES = 200;
const fallbackState: SupabaseBrowserState = {
  clients: {},
  readCache: new Map(),
  readRequests: new Map()
};

function getBrowserState() {
  if (typeof window === "undefined") return fallbackState;
  window.__operationsSupabaseBrowserState ??= {
    clients: {},
    readCache: new Map(),
    readRequests: new Map()
  };
  return window.__operationsSupabaseBrowserState;
}

function isPostgrestRequest(url: string) {
  return url.includes("/rest/v1/");
}

function readCacheKey(request: Request) {
  return [
    request.url,
    request.headers.get("authorization") ?? "",
    request.headers.get("accept-profile") ?? "",
    request.headers.get("range") ?? "",
    request.headers.get("prefer") ?? ""
  ].join("|");
}

function pruneReadCache() {
  const { readCache } = getBrowserState();
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

async function cachedSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  const request = new Request(input, init);
  const isRead = request.method === "GET" && isPostgrestRequest(request.url);

  if (!isRead) {
    const response = await fetch(request);
    if (response.ok && isPostgrestRequest(request.url)) clearSupabaseReadCache();
    return response;
  }

  pruneReadCache();
  const { readCache, readRequests } = getBrowserState();
  const key = readCacheKey(request);
  const cached = readCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.response.clone();

  const pending = readRequests.get(key);
  if (pending) return (await pending).clone();

  const responseRequest = fetch(request).then((response) => {
    if (response.ok) {
      readCache.set(key, {
        expiresAt: Date.now() + READ_CACHE_TTL_MS,
        response: response.clone()
      });
    }
    return response;
  }).finally(() => {
    if (readRequests.get(key) === responseRequest) readRequests.delete(key);
  });

  readRequests.set(key, responseRequest);
  return (await responseRequest).clone();
}

export function clearSupabaseReadCache() {
  const { readCache, readRequests } = getBrowserState();
  readCache.clear();
  readRequests.clear();
}

export function getBrowserSupabase(scope: BrowserSupabaseScope = "admin") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const { clients } = getBrowserState();
  if (!clients[scope]) {
    clients[scope] = createClient(url, anonKey, {
      global: {
        fetch: cachedSupabaseFetch
      },
      auth: {
        storageKey: storageKeys[scope]
      }
    });
  }

  return clients[scope];
}
