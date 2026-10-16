import "server-only";

import { authenticateRequest } from "./auth/http";
import { ConfigurationError } from "./config";
import { createServiceClient, type ServiceClient } from "./service-client";

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

type GuardFailure = { ok: false; message: string; status: 401 | 403 | 503 };

async function authenticate(request: Request): Promise<{ ok: true; userId: string; service: ServiceClient } | GuardFailure> {
  try {
    const authenticated = await authenticateRequest(request);
    if (!authenticated) return { ok: false, message: "Oturum bulunamadı veya süresi doldu.", status: 401 };
    return { ok: true, userId: authenticated.session.userId, service: createServiceClient() };
  } catch (error) {
    if (error instanceof ConfigurationError) return { ok: false, message: "Sunucu yapılandırması eksik.", status: 503 };
    throw error;
  }
}

export async function requirePlatformAdmin(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth;

  const platformCheck = await auth.service.rpc("is_platform_admin_for_user", { candidate_user_id: auth.userId });
  if (platformCheck.error || platformCheck.data !== true) {
    return { ok: false as const, message: "Platform yöneticisi yetkisi gerekli.", status: 403 as const };
  }

  return { ok: true as const, userId: auth.userId, service: auth.service };
}

async function requireOrganizationProfile(request: Request, requiredAccess: AccessRequirement) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth;

  const contextResult = await auth.service.rpc("get_user_access_context", { candidate_user_id: auth.userId });
  const context = (Array.isArray(contextResult.data) ? contextResult.data[0] : null) as UserAccessContext | null;

  if (contextResult.error || !context?.profile_is_active || !context.organization_id) {
    return { ok: false as const, message: "Aktif kullanıcı profili bulunamadı.", status: 403 as const };
  }

  if (!context.membership_is_active || !context.member_role || context.organization_status !== "active") {
    return { ok: false as const, message: "Aktif organizasyon üyeliği bulunamadı.", status: 403 as const };
  }

  const accessMode = context.access_mode;
  if (accessMode === "blocked") {
    return { ok: false as const, message: "Geçerli bir abonelik bulunamadı.", status: 403 as const };
  }
  if (requiredAccess === "write" && accessMode !== "write") {
    return { ok: false as const, message: "Bu hesap salt okunur durumdadır.", status: 403 as const };
  }

  return {
    ok: true as const,
    userId: auth.userId,
    organizationId: context.organization_id,
    organizationName: context.organization_name,
    organizationLogoPath: context.organization_logo_path,
    memberRole: context.member_role,
    accessMode,
    subscriptionStatus: context.subscription_status,
    service: auth.service
  };
}

export async function requireAdmin(request: Request, requiredAccess: AccessRequirement = "write") {
  const auth = await requireOrganizationProfile(request, requiredAccess);
  if (!auth.ok) return auth;

  if (auth.memberRole !== "OWNER" && auth.memberRole !== "ADMIN") {
    return { ok: false as const, message: "Bu işlem için admin yetkisi gereklidir.", status: 403 as const };
  }

  return auth;
}

export async function requireActiveProfile(request: Request, requiredAccess: AccessRequirement = "write") {
  const auth = await requireOrganizationProfile(request, requiredAccess);
  if (!auth.ok) return auth;

  return {
    ...auth,
    role: auth.memberRole === "PERSONNEL" ? "PERSONNEL" as const : "ADMIN" as const
  };
}
