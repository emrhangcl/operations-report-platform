import "server-only";

import { randomUUID } from "node:crypto";
import type { ServiceClient } from "./server/service-client";

export const ORGANIZATION_LOGO_BUCKET = "organization-logos";
export const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const ORGANIZATION_LOGO_ACCEPT = "image/png,image/jpeg,image/webp";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type SupportedImage = {
  extension: "jpg" | "png" | "webp";
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export interface OrganizationBrandingPayload {
  organizationName: string;
  logoUrl: string | null;
}

export class OrganizationBrandingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function detectImage(buffer: Buffer): SupportedImage | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  return null;
}

function belongsToOrganization(path: string, organizationId: string) {
  return path.startsWith(`${organizationId}/`) && !path.includes("..") && !path.includes("\\");
}

export async function createOrganizationLogoUrl(
  service: ServiceClient,
  organizationId: string,
  logoPath: string | null
) {
  if (!logoPath || !belongsToOrganization(logoPath, organizationId)) {
    return null;
  }

  const { data, error } = await service.storage
    .from(ORGANIZATION_LOGO_BUCKET)
    .createSignedUrl(logoPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function createOrganizationLogoPdfDataUrl(
  service: ServiceClient,
  organizationId: string,
  logoPath: string | null
) {
  if (!logoPath || !belongsToOrganization(logoPath, organizationId)) {
    return null;
  }

  const { data, error } = await service.storage.from(ORGANIZATION_LOGO_BUCKET).download(logoPath);

  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const detected = detectImage(buffer);

  if (!detected || (detected.mimeType !== "image/png" && detected.mimeType !== "image/jpeg")) {
    return null;
  }

  return `data:${detected.mimeType};base64,${buffer.toString("base64")}`;
}

export async function getOrganizationBranding(
  service: ServiceClient,
  organizationId: string
): Promise<OrganizationBrandingPayload> {
  const { data, error } = await service
    .from("organizations")
    .select("name,logo_path")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    throw new OrganizationBrandingError("Firma marka bilgileri alınamadı.", 404);
  }

  return {
    organizationName: data.name,
    logoUrl: await createOrganizationLogoUrl(service, organizationId, data.logo_path)
  };
}

export async function uploadOrganizationLogo(
  service: ServiceClient,
  organizationId: string,
  file: File
): Promise<OrganizationBrandingPayload> {
  if (file.size <= 0 || file.size > ORGANIZATION_LOGO_MAX_BYTES) {
    throw new OrganizationBrandingError("Logo dosyası 2 MB veya daha küçük olmalıdır.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectImage(buffer);

  if (!detected || detected.mimeType !== file.type) {
    throw new OrganizationBrandingError("Yalnızca gerçek PNG, JPG veya WebP görselleri yüklenebilir.");
  }

  const { data: organization, error: organizationError } = await service
    .from("organizations")
    .select("name,logo_path,deletion_started_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    throw new OrganizationBrandingError("Firma bulunamadı.", 404);
  }

  const nextPath = `${organizationId}/${randomUUID()}.${detected.extension}`;
  if (organization.deletion_started_at) {
    throw new OrganizationBrandingError("Kalıcı silme işlemi başlayan firmanın logosu değiştirilemez.", 409);
  }
  const uploadResult = await service.storage.from(ORGANIZATION_LOGO_BUCKET).upload(nextPath, buffer, {
    cacheControl: "3600",
    contentType: detected.mimeType,
    upsert: false
  });

  if (uploadResult.error) {
    throw new OrganizationBrandingError("Logo yüklenemedi. Lütfen tekrar deneyin.", 500);
  }

  const updateResult = await service
    .from("organizations")
    .update({ logo_path: nextPath })
    .eq("id", organizationId)
    .is("deletion_started_at", null)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    await service.storage.from(ORGANIZATION_LOGO_BUCKET).remove([nextPath]);
    throw new OrganizationBrandingError("Logo firma hesabına kaydedilemedi.", 500);
  }

  if (
    organization.logo_path &&
    organization.logo_path !== nextPath &&
    belongsToOrganization(organization.logo_path, organizationId)
  ) {
    await service.storage.from(ORGANIZATION_LOGO_BUCKET).remove([organization.logo_path]);
  }

  return {
    organizationName: organization.name,
    logoUrl: await createOrganizationLogoUrl(service, organizationId, nextPath)
  };
}

export async function removeOrganizationLogo(
  service: ServiceClient,
  organizationId: string
): Promise<OrganizationBrandingPayload> {
  const { data: organization, error: organizationError } = await service
    .from("organizations")
    .select("name,logo_path,deletion_started_at")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    throw new OrganizationBrandingError("Firma bulunamadı.", 404);
  }
  if (organization.deletion_started_at) {
    throw new OrganizationBrandingError("Kalıcı silme işlemi başlayan firmanın logosu değiştirilemez.", 409);
  }

  const updateResult = await service
    .from("organizations")
    .update({ logo_path: null })
    .eq("id", organizationId)
    .is("deletion_started_at", null)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    throw new OrganizationBrandingError("Logo kaldırılamadı.", 500);
  }

  if (organization.logo_path && belongsToOrganization(organization.logo_path, organizationId)) {
    await service.storage.from(ORGANIZATION_LOGO_BUCKET).remove([organization.logo_path]);
  }

  return {
    organizationName: organization.name,
    logoUrl: null
  };
}
