import { NextResponse } from "next/server";
import { createReportsWorkbook, type ExportReportRow } from "@operations/shared";
import { enforceRateLimit } from "../../../../../lib/rate-limit";
import { requireAdmin } from "../../../../../lib/server/guards";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "admin-report-export");
  if (rateLimited) return rateLimited;

  const admin = await requireAdmin(request, "read");
  if (!admin.ok) {
    return NextResponse.json({ message: admin.message }, { status: admin.status });
  }

  const url = new URL(request.url);
  const ids = url.searchParams.getAll("id");

  let query = admin.service
    .from("reports")
    .select("*, report_personnel(name_snapshot), report_photos(category,caption,storage_path)")
    .eq("organization_id", admin.organizationId)
    .order("created_at", { ascending: false });

  if (ids.length > 0) {
    query = query.in("id", ids);
  } else {
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const reportNo = url.searchParams.get("reportNo");
    const companyId = url.searchParams.get("companyId");
    const personnelId = url.searchParams.get("personnelId");
    const beltId = url.searchParams.get("beltId");
    const status = url.searchParams.get("status");

    if (start) query = query.gte("report_date", start);
    if (end) query = query.lte("report_date", end);
    if (reportNo) query = query.ilike("report_number", `%${reportNo}%`);
    if (companyId) query = query.eq("company_id", companyId);
    if (personnelId) query = query.eq("created_by_user_id", personnelId);
    if (beltId) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(beltId)) {
        return NextResponse.json({ message: "Bant filtresi geçersiz." }, { status: 400 });
      }
      query = query.or(`belt_id.eq.${beltId},work_items.cs.${JSON.stringify([{ belt_id: beltId }])}`);
    }
    if (status) query = query.eq("status", status);
  }

  const { data, error } = await query.limit(5000);
  if (error) {
    return NextResponse.json({ message: "Raporlar alınamadı." }, { status: 500 });
  }

  const workbook = await createReportsWorkbook((data ?? []) as ExportReportRow[]);
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `Operasyon_Raporlari_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`
    }
  });
}
