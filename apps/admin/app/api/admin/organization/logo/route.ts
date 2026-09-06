import { NextResponse } from "next/server";
import {
  ORGANIZATION_LOGO_MAX_BYTES,
  OrganizationBrandingError,
  removeOrganizationLogo,
  uploadOrganizationLogo
} from "../../../../../lib/organization-branding";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { requireAdmin } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const brandingError = error instanceof OrganizationBrandingError ? error : null;
  return NextResponse.json(
    { message: brandingError?.message ?? "Logo işlemi tamamlanamadı." },
    { status: brandingError?.status ?? 500 }
  );
}

export async function POST(request: Request) {
  const rateLimited = enforceRateLimit(request, "admin-organization-logo-upload");
  if (rateLimited) return rateLimited;

  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  const multipartOverheadAllowance = 64 * 1024;
  if (Number.isFinite(contentLength) && contentLength > ORGANIZATION_LOGO_MAX_BYTES + multipartOverheadAllowance) {
    return NextResponse.json({ message: "Logo dosyası 2 MB veya daha küçük olmalıdır." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const logo = formData.get("logo");
    if (!(logo instanceof File)) {
      return NextResponse.json({ message: "Yüklenecek logo dosyasını seçin." }, { status: 400 });
    }

    const branding = await uploadOrganizationLogo(auth.service, auth.organizationId, logo);
    await auth.service.from("audit_logs").insert({
      organization_id: auth.organizationId,
      actor_id: auth.userId,
      action: "organization_logo_updated",
      entity_table: "organizations",
      entity_id: auth.organizationId,
      after_data: { has_logo: true }
    });

    return NextResponse.json(branding);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const rateLimited = enforceRateLimit(request, "admin-organization-logo-delete");
  if (rateLimited) return rateLimited;

  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  try {
    const branding = await removeOrganizationLogo(auth.service, auth.organizationId);
    await auth.service.from("audit_logs").insert({
      organization_id: auth.organizationId,
      actor_id: auth.userId,
      action: "organization_logo_removed",
      entity_table: "organizations",
      entity_id: auth.organizationId,
      after_data: { has_logo: false }
    });

    return NextResponse.json(branding);
  } catch (error) {
    return errorResponse(error);
  }
}
