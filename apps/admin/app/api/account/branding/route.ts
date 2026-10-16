import { NextResponse } from "next/server";
import { getOrganizationBranding, OrganizationBrandingError } from "../../../../lib/organization-branding";
import { enforceRateLimit } from "../../../../lib/rate-limit";
import { requireActiveProfile } from "../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "account-branding");
  if (rateLimited) return rateLimited;

  const auth = await requireActiveProfile(request, "read");
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  try {
    const branding = await getOrganizationBranding(auth.service, auth.organizationId);
    return NextResponse.json(branding, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    const brandingError = error instanceof OrganizationBrandingError ? error : null;
    return NextResponse.json(
      { message: brandingError?.message ?? "Firma marka bilgileri alınamadı." },
      { status: brandingError?.status ?? 500 }
    );
  }
}
