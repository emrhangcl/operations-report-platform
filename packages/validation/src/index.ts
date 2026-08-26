import { z } from "zod";

export const productTypes = [
  "Kayış",
  "Policort",
  "Konveyör Bant",
  "Modüler Bant",
  "Baskı Blanketi",
  "Diğer"
] as const;

export const processActions = [
  "Yeni Bant",
  "Çıkma Ellerindeki Ürün",
  "Ekyeri Yapıştırma İşlemi",
  "Tamir İşlemi",
  "Mekanik Bağlantı",
  "Profil Yapıştırma",
  "Ek Girme İşlemi",
  "Model Değiştirme",
  "Kayış Yapıştırma İşlemi",
  "Taşlama Yapıştırma",
  "Panç Yapıştırma",
  "Presli Tamir İşlemi",
  "Tamir Kiti İle",
  "Kenar Kesim",
  "Diğer"
] as const;

export const photoCategories = [
  "İşlem Öncesi",
  "İşlem Esnası",
  "İşlem Sonrası",
  "Ürün / Bant",
  "Makine",
  "Problem",
  "Diğer"
] as const;

export const userRoles = ["ADMIN", "PERSONNEL"] as const;

export const installationAssignmentStatuses = [
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
] as const;

export const emptyReportFormValues = {
  client_request_id: "",
  report_date: "",
  company_id: "",
  company_contact_name: "",
  company_contact_phone: "",
  line_name: "",
  machine_brand_model: "",
  customer_machine_name: "",
  belt_id: "",
  visiting_personnel_ids: [] as string[],
  vehicle_plate: "",
  vehicle_start_km: "",
  vehicle_end_km: "",
  used_equipment: "",
  workshop_departure_at: "",
  customer_arrival_at: "",
  customer_departure_at: "",
  factory_return_at: "",
  product_code: "",
  product_measure: "",
  product_width: "",
  product_length: "",
  product_quantity: "",
  product_item_coil_code: "",
  customer_stock_note: "",
  product_types: [] as string[],
  product_type_other: "",
  process_actions: [] as string[],
  edge_cut_method: "",
  process_action_other: "",
  mechanical_connection: "",
  profile_material: "",
  removed_belt_years: "",
  replacement_reasons: [] as string[],
  replacement_reason_other: "",
  has_test_piece: "",
  test_status: "",
  observer_personnel_id: "",
  observer_external_name: "",
  press_start_time: "",
  press_end_time: "",
  power_outage: "",
  pressure_drop: "",
  heat_balance_ok: "",
  process_description: "",
  billing_status: "",
  technical_details: "",
  tensioning_done: "",
  customer_will_tension: false,
  customer_tensioned_auto: false,
  pressure_value: "",
  pressure_unit: "",
  pre_tension_percent: "",
  line_delivered_running: false,
  blanket_roughening_info_given: "",
  blanket_info_person_name: ""
};

const optionalDatetime = z.string().trim();

