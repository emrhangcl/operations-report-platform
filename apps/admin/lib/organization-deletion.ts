import "server-only";
import { z } from "zod";
import type { ServiceClient } from "./server/service-client";

const manifestSchema = z.object({
  organization_id: z.string().uuid(),
  user_ids: z.array(z.string().uuid()),
  storage_objects: z.array(z.object({ bucket: z.enum(["report-photos", "organization-logos"]), name: z.string().min(1) }))
});

export class OrganizationDeletionError extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}

export function organizationMutationError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return new OrganizationDeletionError("Platform yöneticisi yetkisi gerekli.", 403);
  if (error.code === "P0002") return new OrganizationDeletionError("Firma bulunamadı.", 404);
  if (error.message === "invalid_deletion_confirmation") return new OrganizationDeletionError("Silme onayı için firma kodunu aynen yazın.", 400);
  if (error.message === "protected_organization_accounts") return new OrganizationDeletionError("Bu firma platform yöneticisi, kendi hesabınız veya başka firmaya bağlı hesaplar içeriyor. Bu hesaplar silinemez.", 409);
  if (error.message === "out_of_scope_organization_files") return new OrganizationDeletionError("Başka kapsama ait dosya bağlantıları bulundu. Silme işlemi başlatılmadı.", 409);
  if (error.message === "organization_deletion_pending") return new OrganizationDeletionError("Bu firmada kalıcı silme işlemi başlamış. Yeniden açılamaz; silme işlemini tamamlayın.", 409);
  return new OrganizationDeletionError("Silme işlemi tamamlanamadı. Firma ayrıntısından tekrar deneyerek işlemi tamamlayın.");
}

export async function deletePlatformOrganization(service: ServiceClient, organizationId: string, confirmationSlug: string, actorId: string) {
  const prepared = await service.rpc("platform_prepare_organization_deletion", {
    target_organization_id: organizationId, confirmation_slug: confirmationSlug, actor_user_id: actorId
  });
  if (prepared.error) throw organizationMutationError(prepared.error);
  const parsed = manifestSchema.safeParse(prepared.data);
  if (!parsed.success || parsed.data.organization_id !== organizationId || parsed.data.user_ids.includes(actorId)) {
    throw new OrganizationDeletionError("Silme kapsamı doğrulanamadı.");
  }
  const manifest = parsed.data;
  if (manifest.storage_objects.some(({ name }) => !name.startsWith(`${organizationId}/`) || name.includes("..") || name.includes("\\"))) {
    throw new OrganizationDeletionError("Silme dosyalarının firma kapsamı doğrulanamadı.");
  }
  const purged = await service.rpc("platform_purge_organization_data", { target_organization_id: organizationId, actor_user_id: actorId });
  if (purged.error) throw organizationMutationError(purged.error);
  for (const bucket of ["report-photos", "organization-logos"] as const) {
    const paths = manifest.storage_objects.filter((object) => object.bucket === bucket).map((object) => object.name);
    for (let offset = 0; offset < paths.length; offset += 100) {
      const cleanup = await service.storage.from(bucket).remove(paths.slice(offset, offset + 100));
      if (cleanup.error) throw new OrganizationDeletionError("Dosyalar temizlenemedi. Silme işlemini tekrar deneyin.");
    }
  }
  for (const userId of manifest.user_ids) {
    const deleted = await service.auth.admin.deleteUser(userId);
    if (deleted.error && deleted.error.code !== "user_not_found") {
      throw new OrganizationDeletionError("Firma giriş hesapları tamamen silinemedi. Silme işlemini tekrar deneyin.");
    }
  }
  const finished = await service.rpc("platform_finish_organization_deletion", { target_organization_id: organizationId, actor_user_id: actorId });
  if (finished.error) throw organizationMutationError(finished.error);
  return { deletedAccounts: manifest.user_ids.length };
}
