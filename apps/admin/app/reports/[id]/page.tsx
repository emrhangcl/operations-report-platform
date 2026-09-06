"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { Building2, CalendarDays, CheckCircle2, ChevronLeft, ClipboardList, Clock3, Download, Gauge, ImageIcon, Maximize2, Pencil, Plus, Save, Share2, Trash2, UserRound, X } from "lucide-react";
import type { Equipment, ReportFormValues, ReportWorkItem } from "@operations/types";
import { emptyReportFormValues, processActions, productTypes } from "@operations/validation";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  FormActions,
  FormField,
  FormSection,
  IconButton,
  LoadingState,
  PageHeaderShell,
  StatusBadge
} from "../../../components/ui";
import { downloadOrShareReportPdf } from "../../../lib/report-pdf-client";
import { clearSupabaseReadCache, getBrowserSupabase } from "../../../lib/supabase-browser";

type ReportDetail = Record<string, unknown> & {
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  created_by_name_snapshot: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  report_personnel?: Array<{ profile_id?: string | null; name_snapshot: string | null }>;
  report_photos?: Array<{
    id?: string;
    category: string | null;
    caption: string | null;
    storage_path: string | null;
    created_at: string;
  }>;
};

type ReportPhoto = NonNullable<ReportDetail["report_photos"]>[number];
type ActivePhoto = ReportPhoto & {
  index: number;
  signedUrl: string;
};

