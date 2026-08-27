import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Column, Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportWorkItem } from "@tunca/types";

const require = createRequire(import.meta.url);
const pdfMake = require("pdfmake") as typeof import("pdfmake");
const pdfMakeRoot = join(process.cwd(), "node_modules", "pdfmake");
const fontRoot = join(pdfMakeRoot, "fonts", "Roboto");
const logoPath = resolve(process.cwd(), "public", "tunca-logo.png");

let pdfMakeReady = false;

export type PdfReportRow = Record<string, unknown> & {
  id: string;
  report_number: string | null;
  report_date: string;
  created_by_user_id: string | null;
  created_by_name_snapshot: string | null;
  company_name_snapshot: string | null;
  report_personnel?: Array<{ name_snapshot: string | null }>;
};

export async function createReportPdfBuffer(report: PdfReportRow) {
  initPdfMake();
  const document = createReportDocument(report);
  return pdfMake.createPdf(document).getBuffer();
}

export function reportPdfFilename(report: Pick<PdfReportRow, "report_number" | "id">) {
  const base = report.report_number || `TUNCA-Rapor-${report.id.slice(0, 8)}`;
  return `${base.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
}

function initPdfMake() {
  if (pdfMakeReady) return;

  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.setLocalAccessPolicy((filePath) => resolve(filePath).startsWith(resolve(fontRoot)));
  pdfMake.addFonts({
    Roboto: {
      normal: join(fontRoot, "Roboto-Regular.ttf"),
      bold: join(fontRoot, "Roboto-Medium.ttf"),
      italics: join(fontRoot, "Roboto-Italic.ttf"),
      bolditalics: join(fontRoot, "Roboto-MediumItalic.ttf")
    }
  });

  pdfMakeReady = true;
}

function createReportDocument(report: PdfReportRow): TDocumentDefinitions {
  const workItems = reportWorkItems(report);
  const content: Content[] = [
    header(report),
    divider(),
    {
      columns: [
        compactSection("Genel Bilgiler", [
          ["Rapor No", report.report_number ?? "Taslak"],
          ["Tarih", dateOnly(report.report_date)],
          ["Firma", text(report.company_name_snapshot)],
          ["Yetkili", text(report.company_contact_name)],
          ["Telefon", text(report.company_contact_phone)],
          ["Giden Personel", clip(personnelText(report), 95)],
          ["Formu Dolduran", text(report.created_by_name_snapshot)]
        ]),
        compactSection("Araç ve Zaman", [
          ["Araç Plakası", text(report.vehicle_plate)],
          ["Araç Alış KM", text(report.vehicle_start_km)],
          ["Araç Teslim KM", text(report.vehicle_end_km)],
          ["Atölyeden Çıkış", dateTime(report.workshop_departure_at)],
          ["Müşteriye Varış", dateTime(report.customer_arrival_at)],
          ["Müşteriden Çıkış", dateTime(report.customer_departure_at)],
          ["Fabrikaya Dönüş", dateTime(report.factory_return_at)]
        ])
      ],
      columnGap: 12
    },
    {
      columns: [
        compactSection("Hat ve Ekipman", [
          ["Hat", text(report.line_name)],
          ["Bant Kodu", reportBeltCodesText(report)],
          ["İş Kalemleri", clip(reportWorkItemsText(report), 120)],
          ["Makina Marka Model", text(report.machine_brand_model)],
          ["Makine / Ekipman", clip(text(report.used_equipment), 120)]
        ]),
        compactSection("İşlem ve Teknik", [
          ["Ürün Türü", clip(arrayText(report.product_types), 95)],
          ["Yapılan İşlem", clip(arrayText(report.process_actions), 120)],
          ["Kenar Kesim", text(report.edge_cut_method)],
          ["Değiştirme Sebebi", clip(arrayText(report.replacement_reasons), 110)],
          ["Açıklama", clip(text(report.process_description), 140)]
        ])
      ],
      columnGap: 12,
      margin: [0, 7, 0, 0]
    },
    { text: "Ürün Kalemleri", style: "sectionTitle", margin: [0, 8, 0, 3] },
    workItemsTable(workItems),
    {
      columns: [
        compactSection("Pres ve Kontrol", [
          ["Test Parçası", text(report.has_test_piece)],
          ["Test Durumu", text(report.test_status)],
          ["Gözlemci", fallbackText(text(report.observer_name_snapshot), text(report.observer_external_name))],
          ["Pres Başlama", text(report.press_start_time)],
          ["Pres Bitiş", text(report.press_end_time)],
          ["Enerji / Basınç / Isı", [text(report.power_outage), text(report.pressure_drop), text(report.heat_balance_ok)].join(" / ")]
        ]),
        compactSection("Gerdirme ve Teslim", [
          ["Gerdirme", text(report.tensioning_done)],
          ["Müşteri Sonra Yapacak", boolText(report.customer_will_tension)],
          ["Otomatik Sistemde Yapıldı", boolText(report.customer_tensioned_auto)],
          ["Basınç", [text(report.pressure_value), text(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
          ["Ön Gerdirme %", text(report.pre_tension_percent)],
          ["Hat Çalışır Teslim", boolText(report.line_delivered_running)]
        ]),
        compactSection("Notlar", [
          ["Faturalandırma", clip(text(report.billing_status), 90)],
          ["Teknik Detay", clip(text(report.technical_details), 160)]
        ])
      ],
      columnGap: 10,
      margin: [0, 7, 0, 0]
    },
    { text: "İmza Alanları", style: "sectionTitle", margin: [0, 9, 0, 4] },
    {
      columns: [
        signatureBox("TUNCA Personel"),
        signatureBox("Müşteri Yetkilisi")
      ],
      columnGap: 14
    }
  ];

  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [24, 22, 24, 24],
    info: {
      title: report.report_number ?? "TUNCA Raporu",
      author: "TUNCA",
      subject: "Montaj ve Tamir Raporu"
    },
    defaultStyle: {
      color: "#25282c",
      font: "Roboto",
      fontSize: 7.2,
      lineHeight: 1.08
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Oluşturma: ${dateTime(new Date().toISOString())}`, color: "#66707a" },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#66707a" }
      ],
      fontSize: 6.3,
      margin: [24, 4, 24, 0]
    }),
    content,
    styles
  };
}

