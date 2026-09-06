import { NextResponse } from "next/server";
import { createOrganizationLogoUrl } from "../../../../lib/organization-branding";
import { requireActiveProfile } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireActiveProfile(request, "read");
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const logoUrl = await createOrganizationLogoUrl(
    auth.service,
    auth.organizationId,
    auth.organizationLogoPath
  );

  return NextResponse.json({
    accessMode: auth.accessMode,
    subscriptionStatus: auth.subscriptionStatus,
    role: auth.role,
    organizationName: auth.organizationName,
    logoUrl
  }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}