const replacementReasonOptions = [
  "Mekanik sıkıntılardan dolayı",
  "Ek yeri açtı",
  "Sorun yoktu, bant ortalama ömrü doldu",
  "Diğer"
];

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"download" | "share" | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState<ReportFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("error");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      const [reportResult, equipmentResult] = await Promise.all([
        supabase
          .from("reports")
          .select("*, report_personnel(profile_id,name_snapshot), report_photos(id,category,caption,storage_path,created_at)")
          .eq("id", params.id)
          .maybeSingle(),
        supabase.from("equipment").select("*").eq("is_active", true).order("name")
      ]);

      if (cancelled) return;

      if (reportResult.error || !reportResult.data) {
        setMessageTone("error");
        setMessage("Rapor detayı alınamadı.");
        return;
      }

      const nextEquipment = (equipmentResult.data ?? []) as Equipment[];
      const nextReport = reportResult.data as ReportDetail;
      setEquipment(nextEquipment);
      setReport(nextReport);
      setEditValues(reportToEditValues(nextReport, nextEquipment));

      const signedEntries = await Promise.all(
        (nextReport.report_photos ?? [])
          .filter((photo) => photo.storage_path)
          .map(async (photo) => {
            const path = String(photo.storage_path);
            const signed = await supabase.storage.from("report-photos").createSignedUrl(path, 60 * 30);
            return [path, signed.data?.signedUrl ?? ""] as const;
          })
      );

      if (!cancelled) {
        setPhotoUrls(Object.fromEntries(signedEntries.filter((entry) => entry[1])));
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setMessageTone("error");
        setMessage("Rapor detayı alınamadı.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    if (!activePhoto) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActivePhoto(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activePhoto]);

  async function authHeaders() {
    const supabase = getBrowserSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    return data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined;
  }

  async function deleteReport() {
    const headers = await authHeaders();
    if (!headers?.Authorization) {
      setMessageTone("error");
      setMessage("Silme işlemi için oturum doğrulanamadı.");
      setDeleteDialogOpen(false);
      return;
    }

    const response = await fetch(`/api/admin/reports/${params.id}`, {
      method: "DELETE",
      headers
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setMessageTone("error");
      setMessage(body?.message ?? "Rapor silinemedi.");
      setDeleteDialogOpen(false);
      return;
    }

    clearSupabaseReadCache();
    router.replace("/reports");
  }

  async function handlePdf(mode: "download" | "share") {
    if (!report) return;

    setMessage("");
    setPdfLoading(mode);
    try {
      const result = await downloadOrShareReportPdf({
        mode,
        reportId: params.id,
        reportNumber: report.report_number,
        scope: "admin"
      });

      if (!result.ok) {
        setMessageTone("error");
        setMessage(result.message);
      }
    } finally {
      setPdfLoading(null);
    }
  }

  function beginEdit() {
    if (!report) return;
    setEditValues(reportToEditValues(report, equipment));
    setMessage("");
    setEditing(true);
  }

  function updateEditValue<K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) {
    setEditValues((current) => current ? { ...current, [key]: value } : current);
  }

  function toggleEditArray(key: "product_types" | "process_actions" | "replacement_reasons", value: string) {
    setEditValues((current) => {
      if (!current) return current;
      const values = current[key] as string[];
      const next = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      return { ...current, [key]: next };
    });
  }

  function toggleEditEquipment(equipmentId: string) {
    setEditValues((current) => {
      if (!current) return current;
      const nextIds = current.used_equipment_ids.includes(equipmentId)
        ? current.used_equipment_ids.filter((item) => item !== equipmentId)
        : [...current.used_equipment_ids, equipmentId];
      return {
        ...current,
        used_equipment_ids: nextIds,
        used_equipment: equipmentNamesFromIds(nextIds, equipment)
      };
    });
  }

  function updateEditWorkItem(index: number, key: keyof ReportWorkItem, value: string) {
    setEditValues((current) => {
      if (!current) return current;
      const items = normalizeWorkItems(current.work_items).map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      );
      return syncPrimaryWorkItem({ ...current, work_items: items });
    });
  }

  function addEditWorkItem() {
    setEditValues((current) => current
      ? syncPrimaryWorkItem({ ...current, work_items: [...normalizeWorkItems(current.work_items), emptyWorkItem()] })
      : current
    );
  }

  function removeEditWorkItem(index: number) {
    setEditValues((current) => {
      if (!current) return current;
      const nextItems = normalizeWorkItems(current.work_items).filter((_, itemIndex) => itemIndex !== index);
      return syncPrimaryWorkItem({ ...current, work_items: nextItems.length > 0 ? nextItems : [emptyWorkItem()] });
    });
  }

  async function saveEdit() {
    if (!editValues || !report) return;

    if (!editValues.report_date) {
      setMessageTone("error");
      setMessage("Rapor tarihi zorunludur.");
      return;
    }

    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessageTone("error");
      setMessage("Supabase bilgileri girilmedi.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase
        .from("reports")
        .update(reportUpdatePayload(editValues))
        .eq("id", params.id)
        .select("*, report_personnel(profile_id,name_snapshot), report_photos(id,category,caption,storage_path,created_at)")
        .single();

      if (error || !data) {
        setMessageTone("error");
        setMessage("Rapor güncellenemedi. Yetki ve alanları kontrol edin.");
        return;
      }

      const nextReport = data as ReportDetail;
      clearSupabaseReadCache();
      setReport(nextReport);
      setEditValues(reportToEditValues(nextReport, equipment));
      setEditing(false);
      setMessageTone("info");
      setMessage("Rapor güncellendi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeaderShell
        title={report?.report_number ?? "Rapor Detayı"}
        description={report ? `${text(report.company_name_snapshot)} · ${dateOnly(report.report_date)}` : "Rapor bilgileri yükleniyor."}
        action={report ? (
          <FormActions className="header-actions">
            <Button icon={<ChevronLeft aria-hidden size={18} />} onClick={() => router.push("/reports")} variant="secondary">
              Raporlara Dön
            </Button>
            {editing ? (
              <>
                <Button
                  disabled={saving}
                  icon={<X aria-hidden size={18} />}
                  onClick={() => { setEditValues(reportToEditValues(report, equipment)); setEditing(false); }}
                  variant="secondary"
                >
                  Vazgeç
                </Button>
                <Button disabled={saving} icon={<Save aria-hidden size={18} />} onClick={saveEdit}>
                  {saving ? "Kaydediliyor" : "Kaydet"}
                </Button>
              </>
            ) : (
              <Button icon={<Pencil aria-hidden size={18} />} onClick={beginEdit} variant="secondary">
                Raporu Düzenle
              </Button>
            )}
            <Button
              disabled={pdfLoading !== null}
              icon={<Download aria-hidden size={18} />}
              onClick={() => handlePdf("download")}
              variant="secondary"
            >
              {pdfLoading === "download" ? "Hazırlanıyor" : "PDF İndir"}
            </Button>
            <Button
              disabled={pdfLoading !== null}
              icon={<Share2 aria-hidden size={18} />}
              onClick={() => handlePdf("share")}
              variant="secondary"
            >
              {pdfLoading === "share" ? "Hazırlanıyor" : "Paylaş"}
            </Button>
            <Button icon={<Trash2 aria-hidden size={18} />} onClick={() => setDeleteDialogOpen(true)} variant="danger">
              Raporu Sil
            </Button>
          </FormActions>
        ) : null}
      />
      {message ? <Alert tone={messageTone === "info" ? "success" : "error"}>{message}</Alert> : null}
      {!report ? (
        <LoadingState label="Rapor yükleniyor." />
      ) : editing && editValues ? (
        <ReportEditForm
          report={report}
          equipment={equipment}
          saving={saving}
          values={editValues}
          addWorkItem={addEditWorkItem}
          removeWorkItem={removeEditWorkItem}
          onCancel={() => { setEditValues(reportToEditValues(report, equipment)); setEditing(false); }}
          onSave={saveEdit}
          onToggleEquipment={toggleEditEquipment}
          onToggleArray={toggleEditArray}
          onUpdate={updateEditValue}
          onUpdateWorkItem={updateEditWorkItem}
        />
      ) : (
        <>
          <ReportSummary report={report} photoCount={report.report_photos?.length ?? 0} />
          <div className="detail-sections">
            <Section
              title="Genel Bilgiler"
              rows={[
                ["Rapor No", report.report_number ?? "Taslak"],
                ["Tarih", dateOnly(report.report_date)],
                ["Firma", text(report.company_name_snapshot)],
                ["Yetkili Kişi", text(report.company_contact_name)],
                ["Yetkili Telefon", text(report.company_contact_phone)],
                ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"]
              ]}
            />
            <Section
              title="Hat ve Araç"
              rows={[
                ["Hat Adı", text(report.line_name)],
                ["Bant Kodu", reportBeltCodesText(report)],
                ["İş Kalemleri", reportWorkItemsText(report)],
                ["Makina Marka Model", text(report.machine_brand_model)],
                ["Araç Plakası", text(report.vehicle_plate)],
                ["Araç KM", kmText(report.vehicle_start_km, report.vehicle_end_km)],
                ["Kullanılan Makine ve Ekipman", text(report.used_equipment)]
              ]}
            />
            <Section
              title="Zaman Bilgileri"
              rows={[
                ["Atölyeden Çıkış", dateTime(report.workshop_departure_at)],
                ["Müşteriye Varış", dateTime(report.customer_arrival_at)],
                ["Müşteriden Çıkış", dateTime(report.customer_departure_at)],
                ["Fabrikaya Dönüş", dateTime(report.factory_return_at)]
              ]}
            />
            <Section
              title="Ürün Bilgileri"
              rows={[
                ["Ürün Kodları", reportProductCodesText(report)],
                ["Ürün Ölçüleri", reportProductMeasurementsText(report)],
                ["Ürün Item / Coil Kodu", text(report.product_item_coil_code)],
                ["Ürün Türü", arrayText(report.product_types)]
              ]}
            />
            <Section
              title="Yapılan İşlemler"
              rows={[
                ["İşlemler", arrayText(report.process_actions)],
                ["Kenar Kesim", text(report.edge_cut_method)],
                ["Açıklama", text(report.process_description)],
                ["Mekanik Bağlantı", text(report.mechanical_connection)],
                ["Profil", text(report.profile_material)],
                ["Değiştirme Sebebi", arrayText(report.replacement_reasons)]
              ]}
            />
            <Section
              title="Pres ve Test"
              rows={[
                ["Test Parçası", text(report.has_test_piece)],
                ["Test Durumu", text(report.test_status)],
                ["Gözlemci", fallbackText(text(report.observer_name_snapshot), text(report.observer_external_name))],
                ["Pres Başlama", text(report.press_start_time)],
                ["Pres Bitiş", text(report.press_end_time)],
                ["Enerji Kesintisi", text(report.power_outage)],
                ["Basınç Düşmesi", text(report.pressure_drop)],
                ["Isı Dengesi", text(report.heat_balance_ok)]
              ]}
            />
            <Section
              title="Teknik Detaylar"
              rows={[
                ["Faturalandırma", text(report.billing_status)],
                ["Teknik Detaylar", text(report.technical_details)]
              ]}
            />
            <Section
              title="Gerdirme"
              rows={[
                ["Gerdirme Yapıldı mı?", text(report.tensioning_done)],
                ["Müşteri Sonra Yapacak", boolText(report.customer_will_tension)],
                ["Müşteri Otomatik Sistemde Yaptı", boolText(report.customer_tensioned_auto)],
                ["Uygulanan Basınç", [text(report.pressure_value), text(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
                ["Ön Gerdirme %", text(report.pre_tension_percent)],
                ["Hat Çalışır Teslim Edildi", boolText(report.line_delivered_running)]
              ]}
            />
            <PhotoSection
              photos={report.report_photos ?? []}
              photoUrls={photoUrls}
              onOpen={(photo, signedUrl, index) => setActivePhoto({ ...photo, signedUrl, index })}
            />
            <Section
              title="Sistem Bilgileri"
              rows={[
                ["Raporu oluşturan", text(report.created_by_name_snapshot)],
                ["Oluşturulma zamanı", dateTime(report.created_at)],
                ["Gönderilme zamanı", dateTime(report.submitted_at)],
                ["Son düzenleme zamanı", dateTime(report.updated_at)],
                ["Durum", statusText(report.status)]
              ]}
            />
          </div>
          {activePhoto ? <PhotoLightbox photo={activePhoto} onClose={() => setActivePhoto(null)} /> : null}
        </>
      )}
      <ConfirmDialog
        confirmLabel="Sil"
        description="Bu rapor ve ilişkili kayıtları kalıcı olarak silinsin mi?"
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => {
          void deleteReport();
        }}
        open={deleteDialogOpen}
        title="Rapor silme onayı"
      />
    </>
  );
}

function ReportEditForm({
  addWorkItem,
  equipment,
  onCancel,
  onSave,
  onToggleEquipment,
  onToggleArray,
  onUpdate,
  onUpdateWorkItem,
  removeWorkItem,
  report,
  saving,
  values
}: {
  addWorkItem: () => void;
  equipment: Equipment[];
  onCancel: () => void;
  onSave: () => void;
  onToggleEquipment: (value: string) => void;
  onToggleArray: (key: "product_types" | "process_actions" | "replacement_reasons", value: string) => void;
  onUpdate: <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => void;
  onUpdateWorkItem: (index: number, key: keyof ReportWorkItem, value: string) => void;
  removeWorkItem: (index: number) => void;
  report: ReportDetail;
  saving: boolean;
  values: ReportFormValues;
}) {
  return (
    <form
      className="form-panel assignment-form report-edit-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="assignment-form-sections">
        <FormSection className="form-subsection" title="Genel Bilgiler">
          <div className="form-grid assignment-grid">
            <EditField label="Rapor Tarihi">
              <input
                onChange={(event) => onUpdate("report_date", event.target.value)}
                required
                type="date"
                value={values.report_date}
              />
            </EditField>
            <EditField label="Firma">
              <div className="personnel-readonly">{text(report.company_name_snapshot)}</div>
            </EditField>
            <EditField label="Yetkili Kişi">
              <input onChange={(event) => onUpdate("company_contact_name", event.target.value)} value={values.company_contact_name} />
            </EditField>
            <EditField label="Yetkili Telefon">
              <input onChange={(event) => onUpdate("company_contact_phone", event.target.value)} value={values.company_contact_phone} />
            </EditField>
            <EditWorkItemsField
              items={values.work_items}
              addWorkItem={addWorkItem}
              removeWorkItem={removeWorkItem}
              onUpdate={onUpdateWorkItem}
            />
            <EditField label="Makina Marka Modeli">
              <input onChange={(event) => onUpdate("machine_brand_model", event.target.value)} value={values.machine_brand_model} />
            </EditField>
            <EditField label="Raporu Oluşturan">
              <div className="personnel-readonly">{text(report.created_by_name_snapshot)}</div>
            </EditField>
          </div>
        </FormSection>

        <FormSection className="form-subsection" title="Araç ve Zaman">
          <div className="form-grid assignment-grid">
            <EditField label="Araç Plakası">
              <input onChange={(event) => onUpdate("vehicle_plate", event.target.value)} value={values.vehicle_plate} />
            </EditField>
            <EditField label="Araç Alış KM">
              <input inputMode="numeric" onChange={(event) => onUpdate("vehicle_start_km", event.target.value)} value={values.vehicle_start_km} />
            </EditField>
            <EditField label="Araç Teslim KM">
              <input inputMode="numeric" onChange={(event) => onUpdate("vehicle_end_km", event.target.value)} value={values.vehicle_end_km} />
            </EditField>
            <EditSelectionPicker
              className="span-2"
              emptyText="Ekipman tanımlı değil"
              label="Kullanılan Makine/Ekipman"
              options={equipment.map((item) => ({ label: item.name, value: item.id }))}
              placeholder="Ekipman seçin"
              selected={values.used_equipment_ids}
              onToggle={onToggleEquipment}
            />
            <EditDateTimeField label="Atölyeden Çıkış" value={values.workshop_departure_at} onChange={(value) => onUpdate("workshop_departure_at", value)} />
            <EditDateTimeField label="Müşteriye Varış" value={values.customer_arrival_at} onChange={(value) => onUpdate("customer_arrival_at", value)} />
            <EditDateTimeField label="Müşteriden Çıkış" value={values.customer_departure_at} onChange={(value) => onUpdate("customer_departure_at", value)} />
            <EditDateTimeField label="Fabrikaya Dönüş" value={values.factory_return_at} onChange={(value) => onUpdate("factory_return_at", value)} />
          </div>
        </FormSection>

        <FormSection className="form-subsection" title="Ürün ve İşlem">
          <div className="form-grid assignment-grid">
            <EditField label="Item / Coil Kodu">
              <input onChange={(event) => onUpdate("product_item_coil_code", event.target.value)} value={values.product_item_coil_code} />
            </EditField>
            <EditCheckPicker
              className="span-2 assignment-compact-picker"
              label="Ürün Türü"
              options={productTypes.map((value) => ({ label: value, value }))}
              selected={values.product_types}
              onToggle={(value) => onToggleArray("product_types", value)}
            />
            {values.product_types.includes("Diğer") ? (
              <EditField label="Diğer Ürün Türü">
                <input onChange={(event) => onUpdate("product_type_other", event.target.value)} value={values.product_type_other} />
              </EditField>
            ) : null}
            <EditCheckPicker
              className="span-2 assignment-compact-picker"
              label="Yapılan İşlem"
              options={processActions.map((value) => ({ label: value, value }))}
              selected={values.process_actions}
              onToggle={(value) => onToggleArray("process_actions", value)}
            />
            {values.process_actions.includes("Kenar Kesim") ? (
              <EditField label="Kenar Kesim">
                <select onChange={(event) => onUpdate("edge_cut_method", event.target.value as ReportFormValues["edge_cut_method"])} value={values.edge_cut_method}>
                  <option value="">Seçilmedi</option>
                  <option value="Makine ile">Makine ile</option>
                  <option value="El ile">El ile</option>
                </select>
              </EditField>
            ) : null}
            {values.process_actions.includes("Diğer") ? (
              <EditField label="Diğer İşlem">
                <input onChange={(event) => onUpdate("process_action_other", event.target.value)} value={values.process_action_other} />
              </EditField>
            ) : null}
            <EditField label="Eski Bant Çalışma Süresi">
              <input onChange={(event) => onUpdate("removed_belt_years", event.target.value)} value={values.removed_belt_years} />
            </EditField>
            <EditCheckPicker
              className="span-2 assignment-compact-picker"
              label="Değiştirme Sebebi"
              options={replacementReasonOptions.map((value) => ({ label: value, value }))}
              selected={values.replacement_reasons}
              onToggle={(value) => onToggleArray("replacement_reasons", value)}
            />
            {values.replacement_reasons.includes("Diğer") ? (
              <EditField label="Diğer Sebep">
                <input onChange={(event) => onUpdate("replacement_reason_other", event.target.value)} value={values.replacement_reason_other} />
              </EditField>
            ) : null}
            <EditField className="span-2" label="Yapılan İşlem Açıklama">
              <textarea onChange={(event) => onUpdate("process_description", event.target.value)} value={values.process_description} />
            </EditField>
          </div>
        </FormSection>

        <FormSection className="form-subsection" title="Pres, Test ve Teslim">
          <div className="form-grid assignment-grid">
            <EditField label="Test Parçası">
              <select onChange={(event) => onUpdate("has_test_piece", event.target.value as ReportFormValues["has_test_piece"])} value={values.has_test_piece}>
                <option value="">Seçilmedi</option>
                <option value="Var">Var</option>
                <option value="Yok">Yok</option>
              </select>
            </EditField>
            <EditField label="Test Durumu">
              <select onChange={(event) => onUpdate("test_status", event.target.value as ReportFormValues["test_status"])} value={values.test_status}>
                <option value="">Seçilmedi</option>
                <option value="Test Yapıldı">Test Yapıldı</option>
                <option value="Test Yapılmadı">Test Yapılmadı</option>
              </select>
            </EditField>
            <EditField label="Gözlemci Açıklama">
              <input onChange={(event) => onUpdate("observer_external_name", event.target.value)} value={values.observer_external_name} />
            </EditField>
            <EditField label="Pres Başlama">
              <input onChange={(event) => onUpdate("press_start_time", event.target.value)} type="time" value={values.press_start_time} />
            </EditField>
            <EditField label="Pres Bitiş">
              <input onChange={(event) => onUpdate("press_end_time", event.target.value)} type="time" value={values.press_end_time} />
            </EditField>
            <EditField label="Enerji Kesintisi">
              <select onChange={(event) => onUpdate("power_outage", event.target.value as ReportFormValues["power_outage"])} value={values.power_outage}>
                <option value="">Seçilmedi</option>
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </EditField>
            <EditField label="Basınç Düşmesi">
              <select onChange={(event) => onUpdate("pressure_drop", event.target.value as ReportFormValues["pressure_drop"])} value={values.pressure_drop}>
                <option value="">Seçilmedi</option>
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </EditField>
            <EditField label="Isı Dengesi">
              <select onChange={(event) => onUpdate("heat_balance_ok", event.target.value as ReportFormValues["heat_balance_ok"])} value={values.heat_balance_ok}>
                <option value="">Seçilmedi</option>
                <option value="Hayır">Hayır</option>
                <option value="Evet">Evet</option>
              </select>
            </EditField>
            <EditField label="Gerdirme">
              <select onChange={(event) => onUpdate("tensioning_done", event.target.value as ReportFormValues["tensioning_done"])} value={values.tensioning_done}>
                <option value="">Seçilmedi</option>
                <option value="Evet">Evet</option>
                <option value="Hayır">Hayır</option>
              </select>
            </EditField>
            <EditToggle label="Müşteri daha sonra gerecek" value={values.customer_will_tension} onChange={(value) => onUpdate("customer_will_tension", value)} />
            <EditToggle label="Müşteri otomatik sistemde gerdi" value={values.customer_tensioned_auto} onChange={(value) => onUpdate("customer_tensioned_auto", value)} />
            <EditField label="Basınç">
              <input onChange={(event) => onUpdate("pressure_value", event.target.value)} value={values.pressure_value} />
            </EditField>
            <EditField label="Birim">
              <input onChange={(event) => onUpdate("pressure_unit", event.target.value)} value={values.pressure_unit} />
            </EditField>
            <EditField label="Ön Gerdirme %">
              <input inputMode="numeric" onChange={(event) => onUpdate("pre_tension_percent", event.target.value)} value={values.pre_tension_percent} />
            </EditField>
            <EditToggle label="Hat çalışır teslim edildi" value={values.line_delivered_running} onChange={(value) => onUpdate("line_delivered_running", value)} />
            <EditField label="Blanket Pürüzlendirme">
              <select onChange={(event) => onUpdate("blanket_roughening_info_given", event.target.value as ReportFormValues["blanket_roughening_info_given"])} value={values.blanket_roughening_info_given}>
                <option value="">Seçilmedi</option>
                <option value="Evet">Evet</option>
                <option value="Hayır">Hayır</option>
              </select>
            </EditField>
            <EditField label="Bilgi Verilen Kişi">
              <input onChange={(event) => onUpdate("blanket_info_person_name", event.target.value)} value={values.blanket_info_person_name} />
            </EditField>
          </div>
        </FormSection>

        <FormSection className="form-subsection" title="Not ve Faturalandırma">
          <div className="form-grid assignment-grid">
            <EditField label="Faturalandırma">
              <select onChange={(event) => onUpdate("billing_status", event.target.value as ReportFormValues["billing_status"])} value={values.billing_status}>
                <option value="">Seçilmedi</option>
                <option value="Yapılan İşlem Tarafınıza Fatura Edilecektir">Yapılan İşlem Tarafınıza Fatura Edilecektir</option>
                <option value="Bedelsiz İşlem Yapılmıştır">Bedelsiz İşlem Yapılmıştır</option>
              </select>
            </EditField>
            <EditField className="span-2" label="Teknik Detaylar">
              <textarea onChange={(event) => onUpdate("technical_details", event.target.value)} value={values.technical_details} />
            </EditField>
          </div>
        </FormSection>
      </div>

      <FormActions>
        <Button disabled={saving} icon={<Save aria-hidden size={18} />} type="submit">
          {saving ? "Kaydediliyor" : "Değişiklikleri Kaydet"}
        </Button>
        <Button disabled={saving} icon={<X aria-hidden size={18} />} onClick={onCancel} variant="secondary">
          Vazgeç
        </Button>
      </FormActions>
    </form>
  );
}

function EditField({
  children,
  className,
  label
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <FormField className={className} label={label}>
      {children}
    </FormField>
  );
}

function EditDateTimeField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <EditField label={label}>
      <input
        onChange={(event) => onChange(fromDatetimeLocal(event.target.value))}
        type="datetime-local"
        value={toDatetimeLocal(value)}
      />
    </EditField>
  );
}

function EditToggle({ label, onChange, value }: { label: string; onChange: (value: boolean) => void; value: boolean }) {
  return (
    <label className="personnel-toggle-row">
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function EditCheckPicker({
  className,
  label,
  options,
  selected,
  onToggle
}: {
  className?: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <FormField className={className} label={label}>
      <div className="choice-list">
        {options.map((option) => (
          <label className="check-row" key={option.value}>
            <input
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              type="checkbox"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </FormField>
  );
}

function EditSelectionPicker({
  className,
  emptyText,
  label,
  options,
  placeholder,
  selected,
  onToggle
}: {
  className?: string;
  emptyText: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  placeholder: string;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <FormField className={className} label={label}>
      <details className="personnel-choice-panel">
        <summary>{selectedLabels.length > 0 ? selectedLabels.join(", ") : options.length > 0 ? placeholder : emptyText}</summary>
        <div>
          {options.map((option) => (
            <label className="personnel-check-row" key={option.value}>
              <input
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
              {selected.includes(option.value) ? <CheckCircle2 aria-hidden size={16} /> : null}
            </label>
          ))}
        </div>
      </details>
    </FormField>
  );
}

function EditWorkItemsField({
  addWorkItem,
  items,
  onUpdate,
  removeWorkItem
}: {
  addWorkItem: () => void;
  items: ReportWorkItem[];
  onUpdate: (index: number, key: keyof ReportWorkItem, value: string) => void;
  removeWorkItem: (index: number) => void;
}) {
  const rows = normalizeWorkItems(items);

  return (
    <div className="field span-4 product-items-field">
      <label>Hat, Bant Kodu ve Ölçüler</label>
      <div className="product-item-list">
        <div className="product-item-row product-item-head report-edit-work-row">
          <span>Hat</span>
          <span>Bant Kodu</span>
          <span>En</span>
          <span>Boy</span>
          <span>Miktar</span>
          <span />
        </div>
        {rows.map((item, index) => (
          <div className="product-item-row report-edit-work-row" key={index}>
            <input
              aria-label={`${index + 1}. satır hat adı`}
              onChange={(event) => onUpdate(index, "line_name", event.target.value)}
              placeholder="Hat"
              value={item.line_name}
            />
            <input
              aria-label={`${index + 1}. satır bant kodu`}
              onChange={(event) => onUpdate(index, "belt_code", event.target.value)}
              placeholder="Bant kodu"
              value={item.belt_code}
            />
            <input
              aria-label={`${index + 1}. satır en`}
              onChange={(event) => onUpdate(index, "product_width", event.target.value)}
              placeholder="En"
              value={item.product_width}
            />
            <input
              aria-label={`${index + 1}. satır boy`}
              onChange={(event) => onUpdate(index, "product_length", event.target.value)}
              placeholder="Boy"
              value={item.product_length}
            />
            <input
              aria-label={`${index + 1}. satır miktar`}
              inputMode="numeric"
              onChange={(event) => onUpdate(index, "product_quantity", event.target.value)}
              placeholder="Miktar"
              value={item.product_quantity}
            />
            {rows.length > 1 ? (
              <IconButton
                aria-label={`${index + 1}. iş kalemini kaldır`}
                className="icon-button"
                icon={<Trash2 aria-hidden size={16} />}
                onClick={() => removeWorkItem(index)}
                variant="subtle"
              />
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>
      <Button className="contact-add-button" icon={<Plus aria-hidden size={16} />} onClick={addWorkItem} variant="secondary">
        Kalem Ekle
      </Button>
    </div>
  );
}

function ReportSummary({ report, photoCount }: { report: ReportDetail; photoCount: number }) {
  const personnelText = report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-";

  return (
    <section className="report-summary" aria-label="Rapor özeti">
      <SummaryCard icon={<Building2 aria-hidden size={18} />} label="Firma" value={text(report.company_name_snapshot)} meta={text(report.company_contact_name)} />
      <SummaryCard icon={<ClipboardList aria-hidden size={18} />} label="Hat / Bant" value={reportBeltCodesText(report)} meta={text(report.line_name)} />
      <SummaryCard icon={<Gauge aria-hidden size={18} />} label="Araç ve KM" value={text(report.vehicle_plate)} meta={kmText(report.vehicle_start_km, report.vehicle_end_km)} />
      <SummaryCard icon={<CalendarDays aria-hidden size={18} />} label="Rapor Tarihi" value={dateOnly(report.report_date)} meta={`${photoCount} fotoğraf`} />
      <SummaryCard icon={<UserRound aria-hidden size={18} />} label="Personel" value={personnelText} meta={text(report.created_by_name_snapshot)} />
      <SummaryCard icon={<Clock3 aria-hidden size={18} />} label="Durum" value={statusText(report.status)} meta={dateTime(report.submitted_at || report.updated_at)} />
    </section>
  );
}

function SummaryCard({
  icon,
  label,
  meta,
  value
}: {
  icon: React.ReactNode;
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <article className="report-summary-card">
      <div className="summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value || "-"}</strong>
        <small>{meta || "-"}</small>
      </div>
    </article>
  );
}

function Section({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <FormSection className="card detail-section">
      <div className="detail-section-title">
        <h2>{title}</h2>
        {title === "Sistem Bilgileri" ? <StatusBadge label={rows.find(([label]) => label === "Durum")?.[1] ?? "-"} tone="neutral" /> : null}
      </div>
      <dl className="kv">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </FormSection>
  );
}

function PhotoSection({
  photos,
  photoUrls,
  onOpen
}: {
  photos: NonNullable<ReportDetail["report_photos"]>;
  photoUrls: Record<string, string>;
  onOpen: (photo: ReportPhoto, signedUrl: string, index: number) => void;
}) {
  return (
    <section className="card detail-section detail-section-wide">
      <div className="detail-section-title">
        <h2>Fotoğraflar</h2>
        <StatusBadge label={`${photos.length} adet`} tone="neutral" />
      </div>
      {photos.length === 0 ? (
        <EmptyState className="compact">Fotoğraf eklenmemiş.</EmptyState>
      ) : (
        <div className="report-photo-grid">
          {photos.map((photo, index) => {
            const path = photo.storage_path ?? "";
            const signedUrl = photoUrls[path];

            return (
              <button
                className="report-photo-card"
                disabled={!signedUrl}
                key={photo.id ?? path}
                onClick={() => signedUrl && onOpen(photo, signedUrl, index)}
                type="button"
              >
                {signedUrl ? (
                  <span className="report-photo-image">
                    <Image
                      alt={photo.caption || `Rapor fotoğrafı ${index + 1}`}
                      height={220}
                      sizes="(max-width: 980px) 50vw, 220px"
                      src={signedUrl}
                      unoptimized
                      width={320}
                    />
                    <span className="photo-open-badge">
                      <Maximize2 aria-hidden size={14} />
                      Aç
                    </span>
                  </span>
                ) : (
                  <span className="report-photo-placeholder">
                    <ImageIcon aria-hidden size={26} />
                  </span>
                )}
                <span className="report-photo-meta">
                  <strong>{photo.caption || "Açıklama yok"}</strong>
                  <span>{photo.category || `Fotoğraf ${index + 1}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: ActivePhoto; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.querySelector<HTMLElement>("[aria-label='Fotoğrafı kapat']")?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    ) ?? []);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="photo-lightbox" onClick={onClose} role="presentation">
      <div
        aria-label={`Rapor fotoğrafı ${photo.index + 1}`}
        aria-modal="true"
        className="photo-lightbox-panel"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
      >
        <div className="photo-lightbox-top">
          <div>
            <strong>{photo.caption || `Fotoğraf ${photo.index + 1}`}</strong>
            <span>{[photo.category, dateTime(photo.created_at)].filter((value) => value && value !== "-").join(" · ") || "Rapor fotoğrafı"}</span>
          </div>
          <div className="photo-lightbox-actions">
            <a className="button secondary" href={photo.signedUrl} rel="noreferrer" target="_blank">
              Yeni Sekmede Aç
            </a>
            <IconButton
              aria-label="Fotoğrafı kapat"
              icon={<X aria-hidden size={20} />}
              onClick={onClose}
              variant="subtle"
            />
          </div>
        </div>
        <div className="photo-lightbox-image">
          <Image
            alt={photo.caption || `Rapor fotoğrafı ${photo.index + 1}`}
            fill
            sizes="92vw"
            src={photo.signedUrl}
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}

function reportToEditValues(report: ReportDetail, equipment: Equipment[]): ReportFormValues {
  const workItems = normalizeWorkItems(
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
  const primaryWorkItem = compactWorkItems(workItems)[0] ?? workItems[0] ?? emptyWorkItem();
  const equipmentIds = equipmentIdsFromValue(report.used_equipment_ids, textValue(report.used_equipment), equipment);

  return {
    ...emptyReportFormValues,
    client_request_id: textValue(report.client_request_id),
    report_date: dateInputValue(report.report_date),
    company_id: textValue(report.company_id),
    company_contact_name: textValue(report.company_contact_name),
    company_contact_phone: textValue(report.company_contact_phone),
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: textValue(report.machine_brand_model),
    customer_machine_name: textValue(report.customer_machine_name),
    belt_id: primaryWorkItem.belt_id || textValue(report.belt_id),
    visiting_personnel_ids: [],
    vehicle_plate: textValue(report.vehicle_plate),
    vehicle_start_km: textValue(report.vehicle_start_km),
    vehicle_end_km: textValue(report.vehicle_end_km),
    used_equipment_ids: equipmentIds,
    used_equipment: equipmentNamesFromIds(equipmentIds, equipment) || textValue(report.used_equipment),
    workshop_departure_at: textValue(report.workshop_departure_at),
    customer_arrival_at: textValue(report.customer_arrival_at),
    customer_departure_at: textValue(report.customer_departure_at),
    factory_return_at: textValue(report.factory_return_at),
    product_code: textValue(report.product_code),
    product_measure: textValue(report.product_measure),
    product_width: primaryWorkItem.product_width || textValue(report.product_width),
    product_length: primaryWorkItem.product_length || textValue(report.product_length),
    product_quantity: primaryWorkItem.product_quantity || textValue(report.product_quantity),
    product_item_coil_code: textValue(report.product_item_coil_code),
    product_types: arrayValue(report.product_types) as ReportFormValues["product_types"],
    product_type_other: textValue(report.product_type_other),
    process_actions: arrayValue(report.process_actions) as ReportFormValues["process_actions"],
    edge_cut_method: textValue(report.edge_cut_method) as ReportFormValues["edge_cut_method"],
    process_action_other: textValue(report.process_action_other),
    mechanical_connection: textValue(report.mechanical_connection),
    profile_material: textValue(report.profile_material),
    removed_belt_years: textValue(report.removed_belt_years),
    replacement_reasons: arrayValue(report.replacement_reasons),
    replacement_reason_other: textValue(report.replacement_reason_other),
    has_test_piece: textValue(report.has_test_piece) as ReportFormValues["has_test_piece"],
    test_status: textValue(report.test_status) as ReportFormValues["test_status"],
    observer_personnel_id: textValue(report.observer_personnel_id),
    observer_external_name: textValue(report.observer_external_name),
    press_start_time: textValue(report.press_start_time).slice(0, 5),
    press_end_time: textValue(report.press_end_time).slice(0, 5),
    power_outage: textValue(report.power_outage) as ReportFormValues["power_outage"],
    pressure_drop: textValue(report.pressure_drop) as ReportFormValues["pressure_drop"],
    heat_balance_ok: textValue(report.heat_balance_ok) as ReportFormValues["heat_balance_ok"],
    process_description: textValue(report.process_description),
    billing_status: textValue(report.billing_status) as ReportFormValues["billing_status"],
    technical_details: textValue(report.technical_details),
    tensioning_done: textValue(report.tensioning_done) as ReportFormValues["tensioning_done"],
    customer_will_tension: booleanValue(report.customer_will_tension),
    customer_tensioned_auto: booleanValue(report.customer_tensioned_auto),
    pressure_value: textValue(report.pressure_value),
    pressure_unit: textValue(report.pressure_unit),
    pre_tension_percent: textValue(report.pre_tension_percent),
    line_delivered_running: booleanValue(report.line_delivered_running),
    blanket_roughening_info_given: textValue(report.blanket_roughening_info_given) as ReportFormValues["blanket_roughening_info_given"],
    blanket_info_person_name: textValue(report.blanket_info_person_name)
  } as ReportFormValues;
}

function reportUpdatePayload(values: ReportFormValues) {
  const nullable = (value: string) => value.trim() || null;
  const workItems = compactWorkItems(normalizeWorkItems(values.work_items));
  const primaryWorkItem = workItems[0] ?? emptyWorkItem();
  const productCodes = Array.from(new Set(workItems.map((item) => item.belt_code).filter(Boolean)));

  return {
    report_date: values.report_date,
    company_contact_name: nullable(values.company_contact_name),
    company_contact_phone: nullable(values.company_contact_phone),
    line_name: nullable(primaryWorkItem.line_name || values.line_name),
    work_items: workItems,
    machine_brand_model: nullable(values.machine_brand_model),
    customer_machine_name: nullable(values.customer_machine_name),
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
    product_item_coil_code: nullable(values.product_item_coil_code),
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

function emptyWorkItem(): ReportWorkItem {
  return {
    belt_code: "",
    belt_id: "",
    belt_name: "",
    line_name: "",
    product_length: "",
    product_quantity: "",
    product_width: ""
  };
}

function normalizeWorkItems(items: ReportWorkItem[]) {
  return items.length > 0 ? items : [emptyWorkItem()];
}

function syncPrimaryWorkItem<T extends ReportFormValues>(values: T): T {
  const firstItem = compactWorkItems(values.work_items)[0] ?? values.work_items[0] ?? emptyWorkItem();
  return {
    ...values,
    belt_id: firstItem.belt_id,
    line_name: firstItem.line_name,
    product_length: firstItem.product_length,
    product_quantity: firstItem.product_quantity,
    product_width: firstItem.product_width
  };
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

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return text(report.belt_code_snapshot);
}

function reportProductCodesText(report: Record<string, unknown>) {
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

  if (codes.length > 0) {
    return codes.join(" • ");
  }

  return text(report.product_code || report.belt_code_snapshot);
}

function reportProductMeasurementsText(report: Record<string, unknown>) {
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

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function equipmentIdsFromValue(value: unknown, fallbackText: string, equipment: Equipment[]) {
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

function equipmentNamesFromIds(ids: string[], equipment: Equipment[]) {
  const equipmentById = new Map(equipment.map((item) => [item.id, item]));
  return ids
    .map((id) => equipmentById.get(id)?.name ?? "")
    .filter(Boolean)
    .join(", ");
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : false;
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

function statusText(value: unknown) {
  return value === "SUBMITTED" ? "Gönderildi" : "Taslak";
}

function kmText(start: unknown, end: unknown) {
  const startText = text(start);
  const endText = text(end);
  if (startText === "-" && endText === "-") return "-";
  return `${startText} → ${endText}`;
}

function dateInputValue(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
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
