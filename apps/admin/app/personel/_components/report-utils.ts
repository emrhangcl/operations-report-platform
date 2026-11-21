// Personel web uygulamasi: tipler ve saf yardimci fonksiyonlar (page.tsx'ten aynen tasindi).
import type {
  Belt,
  Equipment,
  InstallationAssignment,
  ReportFormValues,
  ReportStatus,
  ReportWorkItem
} from "@operations/types";
import { emptyReportFormValues } from "@operations/validation";
import { getBrowserClient } from "@/lib/browser-client";

export function getPersonnelClient() {
  return getBrowserClient("personnel");
}

export type Screen = "home" | "form" | "drafts" | "submitted" | "assignments" | "detail";

export type ReportRow = Record<string, unknown> & {
  id: string;
  client_request_id: string | null;
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  status: ReportStatus;
  created_at: string;
  submitted_at: string | null;
  report_personnel?: Array<{ profile_id: string | null; name_snapshot: string | null }>;
};

export type ReportDetail = ReportRow & {
  created_by_name_snapshot: string | null;
  updated_at: string;
  report_personnel?: Array<{ profile_id?: string | null; name_snapshot: string | null }>;
  report_photos?: Array<{
    id?: string;
    category: string | null;
    caption: string | null;
    storage_path: string | null;
    created_at: string;
  }>;
};

export type SavedPhoto = { id: string; storage_path: string; caption: string | null; url: string };

export type PhotoDraft = {
  localId: string;
  file: File;
  caption: string;
};

export const defaultPhotoCategory = "Genel";
export const turkeyTimeZone = "Europe/Istanbul";
export const replacementReasonOptions = [
  "Mekanik sıkıntılardan dolayı",
  "Ek yeri açtı",
  "Sorun yoktu, bant ortalama ömrü doldu",
  "Diğer"
];

export function newReportValues(): ReportFormValues {
  return {
    ...emptyReportFormValues,
    client_request_id: createId(),
    report_date: formatDateValue(new Date())
  } as ReportFormValues;
}

export function reportPayload(values: ReportFormValues, status: ReportStatus) {
  const nullable = (value: string) => value.trim() || null;
  const workItems = compactReportWorkItems(values.work_items);
  const primaryWorkItem = workItems[0] ?? emptyReportWorkItem();
  const productCodes = workItemProductCodes(workItems);

  return {
    client_request_id: values.client_request_id,
    customer_signature_required: true,
    status,
    report_date: values.report_date || formatDateValue(new Date()),
    company_id: values.company_id || null,
    company_contact_name: nullable(values.company_contact_name),
    company_contact_phone: nullable(values.company_contact_phone),
    line_name: nullable(primaryWorkItem.line_name || values.line_name),
    work_items: workItems,
    machine_brand_model: nullable(primaryWorkItem.machine_name || values.machine_brand_model),
    customer_machine_name: nullable(values.customer_machine_name),
    belt_id: primaryWorkItem.belt_id || values.belt_id || null,
    vehicle_plate: nullable(values.vehicle_plate),
    vehicle_start_km: nullable(values.vehicle_start_km),
    vehicle_end_km: nullable(values.vehicle_end_km),
    used_equipment: nullable(values.used_equipment),
    workshop_departure_at: nullable(values.workshop_departure_at),
    customer_arrival_at: nullable(values.customer_arrival_at),
    customer_departure_at: nullable(values.customer_departure_at),
    factory_return_at: nullable(values.factory_return_at),
    product_code: nullable(productCodes.join("\n") || values.product_code),
    product_measure: null,
    product_width: nullable(primaryWorkItem.product_width || values.product_width),
    product_length: nullable(primaryWorkItem.product_length || values.product_length),
    product_quantity: nullable(primaryWorkItem.product_quantity || values.product_quantity),
    product_item_coil_code: nullable(primaryWorkItem.coil_code || values.product_item_coil_code),
    product_types: values.product_types,
    product_type_other: nullable(values.product_type_other),
    process_actions: values.process_actions,
    edge_cut_method: nullable(values.edge_cut_method),
    process_action_other: nullable(values.process_action_other),
    mechanical_connection: nullable(values.mechanical_connection),
    profile_material: nullable(values.profile_material),
    removed_belt_years: nullable(values.removed_belt_years),
    replacement_reasons: values.replacement_reasons,
    replacement_reason_other: nullable(values.replacement_reason_other),
    has_test_piece: nullable(values.has_test_piece),
    test_status: nullable(values.test_status),
    observer_personnel_id: values.observer_personnel_id || null,
    observer_external_name: nullable(values.observer_external_name),
    press_start_time: nullable(values.press_start_time),
    press_end_time: nullable(values.press_end_time),
    power_outage: nullable(values.power_outage),
    pressure_drop: nullable(values.pressure_drop),
    heat_balance_ok: nullable(values.heat_balance_ok),
    process_description: nullable(values.process_description),
    billing_status: nullable(values.billing_status),
    technical_details: nullable(values.technical_details),
    tensioning_done: nullable(values.tensioning_done),
    customer_will_tension: values.customer_will_tension,
    customer_tensioned_auto: values.customer_tensioned_auto,
    pressure_value: nullable(values.pressure_value),
    pressure_unit: nullable(values.pressure_unit),
    pre_tension_percent: nullable(values.pre_tension_percent),
    line_delivered_running: values.line_delivered_running,
    blanket_roughening_info_given: nullable(values.blanket_roughening_info_given),
    blanket_info_person_name: nullable(values.blanket_info_person_name)
  };
}

