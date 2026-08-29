export type UserRole = "ADMIN" | "PERSONNEL";

export type ReportStatus = "DRAFT" | "SUBMITTED";

export type InstallationAssignmentStatus =
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type SyncStatus =
  | "DEVICE_SAVED"
  | "WAITING_SYNC"
  | "SYNCED"
  | "SYNC_ERROR";

export type ProductType =
  | "Kayış"
  | "Policort"
  | "Konveyör Bant"
  | "Modüler Bant"
  | "Baskı Blanketi"
  | "Diğer";

export type ProcessAction =
  | "Yeni Bant"
  | "Çıkma Ellerindeki Ürün"
  | "Ekyeri Yapıştırma İşlemi"
  | "Tamir İşlemi"
  | "Mekanik Bağlantı"
  | "Profil Yapıştırma"
  | "Ek Girme İşlemi"
  | "Model Değiştirme"
  | "Kayış Yapıştırma İşlemi"
  | "Taşlama Yapıştırma"
  | "Panç Yapıştırma"
  | "Presli Tamir İşlemi"
  | "Tamir Kiti İle"
  | "Kenar Kesim"
  | "Diğer";

export type PhotoCategory =
  | "İşlem Öncesi"
  | "İşlem Esnası"
  | "İşlem Sonrası"
  | "Ürün / Bant"
  | "Makine"
  | "Problem"
  | "Diğer";

export type YesNo = "Evet" | "Hayır";
export type ExistsChoice = "Var" | "Yok";
export type TestStatus = "Test Yapıldı" | "Test Yapılmadı";

export interface Profile {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Belt {
  id: string;
  name: string | null;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyLine {
  id: string;
  company_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportListItem {
  id: string;
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  created_by_user_id: string | null;
  created_by_name_snapshot: string | null;
  status: ReportStatus;
  created_at: string;
  submitted_at: string | null;
  process_actions: ProcessAction[];
  report_personnel?: Array<{ name_snapshot: string }>;
}

export interface InstallationAssignment {
  id: string;
  title: string;
  status: InstallationAssignmentStatus;
  assigned_to_profile_id: string | null;
  created_by_profile_id: string | null;
  report_id: string | null;
  scheduled_date: string | null;
  notes: string | null;
  company_id: string | null;
  company_name_snapshot: string | null;
  line_name: string | null;
  report_values: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportWorkItem {
  line_name: string;
  belt_id: string;
  belt_code: string;
  belt_name: string;
  product_width: string;
  product_length: string;
  product_quantity: string;
}

export interface ReportFormValues {
  client_request_id: string;
  report_date: string;
  company_id: string;
  company_contact_name: string;
  company_contact_phone: string;
  line_name: string;
  work_items: ReportWorkItem[];
  machine_brand_model: string;
  customer_machine_name: string;
  belt_id: string;
  visiting_personnel_ids: string[];
  vehicle_plate: string;
  vehicle_start_km: string;
  vehicle_end_km: string;
  used_equipment: string;
  workshop_departure_at: string;
  customer_arrival_at: string;
  customer_departure_at: string;
  factory_return_at: string;
  product_code: string;
  product_measure: string;
  product_width: string;
  product_length: string;
  product_quantity: string;
  product_item_coil_code: string;
  product_types: ProductType[];
  product_type_other: string;
  process_actions: ProcessAction[];
  edge_cut_method: "Makine ile" | "El ile" | "";
  process_action_other: string;
  mechanical_connection: string;
  profile_material: string;
  removed_belt_years: string;
  replacement_reasons: string[];
  replacement_reason_other: string;
  has_test_piece: ExistsChoice | "";
  test_status: TestStatus | "";
  observer_personnel_id: string;
  observer_external_name: string;
  press_start_time: string;
  press_end_time: string;
  power_outage: YesNo | "";
  pressure_drop: YesNo | "";
  heat_balance_ok: YesNo | "";
  process_description: string;
  billing_status:
    | "Yapılan İşlem Tarafınıza Fatura Edilecektir"
    | "Bedelsiz İşlem Yapılmıştır"
    | "";
  technical_details: string;
  tensioning_done: YesNo | "";
  customer_will_tension: boolean;
  customer_tensioned_auto: boolean;
  pressure_value: string;
  pressure_unit: string;
  pre_tension_percent: string;
  line_delivered_running: boolean;
  blanket_roughening_info_given: YesNo | "";
  blanket_info_person_name: string;
}

export interface OfflineDraft {
  local_id: string;
  values: ReportFormValues;
  status: SyncStatus;
  updated_at: string;
}
