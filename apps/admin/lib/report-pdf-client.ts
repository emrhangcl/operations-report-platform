"use client";

import { scopeHeaders } from "./browser-client";

type ReportPdfMode = "download" | "share";
type ReportPdfScope = "admin" | "personnel";

export async function downloadOrShareReportPdf({
  mode,
  reportId,
  reportNumber,
  scope = "admin"
}: {
  mode: ReportPdfMode;
  reportId: string;
  reportNumber?: string | null;
  scope?: ReportPdfScope;
}) {
  const response = await fetch(`/api/reports/${reportId}/pdf`, {
    cache: "no-store",
    credentials: "same-origin",
    headers: scopeHeaders(scope)
  });

  if (response.status === 401) {
    return { ok: false as const, message: "PDF için oturum doğrulanamadı." };
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    return { ok: false as const, message: body?.message ?? "PDF üretilemedi." };
  }

  const blob = await response.blob();
  const filename = `${(reportNumber || `Rapor-${reportId.slice(0, 8)}`).replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;

  if (mode === "share" && "File" in window) {
    const file = new File([blob], filename, { type: "application/pdf" });
    const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

    if (canShare) {
      await navigator.share({
        files: [file],
        text: "Montaj ve saha operasyonu raporu",
        title: reportNumber ?? "Operasyon Raporu"
      });
      return { ok: true as const };
    }
  }

  downloadBlob(blob, filename);
  return { ok: true as const };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
