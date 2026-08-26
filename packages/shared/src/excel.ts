import ExcelJS from "exceljs";

export const reportExportColumns = [
  "TARİH",
  "RAP.NO",
  "FİRMA ADI",
  "GİDİŞ SAYISI",
  "GİDEN PERSONEL 1",
  "GİDEN PERSONEL 2",
  "DİĞER PERSONELLER",
  "YAP.İŞLEM",
  "ÜRÜN TİPİ",
  "BANDIN KODU",
  "ÖLÇÜ",
  "EN",
  "BOY",
  "ADET",
  "EK YERİ",
  "AÇIKLAMALAR",
  "MÜŞTERİDEKİ MAKİNA ADI",
  "FORMU DOLDURAN PERSONEL",
  "ATÖLYEDEN ÇIKIŞ",
  "MÜŞTERİYE VARIŞ",
  "MÜŞTERİDEN ÇIKIŞ",
  "FABRİKAYA DÖNÜŞ",
  "YETKİLİ KİŞİ",
  "YETKİLİ TELEFON",
  "HAT ADI",
  "MAKİNA MARKA MODEL",
  "KULLANILAN ARAÇ",
  "ARAÇ ALIŞ KM",
  "ARAÇ TESLİM KM",
  "KULLANILAN MAKİNE VE EKİPMANLAR",
  "ÜRÜN ITEM/COIL KODU",
  "MEKANİK BAĞLANTI",
  "PROFİL",
  "DEĞİŞTİRME SEBEBİ",
  "TEST PARÇASI",
  "TEST DURUMU",
  "PRES BAŞLAMA",
  "PRES BİTİŞ",
  "ENERJİ KESİNTİSİ",
  "BASINÇ DÜŞMESİ",
  "ISI DENGESİ",
  "FATURALANDIRMA DURUMU",
  "TEKNİK DETAYLAR",
  "GERDİRME BİLGİLERİ",
  "ÖN GERDİRME %",
  "UYGULANAN BASINÇ",
  "BLANKET BİLGİLENDİRME",
  "FOTOĞRAF SAYISI"
] as const;

