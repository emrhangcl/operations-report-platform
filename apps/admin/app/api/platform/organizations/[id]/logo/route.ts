import { NextResponse } from "next/server";
import { z } from "zod";
import {
  OrganizationBrandingError,
  removeOrganizationLogo,
  uploadOrganizationLogo
} from "../../../../../../lib/organization-branding";
import { enforceRateLimit } from "../../../../../../lib/rate-limit";
import { requirePlatformAdmin } from "../../../../../../lib/server/guards";

export const runtime = "nodejs";

async function organizationId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return z.string().uuid().safeParse(id).success ? id : null;
}

function errorResponse(error: unknown) {
  const brandingError = error instanceof OrganizationBrandingError ? error : null;
  return NextResponse.json(
    { message: brandingError?.message ?? "Logo işlemi tamamlanamadı." },
    { status: brandingError?.status ?? 500 }
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = await enforceRateLimit(request, "platform-organization-logo-upload");
  if (rateLimited) return rateLimited;

  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const id = await organizationId(params);
  if (!id) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const logo = formData.get("logo");
    if (!(logo instanceof File)) {
      return NextResponse.json({ message: "Yüklenecek logo dosyasını seçin." }, { status: 400 });
    }

    const branding = await uploadOrganizationLogo(auth.service, id, logo);
    await auth.service.from("audit_logs").insert({
      organization_id: id,
      actor_id: auth.userId,
      action: "platform.organization_logo_updated",
      entity_table: "organizations",
      entity_id: id,
      after_data: { has_logo: true }
    });

    return NextResponse.json(branding);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = await enforceRateLimit(request, "platform-organization-logo-delete");
  if (rateLimited) return rateLimited;

  const auth = await requirePlatformAdmin(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const id = await organizationId(params);
  if (!id) {
    return NextResponse.json({ message: "Firma kimliği geçersiz." }, { status: 400 });
  }

  try {
    const branding = await removeOrganizationLogo(auth.service, id);
    await auth.service.from("audit_logs").insert({
      organization_id: id,
      actor_id: auth.userId,
      action: "platform.organization_logo_removed",
      entity_table: "organizations",
      entity_id: id,
      after_data: { has_logo: false }
    });

    return NextResponse.json(branding);
  } catch (error) {
    return errorResponse(error);
  }
}