const styles: StyleDictionary = {
  title: {
    bold: true,
    color: "#25292f",
    fontSize: 15
  },
  subtitle: {
    color: "#66707a",
    fontSize: 7.4
  },
  sectionTitle: {
    bold: true,
    color: "#8e2526",
    fontSize: 8.7
  },
  tableLabel: {
    bold: true,
    color: "#4b535c",
    fontSize: 6.8
  },
  tableValue: {
    color: "#25282c",
    fontSize: 7.05
  },
  muted: {
    color: "#66707a",
    fontSize: 6.7
  }
};

function header(report: PdfReportRow): Content {
  const logo = logoDataUrl();

  return {
    columns: [
      logo ? { image: logo, width: 118 } : { text: "TUNCA", style: "title" },
      {
        stack: [
          { text: "Montaj ve Tamir Raporu", style: "title", alignment: "right" },
          { text: report.report_number ?? "Taslak Rapor", style: "subtitle", alignment: "right" },
          { text: dateOnly(report.report_date), style: "subtitle", alignment: "right" }
        ]
      }
    ],
    columnGap: 18,
    margin: [0, 0, 0, 5]
  };
}

function divider(): Content {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 794, y2: 0, lineColor: "#d8dde2", lineWidth: 0.8 }],
    margin: [0, 0, 0, 5]
  };
}

function compactSection(title: string, rows: Array<[string, string]>): Column {
  return {
    width: "*",
    stack: [
      { text: title, style: "sectionTitle", margin: [0, 0, 0, 2] },
      {
        table: {
          widths: [82, "*"],
          body: rows.map(([label, value]) => [
            { text: label, style: "tableLabel" },
            { text: value || "-", style: "tableValue" }
          ])
        },
        layout: {
          hLineColor: () => "#eef1f3",
          hLineWidth: () => 0.35,
          paddingBottom: () => 1.3,
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 1.3,
          vLineWidth: () => 0
        }
      }
    ]
  };
}

