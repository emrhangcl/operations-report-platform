import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function readProjectEnv(name: string) {
  const paths = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../..", ".env")];

  for (const envPath of paths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const envFile = readFileSync(envPath, "utf8");

    for (const rawLine of envFile.split(/\r?\n/)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const entry = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex <= 0 || entry.slice(0, separatorIndex).trim() !== name) {
        continue;
      }

      let value = entry.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      return value;
    }
  }

  return undefined;
}

function getEnv(name: string) {
  return process.env[name] ?? readProjectEnv(name);
}

export function getSupabaseConfig() {
  const url = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return { url, anonKey, serviceRoleKey };
}

export function getServiceSupabase() {
  const { url, serviceRoleKey } = getSupabaseConfig();
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function requireAdmin(request: Request) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return { ok: false as const, message: "Supabase yapılandırması eksik." };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false as const, message: "Oturum bulunamadı." };
  }

  const authClient = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false as const, message: "Oturum doğrulanamadı." };
  }

  const service = getServiceSupabase();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "ADMIN" || profile.is_active !== true) {
    return { ok: false as const, message: "Bu işlem için admin yetkisi gereklidir." };
  }

  return { ok: true as const, userId: data.user.id, service };
}