export function reportToValues(report: ReportRow, equipment: Equipment[]): ReportFormValues {
  const workItems = workItemsFromValue(
    report.work_items,
    stringValue(report.line_name),
    stringValue(report.belt_id),
    stringValue(report.belt_code_snapshot),
    stringValue(report.belt_name_snapshot),
    stringValue(report.product_width),
    stringValue(report.product_length),
    stringValue(report.product_quantity),
    stringValue(report.machine_brand_model),
    stringValue(report.product_item_coil_code)
  );
  const primaryWorkItem = compactReportWorkItems(workItems)[0] ?? workItems[0] ?? emptyReportWorkItem();
  const equipmentIds = equipmentIdsFromValue(report.used_equipment_ids, stringValue(report.used_equipment), equipment);

  return {
    ...emptyReportFormValues,
    client_request_id: stringValue(report.client_request_id) || createId(),
    report_date: stringValue(report.report_date) || formatDateValue(new Date()),
    company_id: stringValue(report.company_id),
    company_contact_name: stringValue(report.company_contact_name),
    company_contact_phone: stringValue(report.company_contact_phone),
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: primaryWorkItem.machine_name || stringValue(report.machine_brand_model),
    customer_machine_name: stringValue(report.customer_machine_name),
    belt_id: primaryWorkItem.belt_id,
    visiting_personnel_ids: (report.report_personnel ?? [])
      .map((item) => item.profile_id)
      .filter((value): value is string => Boolean(value)),
    vehicle_plate: stringValue(report.vehicle_plate),
    vehicle_start_km: stringValue(report.vehicle_start_km),
    vehicle_end_km: stringValue(report.vehicle_end_km),
    used_equipment_ids: equipmentIds,
    used_equipment: equipmentNamesFromIds(equipmentIds, equipment) || stringValue(report.used_equipment),
    workshop_departure_at: stringValue(report.workshop_departure_at),
    customer_arrival_at: stringValue(report.customer_arrival_at),
    customer_departure_at: stringValue(report.customer_departure_at),
    factory_return_at: stringValue(report.factory_return_at),
    product_code: stringValue(report.product_code),
    product_measure: stringValue(report.product_measure),
    product_width: primaryWorkItem.product_width || stringValue(report.product_width),
    product_length: primaryWorkItem.product_length || stringValue(report.product_length),
    product_quantity: primaryWorkItem.product_quantity || stringValue(report.product_quantity),
    product_item_coil_code: primaryWorkItem.coil_code || stringValue(report.product_item_coil_code),
    product_types: arrayValue(report.product_types) as ReportFormValues["product_types"],
    product_type_other: stringValue(report.product_type_other),
    process_actions: arrayValue(report.process_actions) as ReportFormValues["process_actions"],
    edge_cut_method: stringValue(report.edge_cut_method) as ReportFormValues["edge_cut_method"],
    process_action_other: stringValue(report.process_action_other),
    mechanical_connection: stringValue(report.mechanical_connection),
    profile_material: stringValue(report.profile_material),
    removed_belt_years: stringValue(report.removed_belt_years),
    replacement_reasons: arrayValue(report.replacement_reasons),
    replacement_reason_other: stringValue(report.replacement_reason_other),
    has_test_piece: stringValue(report.has_test_piece) as ReportFormValues["has_test_piece"],
    test_status: stringValue(report.test_status) as ReportFormValues["test_status"],
    observer_personnel_id: stringValue(report.observer_personnel_id),
    observer_external_name: stringValue(report.observer_external_name),
    press_start_time: stringValue(report.press_start_time).slice(0, 5),
    press_end_time: stringValue(report.press_end_time).slice(0, 5),
    power_outage: stringValue(report.power_outage) as ReportFormValues["power_outage"],
    pressure_drop: stringValue(report.pressure_drop) as ReportFormValues["pressure_drop"],
    heat_balance_ok: stringValue(report.heat_balance_ok) as ReportFormValues["heat_balance_ok"],
    process_description: stringValue(report.process_description),
    billing_status: stringValue(report.billing_status) as ReportFormValues["billing_status"],
    technical_details: stringValue(report.technical_details),
    tensioning_done: stringValue(report.tensioning_done) as ReportFormValues["tensioning_done"],
    customer_will_tension: booleanValue(report.customer_will_tension),
    customer_tensioned_auto: booleanValue(report.customer_tensioned_auto),
    pressure_value: stringValue(report.pressure_value),
    pressure_unit: stringValue(report.pressure_unit),
    pre_tension_percent: stringValue(report.pre_tension_percent),
    line_delivered_running: booleanValue(report.line_delivered_running),
    blanket_roughening_info_given: stringValue(report.blanket_roughening_info_given) as ReportFormValues["blanket_roughening_info_given"],
    blanket_info_person_name: stringValue(report.blanket_info_person_name)
  };
}

