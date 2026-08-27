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

export type PdfReportPhoto = {
  category: string | null;
  caption: string | null;
  storage_path: string | null;
  created_at: string | null;
  dataUrl?: string | null;
  error?: string | null;
};

export type PdfReportRow = Record<string, unknown> & {
  id: string;
  report_number: string | null;
  report_date: string;
  created_by_user_id: string | null;
  created_by_name_snapshot: string | null;
  company_name_snapshot: string | null;
  report_personnel?: Array<{ name_snapshot: string | null }>;
};

export async function createReportPdfBuffer(report: PdfReportRow, photos: PdfReportPhoto[]) {
  initPdfMake();
  const document = createReportDocument(report, photos);
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

function createReportDocument(report: PdfReportRow, photos: PdfReportPhoto[]): TDocumentDefinitions {
  const content: Content[] = [
    header(report),
    divider(),
    ...section("Genel Bilgiler", [
      ["Rapor No", report.report_number ?? "Taslak"],
      ["Tarih", dateOnly(report.report_date)],
      ["Firma", text(report.company_name_snapshot)],
      ["Yetkili Kişi", text(report.company_contact_name)],
      ["Yetkili Telefon", text(report.company_contact_phone)],
      ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"],
      ["Formu Dolduran", text(report.created_by_name_snapshot)]
    ]),
    ...section("Hat, Araç ve Zaman", [
      ["Hat Adı", text(report.line_name)],
      ["Bant Kodu", reportBeltCodesText(report)],
      ["İş Kalemleri", reportWorkItemsText(report)],
      ["Makina Marka Model", text(report.machine_brand_model)],
      ["Araç Plakası", text(report.vehicle_plate)],
      ["Araç Alış KM", text(report.vehicle_start_km)],
      ["Araç Teslim KM", text(report.vehicle_end_km)],
      ["Kullanılan Makine ve Ekipman", text(report.used_equipment)],
      ["Atölyeden Çıkış", dateTime(report.workshop_departure_at)],
      ["Müşteriye Varış", dateTime(report.customer_arrival_at)],
      ["Müşteriden Çıkış", dateTime(report.customer_departure_at)],
      ["Fabrikaya Dönüş", dateTime(report.factory_return_at)]
    ]),
    { text: "Ürün Kalemleri", style: "sectionTitle", margin: [0, 12, 0, 6] },
    workItemsTable(report),
    ...section("Yapılan İşlem ve Teknik Bilgiler", [
      ["Ürün Türü", arrayText(report.product_types)],
      ["Yapılan İşlem", arrayText(report.process_actions)],
      ["Kenar Kesim", text(report.edge_cut_method)],
      ["Açıklama", text(report.process_description)],
      ["Değiştirme Sebebi", arrayText(report.replacement_reasons)],
      ["Test Parçası", text(report.has_test_piece)],
      ["Test Durumu", text(report.test_status)],
      ["Gözlemci", fallbackText(text(report.observer_name_snapshot), text(report.observer_external_name))],
      ["Pres Başlama", text(report.press_start_time)],
      ["Pres Bitiş", text(report.press_end_time)],
      ["Enerji Kesintisi", text(report.power_outage)],
      ["Basınç Düşmesi", text(report.pressure_drop)],
      ["Isı Dengesi", text(report.heat_balance_ok)],
      ["Faturalandırma", text(report.billing_status)],
      ["Teknik Detaylar", text(report.technical_details)]
    ]),
    ...section("Gerdirme", [
      ["Gerdirme Yapıldı mı?", text(report.tensioning_done)],
      ["Müşteri Sonra Yapacak", boolText(report.customer_will_tension)],
      ["Müşteri Otomatik Sistemde Yaptı", boolText(report.customer_tensioned_auto)],
      ["Uygulanan Basınç", [text(report.pressure_value), text(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
      ["Ön Gerdirme %", text(report.pre_tension_percent)],
      ["Hat Çalışır Teslim Edildi", boolText(report.line_delivered_running)]
    ]),
    { text: "Fotoğraflar", style: "sectionTitle", margin: [0, 12, 0, 6] },
    ...photoSection(photos),
    { text: "İmza Alanları", style: "sectionTitle", margin: [0, 16, 0, 8] },
    {
      columns: [
        signatureBox("TUNCA Personel"),
        signatureBox("Müşteri Yetkilisi")
      ],
      columnGap: 16
    }
  ];

  return {
    pageSize: "A4",
    pageMargins: [32, 34, 32, 42],
    info: {
      title: report.report_number ?? "TUNCA Raporu",
      author: "TUNCA",
      subject: "Montaj ve Tamir Raporu"
    },
    defaultStyle: {
      color: "#25282c",
      font: "Roboto",
      fontSize: 8.8
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: `Oluşturma: ${dateTime(new Date().toISOString())}`, color: "#66707a" },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#66707a" }
      ],
      margin: [32, 12, 32, 0],
      fontSize: 7.5
    }),
    content,
    styles
  };
}

const styles: StyleDictionary = {
  title: {
    bold: true,
    color: "#25292f",
    fontSize: 18
  },
  subtitle: {
    color: "#66707a",
    fontSize: 9
  },
  sectionTitle: {
    bold: true,
    color: "#8e2526",
    fontSize: 11
  },
  tableLabel: {
    bold: true,
    color: "#4b535c",
    fontSize: 8
  },
  tableValue: {
    color: "#25282c",
    fontSize: 8.5
  },
  muted: {
    color: "#66707a",
    fontSize: 8
  }
};

function header(report: PdfReportRow): Content {
  const logo = logoDataUrl();

  return {
    columns: [
      logo ? { image: logo, width: 136 } : { text: "TUNCA", style: "title" },
      {
        stack: [
          { text: "Montaj ve Tamir Raporu", style: "title", alignment: "right" },
          { text: report.report_number ?? "Taslak Rapor", style: "subtitle", alignment: "right" },
          { text: dateOnly(report.report_date), style: "subtitle", alignment: "right" }
        ]
      }
    ],
    columnGap: 18,
    margin: [0, 0, 0, 8]
  };
}

function divider(): Content {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 531, y2: 0, lineColor: "#d8dde2", lineWidth: 1 }],
    margin: [0, 0, 0, 8]
  };
}