export interface ExportReportRow {
  report_date: string | Date | null;
  report_number: string | null;
  company_name_snapshot: string | null;
  created_by_name_snapshot: string | null;
  workshop_departure_at: string | Date | null;
  customer_arrival_at: string | Date | null;
  customer_departure_at: string | Date | null;
  factory_return_at: string | Date | null;
  company_contact_name: string | null;
  company_contact_phone: string | null;
  line_name: string | null;
  machine_brand_model: string | null;
  customer_machine_name: string | null;
  vehicle_plate: string | null;
  vehicle_start_km: string | null;
  vehicle_end_km: string | null;
  used_equipment: string | null;
  product_item_coil_code: string | null;
  product_code: string | null;
  product_measure: string | null;
  product_width: string | null;
  product_length: string | null;
  product_quantity: string | null;
  belt_code_snapshot: string | null;
  product_types: string[] | null;
  process_actions: string[] | null;
  edge_cut_method: string | null;
  process_description: string | null;
  mechanical_connection: string | null;
  profile_material: string | null;
  replacement_reasons: string[] | null;
  replacement_reason_other: string | null;
  has_test_piece: string | null;
  test_status: string | null;
  press_start_time: string | null;
  press_end_time: string | null;
  power_outage: string | null;
  pressure_drop: string | null;
  heat_balance_ok: string | null;
  billing_status: string | null;
  technical_details: string | null;
  tensioning_done: string | null;
  customer_will_tension: boolean | null;
  customer_tensioned_auto: boolean | null;
  line_delivered_running: boolean | null;
  pre_tension_percent: string | null;
  pressure_value: string | null;
  pressure_unit: string | null;
  blanket_roughening_info_given: string | null;
  blanket_info_person_name: string | null;
  report_personnel?: Array<{ name_snapshot: string | null }>;
  report_photos?: Array<{
    category: string | null;
    caption: string | null;
    storage_path: string | null;
  }>;
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

function join(values: Array<string | null> | string[] | null | undefined) {
  return (values ?? []).filter(Boolean).join(", ");
}

function boolText(value: boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return value ? "Evet" : "Hayır";
}

export function mapReportToExcelRow(report: ExportReportRow) {
  const personnel = report.report_personnel?.map((item) => item.name_snapshot ?? "") ?? [];
  const tensioning = [
    report.tensioning_done ? `Gerdirme: ${report.tensioning_done}` : "",
    report.customer_will_tension ? "Müşteri sonra yapacak" : "",
    report.customer_tensioned_auto ? "Müşteri otomatik sistemde yaptı" : "",
    report.line_delivered_running ? "Hat çalışır teslim edildi" : ""
  ].filter(Boolean);

  return [
    toDate(report.report_date),
    report.report_number ?? "",
    report.company_name_snapshot ?? "",
    personnel.length,
    personnel[0] ?? "",
    personnel[1] ?? "",
    personnel.slice(2).join(", "),
    join(report.process_actions),
    join(report.product_types),
    report.belt_code_snapshot ?? "",
    report.product_measure ?? "",
    report.product_width ?? "",
    report.product_length ?? "",
    report.product_quantity ?? "",
    report.edge_cut_method ?? "",
    report.process_description ?? "",
    report.customer_machine_name ?? "",
    report.created_by_name_snapshot ?? "",
    toDate(report.workshop_departure_at),
    toDate(report.customer_arrival_at),
    toDate(report.customer_departure_at),
    toDate(report.factory_return_at),
    report.company_contact_name ?? "",
    report.company_contact_phone ?? "",
    report.line_name ?? "",
    report.machine_brand_model ?? "",
    report.vehicle_plate ?? "",
    report.vehicle_start_km ?? "",
    report.vehicle_end_km ?? "",
    report.used_equipment ?? "",
    report.product_item_coil_code ?? "",
    report.mechanical_connection ?? "",
    report.profile_material ?? "",
    join([...(report.replacement_reasons ?? []), report.replacement_reason_other ?? ""]),
    report.has_test_piece ?? "",
    report.test_status ?? "",
    report.press_start_time ?? "",
    report.press_end_time ?? "",
    report.power_outage ?? "",
    report.pressure_drop ?? "",
    report.heat_balance_ok ?? "",
    report.billing_status ?? "",
    report.technical_details ?? "",
    tensioning.join(", "),
    report.pre_tension_percent ?? "",
    [report.pressure_value, report.pressure_unit].filter(Boolean).join(" "),
    [
      report.blanket_roughening_info_given,
      report.blanket_info_person_name
    ].filter(Boolean).join(" - "),
    report.report_photos?.length ?? 0
  ];
}

export async function createReportsWorkbook(reports: ExportReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TUNCA Rapor Sistemi";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Raporlar");
  sheet.addRow([...reportExportColumns]);
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: reportExportColumns.length }
  };

  reports.forEach((report) => sheet.addRow(mapReportToExcelRow(report)));

  sheet.columns.forEach((column) => {
    column.width = Math.min(Math.max(column.header?.toString().length ?? 12, 14), 32);
  });

  [1, 19, 20, 21, 22].forEach((columnIndex) => {
    sheet.getColumn(columnIndex).numFmt = "dd.mm.yyyy hh:mm";
  });

  const photoSheet = workbook.addWorksheet("Fotograflar");
  photoSheet.addRow(["Rapor No", "Kategori", "Açıklama", "Fotoğraf Dosyası / Güvenli Referans"]);
  photoSheet.getRow(1).font = { bold: true };
  for (const report of reports) {
    for (const photo of report.report_photos ?? []) {
      photoSheet.addRow([
        report.report_number ?? "Taslak",
        photo.category ?? "",
        photo.caption ?? "",
        photo.storage_path ?? ""
      ]);
    }
  }
  photoSheet.columns.forEach((column) => {
    column.width = 28;
  });

  return workbook;
}
