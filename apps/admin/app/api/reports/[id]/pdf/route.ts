import { NextResponse } from "next/server";
import {
  createReportPdfBuffer,
  reportPdfFilename,
  type PdfReportPhoto,
  type PdfReportRow
} from "../../../../../lib/report-pdf";
import { requireActiveProfile } from "../../../../../lib/supabase-server";

export const runtime = "nodejs";

type PhotoRow = {
  category: string | null;
  caption: string | null;
  storage_path: string | null;
  created_at: string | null;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveProfile(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await auth.service
    .from("reports")
    .select("*, report_personnel(name_snapshot), report_photos(category,caption,storage_path,created_at)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "Rapor bulunamadı." }, { status: 404 });
  }

  const report = data as PdfReportRow & { report_photos?: PhotoRow[] };
  if (auth.role !== "ADMIN" && report.created_by_user_id !== auth.userId) {
    return NextResponse.json({ message: "Bu rapora erişim yetkiniz yok." }, { status: 403 });
  }

  const photos = await Promise.all(
    (report.report_photos ?? []).map(async (photo): Promise<PdfReportPhoto> => {
      const storagePath = photo.storage_path;
      if (!storagePath) {
        return { ...photo, dataUrl: null, error: "Fotoğraf dosya yolu bulunamadı." };
      }

      const { data: blob, error: downloadError } = await auth.service
        .storage
        .from("report-photos")
        .download(storagePath);

      if (downloadError || !blob) {
        return { ...photo, dataUrl: null, error: "Fotoğraf indirilemedi." };
      }

      const contentType = blob.type || contentTypeFromPath(storagePath);
      if (contentType !== "image/jpeg" && contentType !== "image/png") {
        return { ...photo, dataUrl: null, error: `PDF için desteklenmeyen fotoğraf türü: ${contentType || "bilinmiyor"}` };
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      return {
        ...photo,
        dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`
      };
    })
  );

  const buffer = await createReportPdfBuffer(report, photos);
  const filename = reportPdfFilename(report);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf"
    }
  });
}

function contentTypeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
