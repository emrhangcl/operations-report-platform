"use client";

import { useCallback, useEffect, useState } from "react";
import { scopeHeaders } from "../../../lib/browser-client";
import { emptyDashboard, emptyMetrics, type DashboardPayload } from "./platform-types";

export class PlatformRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const GET_CACHE_TTL_MS = 5_000;
const getCache = new Map<string, { expiresAt: number; value: unknown }>();
const getRequests = new Map<string, Promise<unknown>>();

async function executePlatformRequest<T>(path: string, init: RequestInit | undefined) {
  const headers = new Headers(init?.headers);
  for (const [name, value] of Object.entries(scopeHeaders("admin"))) headers.set(name, value);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin", headers });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new PlatformRequestError(body.message ?? "İşlem tamamlanamadı.", response.status);
  return body;
}

export async function platformRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET" || init?.body) {
    try {
      return await executePlatformRequest<T>(path, init);
    } finally {
      // A failed deletion can still have closed the tenant or removed accounts.
      getCache.clear();
      getRequests.clear();
    }
  }

  const key = path;
  const cached = getCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const pending = getRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = executePlatformRequest<T>(path, init).then((value) => {
    getCache.set(key, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value });
    return value;
  }).finally(() => {
    if (getRequests.get(key) === request) getRequests.delete(key);
  });

  getRequests.set(key, request);
  return request;
}

export function usePlatformDashboard() {
  const [data, setData] = useState<DashboardPayload>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    try {
      const next = await platformRequest<DashboardPayload>("/api/platform/dashboard");
      setData({ ...emptyDashboard, ...next, metrics: { ...emptyMetrics, ...next.metrics } });
    } catch (requestError) {
      if (requestError instanceof PlatformRequestError && (requestError.status === 401 || requestError.status === 403)) {
        window.location.assign(requestError.status === 401 ? "/login" : "/forbidden");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Platform verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
