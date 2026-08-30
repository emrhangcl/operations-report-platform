"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type BrowserSupabaseScope = "admin" | "personnel";

const storageKeys: Record<BrowserSupabaseScope, string> = {
  admin: "operations-admin-auth",
  personnel: "operations-personnel-auth"
};

const clients: Partial<Record<BrowserSupabaseScope, SupabaseClient>> = {};

export function getBrowserSupabase(scope: BrowserSupabaseScope = "admin") {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  if (!clients[scope]) {
    clients[scope] = createClient(url, anonKey, {
      auth: {
        storageKey: storageKeys[scope]
      }
    });
  }

  return clients[scope];
}
