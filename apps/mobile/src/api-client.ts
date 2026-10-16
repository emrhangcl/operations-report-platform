import { createQueryClient, type QueryResult, type QuerySpec } from "@operations/data-client";
import * as SecureStore from "expo-secure-store";

// Mobil istemci yerel sunucuya (Operasyon Portali) Bearer belirtec ile baglanir. Belirtec cihazin
// sifreli anahtar deposunda (Keychain / Android Keystore) tutulur; duz metin depolamaya yazilmaz.

export interface MobileSession {
  access_token: string;
  expires_at: string;
  user: { id: string; email: string };
}

type AuthListener = (event: "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT", session: MobileSession | null) => void;

const SESSION_KEY = "operations.session";

export function createMobileClient(apiUrl: string) {
  const baseUrl = apiUrl.replace(/\/+$/, "");
  const listeners = new Set<AuthListener>();
  let current: MobileSession | null = null;
  let loaded: Promise<MobileSession | null> | null = null;

  function emit(event: Parameters<AuthListener>[0], session: MobileSession | null) {
    for (const listener of listeners) listener(event, session);
  }

  async function persist(session: MobileSession | null) {
    current = session;
    if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  }

  async function loadSession() {
    loaded ??= SecureStore.getItemAsync(SESSION_KEY).then((raw) => {
      if (!raw) return null;
      try {
        const session = JSON.parse(raw) as MobileSession;
        current = Date.parse(session.expires_at) > Date.now() ? session : null;
      } catch {
        current = null;
      }
      return current;
    });
    return loaded;
  }

  async function authorizedFetch(path: string, init: RequestInit = {}) {
    const session = current ?? await loadSession();
    const headers = new Headers(init.headers);
    if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (response.status === 401 && session) {
      await persist(null);
      emit("SIGNED_OUT", null);
    }
    return response;
  }

  const db = createQueryClient(async (spec: QuerySpec) => {
    const response = await authorizedFetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec)
    });
    return await response.json() as QueryResult<unknown>;
  });

  return {
    from: db.from,

    auth: {
      async getSession() {
        return { data: { session: current ?? await loadSession() } };
      },

      onAuthStateChange(listener: AuthListener) {
        listeners.add(listener);
        void loadSession().then((session) => {
          if (listeners.has(listener)) listener("INITIAL_SESSION", session);
        });
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },

      async signInWithPassword(credentials: { email: string; password: string }) {
        try {
          const response = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...credentials, client: "mobile" })
          });
          const body = await response.json().catch(() => ({})) as {
            access_token?: string;
            expires_at?: string;
            message?: string;
          };
          if (!response.ok || !body.access_token || !body.expires_at) {
            return { error: { message: body.message ?? "Giriş yapılamadı." } };
          }

          const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
            headers: { Authorization: `Bearer ${body.access_token}` }
          });
          const sessionBody = await sessionResponse.json().catch(() => ({})) as { user?: MobileSession["user"] };
          if (!sessionResponse.ok || !sessionBody.user) return { error: { message: "Oturum doğrulanamadı." } };

          const session: MobileSession = { access_token: body.access_token, expires_at: body.expires_at, user: sessionBody.user };
          await persist(session);
          emit("SIGNED_IN", session);
          return { error: null };
        } catch {
          return { error: { message: "Sunucuya ulaşılamadı." } };
        }
      },

      async signOut() {
        if (current) await authorizedFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        await persist(null);
        emit("SIGNED_OUT", null);
        return { error: null };
      }
    },

    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: Blob, options: { contentType?: string; upsert?: boolean } = {}) {
            const encodedPath = path.split("/").map(encodeURIComponent).join("/");
            const response = await authorizedFetch(
              `/api/storage/object/${encodeURIComponent(bucket)}/${encodedPath}${options.upsert ? "?upsert=true" : ""}`,
              {
                method: "POST",
                headers: { "Content-Type": options.contentType || file.type || "application/octet-stream" },
                body: file
              }
            );
            const body = await response.json().catch(() => ({})) as { path?: string; message?: string };
            return response.ok && body.path
              ? { data: { path: body.path }, error: null }
              : { data: null, error: { message: body.message ?? "Dosya yüklenemedi." } };
          }
        };
      }
    }
  };
}

export type MobileClient = ReturnType<typeof createMobileClient>;
