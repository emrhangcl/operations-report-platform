import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { Column, Content, StyleDictionary, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ReportWorkItem } from "@operations/types";
import { customerSignatureSchema, CUSTOMER_SIGNATURE_CONSENT, type CustomerSignature } from "@operations/validation";

const require = createRequire(import.meta.url);
const pdfMake = require("pdfmake") as typeof import("pdfmake");
const runtimeRoot = process.cwd();
const appRoot = existsSync(join(runtimeRoot, "apps", "admin"))
  ? join(runtimeRoot, "apps", "admin")
  : runtimeRoot;
const pdfMakeRoot = [
  join(runtimeRoot, "node_modules", "pdfmake"),
  join(appRoot, "node_modules", "pdfmake")
].find((candidate) => existsSync(candidate)) ?? join(runtimeRoot, "node_modules", "pdfmake");
const fontRoot = join(pdfMakeRoot, "fonts", "Roboto");
let pdfMakeReady = false;
let defaultLogoDataUrl: string | null | undefined;

export type PdfReportRow = Record<string, unknown> & {
  id: string;
  report_number: string | null;
  report_date: string;
  created_by_user_id: string | null;
  created_by_name_snapshot: string | null;
  company_name_snapshot: string | null;
  customer_signed_at?: string | null;
  customer_signature?: unknown;
  report_personnel?: Array<{ name_snapshot: string | null }>;
};

export interface ReportPdfOptions {
  logoDataUrl?: string | null;
}

export async function createReportPdfBuffer(report: PdfReportRow, options: ReportPdfOptions = {}) {
  initPdfMake();
  const document = createReportDocument(report, options);
  return pdfMake.createPdf(document).getBuffer();
}

export function reportPdfFilename(report: Pick<PdfReportRow, "report_number" | "id">) {
  const base = report.report_number || `Rapor-${report.id.slice(0, 8)}`;
  return `${base.replace(/[^A-Za-z0-9_-]/g, "-")}.pdf`;
}