export function assignmentToValues(assignment: InstallationAssignment, equipment: Equipment[]): ReportFormValues {
  const values = toRecord(assignment.report_values);
  const workItems = workItemsFromValue(
    values.work_items,
    (stringValue(values.line_name) || assignment.line_name) ?? "",
    stringValue(values.belt_id),
    stringValue(values.belt_code),
    stringValue(values.belt_name),
    stringValue(values.product_width),
    stringValue(values.product_length),
    stringValue(values.product_quantity),
    stringValue(values.machine_brand_model),
    stringValue(values.product_item_coil_code)
  );
  const primaryWorkItem = compactReportWorkItems(workItems)[0] ?? workItems[0] ?? emptyReportWorkItem();
  const equipmentIds = equipmentIdsFromValue(values.used_equipment_ids, stringValue(values.used_equipment), equipment);

  return {
    ...emptyReportFormValues,
    client_request_id: createId(),
    report_date: stringValue(values.report_date) || assignment.scheduled_date || formatDateValue(new Date()),
    company_id: (stringValue(values.company_id) || assignment.company_id) ?? "",
    company_contact_name: stringValue(values.company_contact_name),
    company_contact_phone: stringValue(values.company_contact_phone),
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: primaryWorkItem.machine_name || stringValue(values.machine_brand_model),
    customer_machine_name: stringValue(values.customer_machine_name),
    belt_id: primaryWorkItem.belt_id,
    visiting_personnel_ids: arrayValue(values.visiting_personnel_ids),
    vehicle_plate: stringValue(values.vehicle_plate),
    vehicle_start_km: stringValue(values.vehicle_start_km),
    vehicle_end_km: stringValue(values.vehicle_end_km),
    used_equipment_ids: equipmentIds,
    used_equipment: equipmentNamesFromIds(equipmentIds, equipment) || stringValue(values.used_equipment),
    workshop_departure_at: stringValue(values.workshop_departure_at),
    customer_arrival_at: stringValue(values.customer_arrival_at),
    customer_departure_at: stringValue(values.customer_departure_at),
    factory_return_at: stringValue(values.factory_return_at),
    product_code: stringValue(values.product_code),
    product_measure: stringValue(values.product_measure),
    product_width: primaryWorkItem.product_width || stringValue(values.product_width),
    product_length: primaryWorkItem.product_length || stringValue(values.product_length),
    product_quantity: primaryWorkItem.product_quantity || stringValue(values.product_quantity),
    product_item_coil_code: primaryWorkItem.coil_code || stringValue(values.product_item_coil_code),
    product_types: arrayValue(values.product_types) as ReportFormValues["product_types"],
    product_type_other: stringValue(values.product_type_other),
    process_actions: arrayValue(values.process_actions) as ReportFormValues["process_actions"],
    edge_cut_method: stringValue(values.edge_cut_method) as ReportFormValues["edge_cut_method"],
    process_action_other: stringValue(values.process_action_other),
    mechanical_connection: stringValue(values.mechanical_connection),
    profile_material: stringValue(values.profile_material),
    removed_belt_years: stringValue(values.removed_belt_years),
    replacement_reasons: arrayValue(values.replacement_reasons),
    replacement_reason_other: stringValue(values.replacement_reason_other),
    has_test_piece: stringValue(values.has_test_piece) as ReportFormValues["has_test_piece"],
    test_status: stringValue(values.test_status) as ReportFormValues["test_status"],
    observer_personnel_id: stringValue(values.observer_personnel_id),
    observer_external_name: stringValue(values.observer_external_name),
    press_start_time: stringValue(values.press_start_time).slice(0, 5),
    press_end_time: stringValue(values.press_end_time).slice(0, 5),
    power_outage: stringValue(values.power_outage) as ReportFormValues["power_outage"],
    pressure_drop: stringValue(values.pressure_drop) as ReportFormValues["pressure_drop"],
    heat_balance_ok: stringValue(values.heat_balance_ok) as ReportFormValues["heat_balance_ok"],
    process_description: stringValue(values.process_description),
    billing_status: stringValue(values.billing_status) as ReportFormValues["billing_status"],
    technical_details: stringValue(values.technical_details),
    tensioning_done: stringValue(values.tensioning_done) as ReportFormValues["tensioning_done"],
    customer_will_tension: booleanValue(values.customer_will_tension),
    customer_tensioned_auto: booleanValue(values.customer_tensioned_auto),
    pressure_value: stringValue(values.pressure_value),
    pressure_unit: stringValue(values.pressure_unit),
    pre_tension_percent: stringValue(values.pre_tension_percent),
    line_delivered_running: booleanValue(values.line_delivered_running),
    blanket_roughening_info_given: stringValue(values.blanket_roughening_info_given) as ReportFormValues["blanket_roughening_info_given"],
    blanket_info_person_name: stringValue(values.blanket_info_person_name)
  };
}

