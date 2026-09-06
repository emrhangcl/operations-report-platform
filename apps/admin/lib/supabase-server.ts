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

type OrganizationMemberRole = "OWNER" | "ADMIN" | "PERSONNEL";
type AccessRequirement = "read" | "write";
type AccessMode = "blocked" | "read" | "write";

interface UserAccessContext {
  organization_id: string;
  organization_name: string;
  organization_logo_path: string | null;
  profile_is_active: boolean;
  member_role: OrganizationMemberRole | null;
  membership_is_active: boolean | null;
  organization_status: string;
  subscription_status: string | null;
  access_mode: AccessMode;
}

export async function requirePlatformAdmin(request: Request) {
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

  let service;
  try {
    service = getServiceSupabase();
  } catch {
    return { ok: false as const, message: "Platform yönetimi yapılandırılmamış." };
  }

  const platformCheck = await service.rpc("is_platform_admin_for_user", {
    candidate_user_id: data.user.id
  });

  if (platformCheck.error || platformCheck.data !== true) {
    return { ok: false as const, message: "Platform yöneticisi yetkisi gerekli." };
  }

  return {
    ok: true as const,
    userId: data.user.id,
    service
  };
}

async function requireOrganizationProfile(request: Request, requiredAccess: AccessRequirement) {
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
  const contextResult = await service.rpc("get_user_access_context", {
    candidate_user_id: data.user.id
  });
  const context = (Array.isArray(contextResult.data) ? contextResult.data[0] : null) as UserAccessContext | null;

  if (contextResult.error || !context?.profile_is_active || !context.organization_id) {
    return { ok: false as const, message: "Aktif kullanıcı profili bulunamadı." };
  }

  if (!context.membership_is_active || !context.member_role || context.organization_status !== "active") {
    return { ok: false as const, message: "Aktif organizasyon üyeliği bulunamadı." };
  }

  const accessMode = context.access_mode;

  if (accessMode === "blocked") {
    return { ok: false as const, message: "Geçerli bir abonelik bulunamadı." };
  }

  if (requiredAccess === "write" && accessMode !== "write") {
    return { ok: false as const, message: "Bu hesap salt okunur durumdadır." };
  }

  return {
    ok: true as const,
    userId: data.user.id,
    organizationId: context.organization_id,
    organizationName: context.organization_name,
    organizationLogoPath: context.organization_logo_path,
    memberRole: context.member_role,
    accessMode,
    subscriptionStatus: context.subscription_status,
    service
  };
}

export async function requireAdmin(request: Request, requiredAccess: AccessRequirement = "write") {
  const auth = await requireOrganizationProfile(request, requiredAccess);
  if (!auth.ok) {
    return auth;
  }

  if (auth.memberRole !== "OWNER" && auth.memberRole !== "ADMIN") {
    return { ok: false as const, message: "Bu işlem için admin yetkisi gereklidir." };
  }

  return auth;
}

export async function requireActiveProfile(request: Request, requiredAccess: AccessRequirement = "write") {
  const auth = await requireOrganizationProfile(request, requiredAccess);
  if (!auth.ok) {
    return auth;
  }

  return {
    ...auth,
    role: auth.memberRole === "PERSONNEL" ? "PERSONNEL" as const : "ADMIN" as const
  };
}