function section(title: string, rows: Array<[string, string]>): Content[] {
  return [
    { text: title, style: "sectionTitle", margin: [0, 10, 0, 5] },
    infoTable(rows)
  ];
}

function infoTable(rows: Array<[string, string]>): Content {
  return {
    table: {
      widths: [136, "*"],
      body: rows.map(([label, value]) => [
        { text: label, style: "tableLabel" },
        { text: value || "-", style: "tableValue" }
      ])
    },
    layout: "lightHorizontalLines"
  };
}

function workItemsTable(report: PdfReportRow): Content {
  const items = compactWorkItems(
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

  if (items.length === 0) {
    return { text: "Ürün kalemi girilmemiş.", style: "muted" };
  }

  return {
    table: {
      headerRows: 1,
      widths: ["*", 78, "*", 48, 58, 45],
      body: [
        ["Hat", "Bant Kodu", "Bant Adı", "En", "Boy", "Miktar"].map((label) => ({ text: label, style: "tableLabel" })),
        ...items.map((item) => [
          text(item.line_name),
          text(item.belt_code),
          text(item.belt_name),
          text(item.product_width),
          text(item.product_length),
          text(item.product_quantity)
        ])
      ]
    },
    layout: "lightHorizontalLines"
  };
}

function photoSection(photos: PdfReportPhoto[]): Content[] {
  if (photos.length === 0) {
    return [{ text: "Fotoğraf eklenmemiş.", style: "muted" }];
  }

  const rows: Content[] = [];
  for (let index = 0; index < photos.length; index += 2) {
    const pair = photos.slice(index, index + 2);
    rows.push({
      columns: [
        ...pair.map((photo, pairIndex) => photoCard(photo, index + pairIndex)),
        ...(pair.length === 1 ? [{ text: "", width: "*" } as Column] : [])
      ],
      columnGap: 12,
      margin: [0, 0, 0, 10]
    });
  }
  return rows;
}

function photoCard(photo: PdfReportPhoto, index: number): Column {
  const caption = photo.caption || `Fotoğraf ${index + 1}`;
  const meta = [photo.category, dateTime(photo.created_at)].filter((value) => value && value !== "-").join(" · ");

  return {
    width: "*",
    stack: [
      photo.dataUrl
        ? { image: photo.dataUrl, fit: [245, 150], alignment: "center", margin: [0, 0, 0, 5] }
        : { text: photo.error || "Fotoğraf PDF içine eklenemedi.", style: "muted", margin: [0, 18, 0, 18] },
      { text: caption, bold: true, fontSize: 8.5 },
      { text: meta || "Rapor fotoğrafı", style: "muted" }
    ],
    margin: [0, 0, 0, 5]
  };
}

function signatureBox(title: string): Column {
  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: title, bold: true, color: "#25292f", margin: [0, 0, 0, 22] },
          { text: "Ad Soyad", style: "muted", margin: [0, 0, 0, 16] },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 220, y2: 0, lineColor: "#66707a", lineWidth: 0.8 }] },
          { text: "İmza", style: "muted", margin: [0, 6, 0, 0] }
        ],
        margin: [10, 10, 10, 10]
      }]]
    },
    layout: {
      hLineColor: () => "#d8dde2",
      vLineColor: () => "#d8dde2"
    }
  };
}

function logoDataUrl() {
  if (!existsSync(logoPath)) return null;
  return `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
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

function reportWorkItemsText(report: Record<string, unknown>) {
  const items = compactWorkItems(
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

  return items
    .map((item) => {
      const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
      return [item.line_name, beltLabel].filter(Boolean).join(" / ");
    })
    .filter(Boolean)
    .join(" • ") || "-";
}

function reportBeltCodesText(report: Record<string, unknown>) {
  const items = compactWorkItems(
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
  const codes = items.map((item) => item.belt_code).filter(Boolean);
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