export function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => {
    const random = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint8Array(1))[0] ?? Math.floor(Math.random() * 256)
      : Math.floor(Math.random() * 256);
    return (Number(char) ^ (random & (15 >> (Number(char) / 4)))).toString(16);
  });
}

export function safeExtension(fileName: string, contentType: string) {
  const rawExtension = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (rawExtension === "png" || rawExtension === "webp" || rawExtension === "jpg" || rawExtension === "jpeg") {
    return rawExtension === "jpeg" ? "jpg" : rawExtension;
  }
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

export function formatDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateDisplay(value: string) {
  if (!value) return "";
  const date = parseDateOnly(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatDateTimeDisplay(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: turkeyTimeZone,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

export function toDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function fromDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function equipmentIdsFromValue(value: unknown, fallbackText: string, equipment: Equipment[]) {
  const directIds = arrayValue(value).filter((id) => equipment.some((item) => item.id === id));
  if (directIds.length > 0 || !fallbackText.trim()) return directIds;

  const selectedNames = fallbackText
    .split(/[,;\n]/)
    .map((item) => item.trim().toLocaleLowerCase("tr-TR"))
    .filter(Boolean);

  return equipment
    .filter((item) => selectedNames.includes(item.name.trim().toLocaleLowerCase("tr-TR")))
    .map((item) => item.id);
}

export function equipmentNamesFromIds(ids: string[], equipment: Equipment[]) {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  return ids
    .map((id) => equipmentById.get(id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

export function prepareReportValues(values: ReportFormValues, belts: Belt[], equipment: Equipment[]): ReportFormValues {
  const beltsById = new Map(belts.map((belt) => [belt.id, belt]));
  const workItems = compactReportWorkItems(
    enrichReportWorkItems(
      workItemsFromValue(
        values.work_items,
        values.line_name,
        values.belt_id,
        "",
        "",
        values.product_width,
        values.product_length,
        values.product_quantity,
        values.machine_brand_model,
        values.product_item_coil_code
      ),
      beltsById
    )
  );
  const primaryWorkItem = workItems[0] ?? emptyReportWorkItem();
  const productCodes = workItemProductCodes(workItems);
  const usedEquipment = equipmentNamesFromIds(values.used_equipment_ids, equipment) || values.used_equipment;

  return {
    ...values,
    line_name: primaryWorkItem.line_name || values.line_name,
    belt_id: primaryWorkItem.belt_id || values.belt_id,
    work_items: workItems,
    product_code: productCodes.join("\n") || values.product_code,
    product_measure: "",
    product_width: primaryWorkItem.product_width || values.product_width,
    product_length: primaryWorkItem.product_length || values.product_length,
    product_quantity: primaryWorkItem.product_quantity || values.product_quantity,
    machine_brand_model: primaryWorkItem.machine_name || values.machine_brand_model,
    product_item_coil_code: primaryWorkItem.coil_code || values.product_item_coil_code,
    used_equipment: usedEquipment
  };
}

export function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}

export function emptyReportWorkItem(): ReportWorkItem {
  return { line_name: "", belt_id: "", belt_code: "", belt_name: "", machine_name: "", coil_code: "", product_width: "", product_length: "", product_quantity: "" };
}

export function normalizeReportWorkItems(items: ReportWorkItem[]) {
  return items.length > 0 ? items : [emptyReportWorkItem()];
}

export function compactReportWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim(),
      machine_name: (item.machine_name ?? "").trim(),
      coil_code: (item.coil_code ?? "").trim(),
      product_width: item.product_width.trim(),
      product_length: item.product_length.trim(),
      product_quantity: item.product_quantity.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.machine_name || item.coil_code || item.product_width || item.product_length || item.product_quantity);
}

export function workItemsFromValue(
  value: unknown,
  fallbackLineName: string,
  fallbackBeltId: string,
  fallbackBeltCode = "",
  fallbackBeltName = "",
  fallbackProductWidth = "",
  fallbackProductLength = "",
  fallbackProductQuantity = "",
  fallbackMachineName = "",
  fallbackCoilCode = ""
): ReportWorkItem[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toRecord(item))
      .map((item, index) => ({
        line_name: stringValue(item.line_name),
        belt_id: stringValue(item.belt_id),
        belt_code: stringValue(item.belt_code),
        belt_name: stringValue(item.belt_name),
        machine_name: stringValue(item.machine_name) || (index === 0 ? fallbackMachineName : ""),
        coil_code: stringValue(item.coil_code) || (index === 0 ? fallbackCoilCode : ""),
        product_width: stringValue(item.product_width),
        product_length: stringValue(item.product_length),
        product_quantity: stringValue(item.product_quantity)
      }))
      .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.machine_name || item.coil_code || item.product_width || item.product_length || item.product_quantity);

    if (items.length > 0) {
      return items;
    }
  }

  return normalizeReportWorkItems([
    {
      line_name: fallbackLineName,
      belt_id: fallbackBeltId,
      belt_code: fallbackBeltCode,
      belt_name: fallbackBeltName,
      machine_name: fallbackMachineName,
      coil_code: fallbackCoilCode,
      product_width: fallbackProductWidth,
      product_length: fallbackProductLength,
      product_quantity: fallbackProductQuantity
    }
  ]);
}

export function enrichReportWorkItems(items: ReportWorkItem[], beltsById: Map<string, Belt>) {
  return normalizeReportWorkItems(items).map((item) => {
    const belt = beltsById.get(item.belt_id);
    return {
      ...item,
      belt_code: item.belt_code || belt?.code || "",
      belt_name: item.belt_name || belt?.name || ""
    };
  });
}

export function formatReportWorkItemLabel(item: ReportWorkItem) {
  const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
  const machineAndCoil = [item.machine_name, item.coil_code].filter(Boolean).join(" / ");
  return [item.line_name, beltLabel, machineAndCoil].filter(Boolean).join(" / ");
}

export function workItemBeltCodesText(items: ReportWorkItem[], fallbackBeltId: string, beltsById: Map<string, Belt>) {
  const codes = compactReportWorkItems(items)
    .map((item) => item.belt_code || beltsById.get(item.belt_id)?.code || "")
    .filter(Boolean);

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return beltsById.get(fallbackBeltId)?.code ?? "-";
}

export function workItemProductCodes(items: ReportWorkItem[], fallbackBeltId = "", beltsById?: Map<string, Belt>) {
  const codes = compactReportWorkItems(items)
    .map((item) => item.belt_code || beltsById?.get(item.belt_id)?.code || "")
    .filter(Boolean);

  if (codes.length > 0) {
    return codes;
  }

  const fallbackCode = fallbackBeltId ? beltsById?.get(fallbackBeltId)?.code : "";
  return fallbackCode ? [fallbackCode] : [];
}

export function reportWorkItemsText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity),
      stringValue(report.machine_brand_model),
      stringValue(report.product_item_coil_code)
    )
  );

  return items.map(formatReportWorkItemLabel).filter(Boolean).join(" • ") || "-";
}