export const reportFormSchema = z
  .object({
    client_request_id: z.string().uuid("Taslak kimliği geçersiz."),
    report_date: z.string().min(1, "Rapor tarihi zorunludur."),
    company_id: z.string().uuid("Firma seçimi zorunludur."),
    company_contact_name: z.string().trim(),
    company_contact_phone: z.string().trim(),
    line_name: z.string().trim(),
    machine_brand_model: z.string().trim(),
    customer_machine_name: z.string().trim(),
    belt_id: z.string().uuid().or(z.literal("")),
    visiting_personnel_ids: z.array(z.string().uuid()),
    vehicle_plate: z.string().trim(),
    vehicle_start_km: z.string().trim(),
    vehicle_end_km: z.string().trim(),
    used_equipment: z.string().trim(),
    workshop_departure_at: optionalDatetime,
    customer_arrival_at: optionalDatetime,
    customer_departure_at: optionalDatetime,
    factory_return_at: optionalDatetime,
    product_code: z.string().trim(),
    product_measure: z.string().trim(),
    product_width: z.string().trim(),
    product_length: z.string().trim(),
    product_quantity: z.string().trim(),
    product_item_coil_code: z.string().trim(),
    customer_stock_note: z.string().trim(),
    product_types: z.array(z.enum(productTypes)),
    product_type_other: z.string().trim(),
    process_actions: z.array(z.enum(processActions)),
    edge_cut_method: z.enum(["Makine ile", "El ile"]).or(z.literal("")),
    process_action_other: z.string().trim(),
    mechanical_connection: z.string().trim(),
    profile_material: z.string().trim(),
    removed_belt_years: z.string().trim(),
    replacement_reasons: z.array(z.string().trim()),
    replacement_reason_other: z.string().trim(),
    has_test_piece: z.enum(["Var", "Yok"]).or(z.literal("")),
    test_status: z.enum(["Test Yapıldı", "Test Yapılmadı"]).or(z.literal("")),
    observer_personnel_id: z.string().uuid().or(z.literal("")),
    observer_external_name: z.string().trim(),
    press_start_time: z.string().trim(),
    press_end_time: z.string().trim(),
    power_outage: z.enum(["Evet", "Hayır"]).or(z.literal("")),
    pressure_drop: z.enum(["Evet", "Hayır"]).or(z.literal("")),
    heat_balance_ok: z.enum(["Evet", "Hayır"]).or(z.literal("")),
    process_description: z.string().trim(),
    billing_status: z
      .enum([
        "Yapılan İşlem Tarafınıza Fatura Edilecektir",
        "Bedelsiz İşlem Yapılmıştır"
      ])
      .or(z.literal("")),
    technical_details: z.string().trim(),
    tensioning_done: z.enum(["Evet", "Hayır"]).or(z.literal("")),
    customer_will_tension: z.boolean(),
    customer_tensioned_auto: z.boolean(),
    pressure_value: z.string().trim(),
    pressure_unit: z.string().trim(),
    pre_tension_percent: z.string().trim(),
    line_delivered_running: z.boolean(),
    blanket_roughening_info_given: z.enum(["Evet", "Hayır"]).or(z.literal("")),
    blanket_info_person_name: z.string().trim()
  })
  .superRefine((value, ctx) => {
    if (
      value.process_actions.length === 0 &&
      value.process_description.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["process_actions"],
        message: "En az bir işlem seçin veya işlem açıklaması yazın."
      });
    }

    if (value.product_types.includes("Diğer") && !value.product_type_other) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product_type_other"],
        message: "Diğer ürün türü için açıklama yazın."
      });
    }

    if (value.process_actions.includes("Kenar Kesim") && !value.edge_cut_method) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edge_cut_method"],
        message: "Kenar kesim yöntemini seçin."
      });
    }

    if (value.process_actions.includes("Diğer") && !value.process_action_other) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["process_action_other"],
        message: "Diğer işlem için açıklama yazın."
      });
    }
  });

export const companySchema = z.object({
  name: z.string().trim().min(1, "Firma adı zorunludur."),
  address: z.string().trim().optional().or(z.literal("")),
  contact_name: z.string().trim().optional().or(z.literal("")),
  contact_phone: z.string().trim().optional().or(z.literal("")),
  is_active: z.boolean().default(true)
});

export const beltSchema = z.object({
  name: z.string().trim().min(1, "Bant adı zorunludur."),
  code: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  is_active: z.boolean().default(true)
});

export const companyLineSchema = z.object({
  company_id: z.string().uuid("Firma seçimi zorunludur."),
  name: z.string().trim().min(1, "Hat adı zorunludur.")
});

export const vehicleSchema = z.object({
  plate: z.string().trim().min(1, "Araç plakası zorunludur."),
  description: z.string().trim().optional().or(z.literal(""))
});

export const personnelSchema = z.object({
  first_name: z.string().trim().min(1, "Ad zorunludur."),
  last_name: z.string().trim().min(1, "Soyad zorunludur."),
  email: z.string().trim().email("Geçerli bir e-posta girin."),
  phone: z.string().trim().optional().or(z.literal("")),
  is_active: z.boolean().default(true)
});

export const userAccountSchema = personnelSchema.extend({
  role: z.enum(userRoles).default("PERSONNEL")
});

export const installationAssignmentSchema = z.object({
  title: z.string().trim().optional().or(z.literal("")),
  assigned_to_profile_id: z.string().uuid("Personel seçimi zorunludur."),
  scheduled_date: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  company_id: z.string().uuid("Firma seçimi zorunludur."),
  line_name: z.string().trim().optional().or(z.literal("")),
  report_values: z.record(z.unknown()).default({})
});

export type ReportFormInput = z.infer<typeof reportFormSchema>;