export function getDefaultReportPdfLogoDataUrl() {
  if (defaultLogoDataUrl !== undefined) return defaultLogoDataUrl;

  const logoPath = [
    join(appRoot, "public", "operations-app-icon.png"),
    join(runtimeRoot, "public", "operations-app-icon.png")
  ].find((candidate) => existsSync(candidate));

  defaultLogoDataUrl = logoPath
    ? `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`
    : null;

  return defaultLogoDataUrl;
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

function createReportDocument(report: PdfReportRow, options: ReportPdfOptions): TDocumentDefinitions {
  const workItems = reportWorkItems(report);
  const reportPersonnel = personnelText(report);
  const content: Content[] = [
    header(report, options.logoDataUrl),
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
          ["Dönüş Araç KM", text(report.vehicle_end_km)],
          ["Atölyeden Çıkış", dateTime(report.workshop_departure_at)],
          ["Müşteriye Varış", dateTime(report.customer_arrival_at)],
          ["Müşteriden Çıkış", dateTime(report.customer_departure_at)],
          ["Eve / Ofise Giriş", dateTime(report.factory_return_at)]
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
    {
      unbreakable: true,
      stack: [
        { text: "Teslim ve Firma Yetkilisi Onayı", style: "sectionTitle", margin: [0, 9, 0, 4] },
        { columns: [
          personnelRecordBox(reportPersonnel),
          customerSignatureBox(report.customer_signature, report.customer_signed_at)
        ], columnGap: 14 }
      ]
    } as Content
  ];

  return {
    pageOrientation: "landscape",
    pageSize: "A4",
    pageMargins: [24, 22, 24, 24],
    info: {
      title: report.report_number ?? "Operasyon Raporu",
      author: "Operasyon Portalı",
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
        { text: report.report_number ?? "Taslak", alignment: "center", color: "#66707a" },
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
    color: "#0b5f59",
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
  },
  brandCaption: {
    color: "#66707a",
    fontSize: 6.9
  }
};

function header(report: PdfReportRow, logoDataUrl?: string | null): Content {
  return {
    columns: [
      {
        stack: [
          ...(logoDataUrl
            ? [
                {
                  image: logoDataUrl,
                  fit: [120, 34],
                  margin: [0, 0, 0, 2]
                } as Content
              ]
            : [{ text: "OPERASYON PORTALI", style: "title" } as Content]),
          { text: "Saha ve rapor yönetimi", style: "brandCaption" }
        ]
      },
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

function personnelRecordBox(name?: string): Column {
  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: "İşlemi Yapan Personel", bold: true, color: "#25292f", fontSize: 7.5, margin: [0, 0, 0, 5] },
          { text: name && name !== "-" ? clip(name, 105) : "Personel kaydı bulunmuyor", style: name && name !== "-" ? "tableValue" : "muted", margin: [0, 0, 0, 7] },
          { text: "Personel bilgisi sistem kaydından alınmıştır; bu alanda personel el imzası bulunmaz.", style: "muted" }
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

function customerSignatureBox(value: unknown, signedAt: unknown): Column {
  const parsed = customerSignatureSchema.safeParse(value);

  if (!parsed.success) {
    return {
      width: "*",
      table: {
        widths: ["*"],
        body: [[{
          stack: [
            { text: "Müşteri Yetkilisi", bold: true, color: "#25292f", fontSize: 7.5, margin: [0, 0, 0, 5] },
            { text: "Eski kayıt / imzasız: dijital müşteri imzası yok.", style: "muted", margin: [0, 0, 0, 4] },
            { text: "Firma yetkilisi imzası mobil tamamlanma akışından alındığında burada görünür.", style: "muted" }
          ],
          margin: [8, 7, 8, 7]
        }]]
      },
      layout: signatureBoxLayout()
    };
  }

  const signature = parsed.data;

  return {
    width: "*",
    table: {
      widths: ["*"],
      body: [[{
        stack: [
          { text: "Müşteri Yetkilisi", bold: true, color: "#25292f", fontSize: 7.5, margin: [0, 0, 0, 4] },
          { canvas: signatureCanvas(signature), margin: [0, 0, 0, 5] } as Content,
          {
            table: {
              widths: [66, "*"],
              body: [
                [{ text: "Ad Soyad", style: "tableLabel" }, { text: clip(signature.signer_name, 90), style: "tableValue" }],
                [{ text: "Unvan", style: "tableLabel" }, { text: clip(signature.signer_title, 90), style: "tableValue" }],
                [{ text: "İmza zamanı", style: "tableLabel" }, { text: dateTime(signedAt), style: "tableValue" }],
                [{ text: "Onay metni", style: "tableLabel" }, { text: CUSTOMER_SIGNATURE_CONSENT, style: "muted" }],
                [{ text: "Dönüş kapanışı", style: "tableLabel" }, { text: "Eve/ofise giriş zamanı ve dönüş araç kilometresi teslim onayından sonra personel tarafından kaydedilir.", style: "muted" }]
              ]
            },
            layout: {
              hLineColor: () => "#eef1f3",
              hLineWidth: () => 0.35,
              paddingBottom: () => 1.1,
              paddingLeft: () => 2,
              paddingRight: () => 2,
              paddingTop: () => 1.1,
              vLineWidth: () => 0
            }
          } as Content
        ],
        margin: [8, 7, 8, 7]
      }]]
    },
    layout: signatureBoxLayout()
  };
}

function signatureBoxLayout() {
  return {
    hLineColor: () => "#d8dde2",
    hLineWidth: () => 0.6,
    vLineColor: () => "#d8dde2",
    vLineWidth: () => 0.6
  };
}

function signatureCanvas(signature: CustomerSignature) {
  const scale = 0.4;
  const padding = 4;

  return [
    { type: "rect", x: 0, y: 0, w: 600 * scale + padding * 2, h: 240 * scale + padding * 2, lineColor: "#d8dde2", lineWidth: 0.6, color: "#fbfcfd" },
    ...signature.strokes.map((stroke) => ({
      type: "polyline",
      points: stroke.map(([x, y]) => ({ x: x * scale + padding, y: y * scale + padding })),
      lineColor: "#25282c",
      lineWidth: 1
    }))
  ];
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
  return report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ")
    || text(report.created_by_name_snapshot);
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