export function reportBeltCodesText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return text(report.belt_code_snapshot);
}

export function reportProductCodesText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return codes.join(" • ");
  }

  return text(report.product_code || report.belt_code_snapshot);
}

export function reportProductMeasurementsText(report: Record<string, unknown>) {
  const items = compactReportWorkItems(
    workItemsFromValue(
      report.work_items,
      stringValue(report.line_name),
      stringValue(report.belt_id),
      stringValue(report.belt_code_snapshot),
      stringValue(report.belt_name_snapshot),
      stringValue(report.product_width),
      stringValue(report.product_length),
      stringValue(report.product_quantity)
    )
  );
  const rows = items
    .map((item) => {
      const code = item.belt_code || "Ürün";
      const size = [item.product_width, item.product_length].filter(Boolean).join(" x ");
      const quantity = item.product_quantity ? `${item.product_quantity} adet` : "";
      const detail = [size, quantity].filter(Boolean).join(" / ");
      return detail ? `${code}: ${detail}` : "";
    })
    .filter(Boolean);

  return rows.join(" • ") || "-";
}

export function assignmentWorkItemsText(assignment: InstallationAssignment) {
  const values = toRecord(assignment.report_values);
  const items = compactReportWorkItems(
    workItemsFromValue(
      values.work_items,
      assignment.line_name ?? "",
      stringValue(values.belt_id),
      "",
      "",
      stringValue(values.product_width),
      stringValue(values.product_length),
      stringValue(values.product_quantity),
      stringValue(values.machine_brand_model),
      stringValue(values.product_item_coil_code)
    )
  );
  return items.map(formatReportWorkItemLabel).filter(Boolean).join(" • ") || assignment.line_name || "";
}

export function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

export function text(value: unknown) {
  const content = stringValue(value).trim();
  return content || "-";
}

export function fallbackText(first: string, second: string) {
  return first !== "-" ? first : second;
}

export function arrayText(value: unknown) {
  const items = arrayValue(value);
  return items.length > 0 ? items.join(", ") : "-";
}

export function boolText(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Evet" : "Hayır";
}