function workItemsTable(items: ReportWorkItem[]): Content {
  if (items.length === 0) {
    return { text: "Ürün kalemi girilmemiş.", style: "muted" };
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", 92, "*", 55, 60, 46],
      body: [
        ["Hat", "Bant Kodu", "Bant Adı", "En", "Boy", "Miktar"].map((label) => ({ text: label, style: "tableLabel" })),
        ...items.map((item) => [
          clip(text(item.line_name), 58),
          clip(text(item.belt_code), 28),
          clip(text(item.belt_name), 60),
          text(item.product_width),
          text(item.product_length),
          text(item.product_quantity)
        ])
      ]
    },
    layout: {
      fillColor: (rowIndex) => rowIndex === 0 ? "#f8f9fa" : null,
      hLineColor: () => "#d8dde2",
      hLineWidth: () => 0.45,
      paddingBottom: () => 1.6,
      paddingLeft: () => 3,
      paddingRight: () => 3,
      paddingTop: () => 1.6,
      vLineColor: () => "#eef1f3",
      vLineWidth: () => 0.35
    }
  };
}

function signatureBox(title: string): Column {
  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: title, bold: true, color: "#25292f", fontSize: 7.5, margin: [0, 0, 0, 16] },
          { text: "Ad Soyad", style: "muted", margin: [0, 0, 0, 11] },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 330, y2: 0, lineColor: "#66707a", lineWidth: 0.7 }] },
          { text: "İmza", style: "muted", margin: [0, 4, 0, 0] }
        ],
        margin: [8, 7, 8, 7]
      }]]
    },
    layout: {
      hLineColor: () => "#d8dde2",
      hLineWidth: () => 0.6,
      vLineColor: () => "#d8dde2",
      vLineWidth: () => 0.6
    }
  };
}

function logoDataUrl() {
  if (!existsSync(logoPath)) return null;
  return `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
}

function reportWorkItems(report: Record<string, unknown>) {
  return compactWorkItems(
    workItemsFromValue(
      report.work_items,
      textValue(report.line_name),
      textValue(report.belt_id),
      textValue(report.belt_code_snapshot),
      textValue(report.belt_name_snapshot),
      textValue(report.product_width),
      textValue(report.product_length),
      textValue(report.product_quantity)
    )
  );
}

function compactWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim(),
      product_width: item.product_width.trim(),
      product_length: item.product_length.trim(),
      product_quantity: item.product_quantity.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.product_width || item.product_length || item.product_quantity);
}

function workItemsFromValue(
  value: unknown,
  fallbackLineName: string,
  fallbackBeltId: string,
  fallbackBeltCode = "",
  fallbackBeltName = "",
  fallbackProductWidth = "",
  fallbackProductLength = "",
  fallbackProductQuantity = ""
): ReportWorkItem[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toRecord(item))
      .map((item) => ({
        line_name: textValue(item.line_name),
        belt_id: textValue(item.belt_id),
        belt_code: textValue(item.belt_code),
        belt_name: textValue(item.belt_name),
        product_width: textValue(item.product_width),
        product_length: textValue(item.product_length),
        product_quantity: textValue(item.product_quantity)
      }))
      .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.product_width || item.product_length || item.product_quantity);

    if (items.length > 0) return items;
  }

  return [{
    line_name: fallbackLineName,
    belt_id: fallbackBeltId,
    belt_code: fallbackBeltCode,
    belt_name: fallbackBeltName,
    product_width: fallbackProductWidth,
    product_length: fallbackProductLength,
    product_quantity: fallbackProductQuantity
  }];
}

function personnelText(report: PdfReportRow) {
  return report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-";
}

function reportWorkItemsText(report: Record<string, unknown>) {
  return reportWorkItems(report)
    .map((item) => {
      const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
      return [item.line_name, beltLabel].filter(Boolean).join(" / ");
    })
    .filter(Boolean)
    .join(" • ") || "-";
}

function reportBeltCodesText(report: Record<string, unknown>) {
  const codes = reportWorkItems(report).map((item) => item.belt_code).filter(Boolean);
  return codes.length > 0 ? Array.from(new Set(codes)).join(", ") : text(report.belt_code_snapshot);
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function clip(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function fallbackText(first: string, second: string) {
  return first !== "-" ? first : second;
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") || "-" : "-";
}

function boolText(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Evet" : "Hayır";
}

function dateOnly(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric"
  }).format(date);
}

function dateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Istanbul",
    year: "numeric"
  }).format(date).replace(",", "");
}
