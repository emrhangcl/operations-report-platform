import { NextResponse } from "next/server";
import {
  createReportPdfBuffer,
  getDefaultReportPdfLogoDataUrl,
  reportPdfFilename,
  type PdfReportRow
} from "../../../../../lib/report-pdf";
import { createOrganizationLogoPdfDataUrl } from "../../../../../lib/organization-branding";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { requireActiveProfile } from "../../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = await enforceRateLimit(request, "report-pdf");
  if (rateLimited) return rateLimited;

  const auth = await requireActiveProfile(request, "read");
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const { id } = await params;
  const { data, error } = await auth.service
    .from("reports")
    .select("*, report_personnel(name_snapshot)")
    .eq("id", id)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "Rapor bulunamadı." }, { status: 404 });
  }

  const report = data as PdfReportRow;
  if (auth.role !== "ADMIN" && report.created_by_user_id !== auth.userId) {
    return NextResponse.json({ message: "Bu rapora erişim yetkiniz yok." }, { status: 403 });
  }

  const organizationLogoDataUrl = await createOrganizationLogoPdfDataUrl(
    auth.service,
    auth.organizationId,
    auth.organizationLogoPath
  );
  const buffer = await createReportPdfBuffer(report, {
    logoDataUrl: organizationLogoDataUrl ?? getDefaultReportPdfLogoDataUrl()
  });
  const filename = reportPdfFilename(report);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf"
    }
  });
}
