"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCamera, IconChevronLeft, IconCircleCheck, IconDeviceFloppy, IconPhoto, IconPlus, IconSend, IconTrash, IconX } from "@tabler/icons-react";
import type { Belt, Company, CompanyLine, Equipment, Profile, ReportFormValues, ReportStatus, ReportWorkItem, Vehicle } from "@operations/types";
import { processActions, productTypes, reportFormSchema, type CustomerSignature } from "@operations/validation";
import { CustomerSignatureApproval, SignaturePhotoPreview } from "@/components/customer-signature";
import { Alert, Button, FormField, IconButton, controlClasses } from "@/components/firm-ui";
import { Button as ShadcnButton } from "@/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { Label } from "@/components/shadcn/label";
import { cn } from "@/lib/utils";
import {
  compactReportWorkItems,
  emptyReportWorkItem,
  enrichReportWorkItems,
  formatBeltLabel,
  fromDatetimeLocal,
  normalizeReportWorkItems,
  prepareReportValues,
  replacementReasonOptions,
  toDatetimeLocal,
  workItemBeltCodesText,
  workItemsFromValue,
  type PhotoDraft,
  type SavedPhoto
} from "./report-utils";

const readonlyClasses = "flex min-h-9 items-center rounded-md border bg-muted px-3 py-1 text-sm break-words text-muted-foreground";

export function ReportForm({
  addPhotos,
  assignmentTitle,
  belts,
  companies,
  companyLines,
  equipment,
  loading,
  personnel,
  photos,
  savedPhotos,
  removeSavedPhoto,
  profile,
  readOnly,
  removePhoto,
  submitReport,
  toggleArray,
  toggleEquipment,
  update,
  updatePhotoCaption,
  values,
  vehicles,
  onBack
}: {
  addPhotos: (files: FileList | null) => void;
  assignmentTitle?: string | null;
  belts: Belt[];
  companies: Company[];
  companyLines: CompanyLine[];
  equipment: Equipment[];
  loading: boolean;
  personnel: Profile[];
  photos: PhotoDraft[];
  savedPhotos: SavedPhoto[];
  removeSavedPhoto: (photo: SavedPhoto) => Promise<void>;
  profile: Profile | null;
  readOnly: boolean;
  removePhoto: (localId: string) => void;
  submitReport: (status: ReportStatus, signature?: CustomerSignature) => Promise<void>;
  toggleArray: (
    key: "visiting_personnel_ids" | "product_types" | "process_actions" | "replacement_reasons",
    value: string
  ) => void;
  toggleEquipment: (value: string) => void;
  update: <K extends keyof ReportFormValues>(key: K, value: ReportFormValues[K]) => void;
  updatePhotoCaption: (localId: string, caption: string) => void;
  values: ReportFormValues;
  vehicles: Vehicle[];
  onBack: () => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [validationMessage, setValidationMessage] = useState("");
  const isAssignedReport = Boolean(assignmentTitle);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === values.company_id),
    [companies, values.company_id]
  );
  const selectedCompanyLines = useMemo(
    () => companyLines.filter((line) => line.company_id === values.company_id),
    [companyLines, values.company_id]
  );
  const beltsById = useMemo(
    () => new Map(belts.map((belt) => [belt.id, belt])),
    [belts]
  );
  const formWorkItems = useMemo(
    () => enrichReportWorkItems(
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
    ),
    [
      beltsById,
      values.belt_id,
      values.line_name,
      values.machine_brand_model,
      values.product_item_coil_code,
      values.product_length,
      values.product_quantity,
      values.product_width,
      values.work_items
    ]
  );
  const beltCodesText = workItemBeltCodesText(formWorkItems, values.belt_id, beltsById);

  function updateWorkItems(nextItems: ReportWorkItem[]) {
    const enriched = enrichReportWorkItems(normalizeReportWorkItems(nextItems), beltsById);
    const primaryWorkItem = compactReportWorkItems(enriched)[0] ?? enriched[0] ?? emptyReportWorkItem();
    update("work_items", enriched);
    update("line_name", primaryWorkItem.line_name);
    update("belt_id", primaryWorkItem.belt_id);
    update("machine_brand_model", primaryWorkItem.machine_name);
    update("product_item_coil_code", primaryWorkItem.coil_code);
  }

  function updateReportWorkItem(index: number, key: keyof ReportWorkItem, value: string) {
    const nextItems = normalizeReportWorkItems(formWorkItems).map((item, itemIndex) => {
      if (itemIndex !== index) return item;

      if (key === "belt_id") {
        const belt = beltsById.get(value);
        return {
          ...item,
          belt_id: value,
          belt_code: belt?.code ?? "",
          belt_name: belt?.name ?? ""
        };
      }

      return { ...item, [key]: value };
    });

    updateWorkItems(nextItems);
  }

  function addWorkItem() {
    updateWorkItems([...normalizeReportWorkItems(formWorkItems), emptyReportWorkItem()]);
  }

  function removeWorkItem(index: number) {
    const nextItems = normalizeReportWorkItems(formWorkItems).filter((_, itemIndex) => itemIndex !== index);
    updateWorkItems(nextItems.length > 0 ? nextItems : [emptyReportWorkItem()]);
  }

  useEffect(() => {
    if (!selectedCompany) return;
    update("company_contact_name", selectedCompany.contact_name ?? "");
    update("company_contact_phone", selectedCompany.contact_phone ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany?.id]);

  useEffect(() => {
    const validLineNames = new Set(selectedCompanyLines.map((line) => line.name));
    const nextItems = formWorkItems.map((item) => {
      if (!values.company_id) return { ...item, line_name: "" };
      if (item.line_name && !validLineNames.has(item.line_name)) return { ...item, line_name: "" };
      return item;
    });
    const changed = nextItems.some((item, index) => item.line_name !== formWorkItems[index]?.line_name);

    if (changed) {
      updateWorkItems(nextItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formWorkItems, selectedCompanyLines, values.company_id]);

  return (
    <>
      <div>
        <Button icon={<IconChevronLeft aria-hidden />} onClick={onBack} variant="secondary">
          Geri
        </Button>
      </div>
      {isAssignedReport ? (
        <Alert tone="info">{assignmentTitle} için ön bilgiler dolduruldu. İşlem sonrası bilgileri tamamlayıp raporu gönderin.</Alert>
      ) : null}
      {companies.length === 0 ? (
        <Alert tone="error">Firma bulunamadı. Yetkili amirden firma eklemesini isteyin.</Alert>
      ) : null}

      <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0" disabled={readOnly || loading} hidden={reviewing} style={reviewing ? { display: "none" } : undefined}>
        <FormCard title="Genel Bilgiler">
          <FormField label="Rapor Tarihi">
            <input type="date" value={values.report_date} onChange={(event) => update("report_date", event.target.value)} />
          </FormField>
          <FormField label="Müşteri Ünvanı ve Adresi / Firma">
            <select value={values.company_id} onChange={(event) => update("company_id", event.target.value)}>
              <option value="">Firma seçin</option>
              {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </FormField>
          <TextField label="Yetkili Kişi" value={values.company_contact_name} onChange={(value) => update("company_contact_name", value)} />
          <TextField label="Yetkili Telefon" value={values.company_contact_phone} onChange={(value) => update("company_contact_phone", value)} />
          <ReportWorkItemsField
            belts={belts}
            companySelected={Boolean(values.company_id)}
            items={formWorkItems}
            lines={selectedCompanyLines}
            onAdd={addWorkItem}
            onRemove={removeWorkItem}
            onUpdate={updateReportWorkItem}
          />
          <FormField label="Bant Kodu">
            <div className={readonlyClasses}>{beltCodesText}</div>
          </FormField>
          <FormField label="Formu Dolduran Personel">
            <div className={readonlyClasses}>{profile ? `${profile.first_name} ${profile.last_name}` : "-"}</div>
          </FormField>
          <FormField label="Araç Alış KM">
            <input
              inputMode="numeric"
              onChange={(event) => update("vehicle_start_km", event.target.value)}
              value={values.vehicle_start_km}
            />
          </FormField>
          <FormField label="Dönüş Araç Kilometresi">
            <input
              inputMode="numeric"
              onChange={(event) => update("vehicle_end_km", event.target.value)}
              value={values.vehicle_end_km}
            />
          </FormField>
          <SelectionPicker
            label="Giden Personel"
            options={personnel
              .filter((item) => item.id !== profile?.id)
              .map((item) => ({ label: `${item.first_name} ${item.last_name}`, value: item.id }))}
            selected={values.visiting_personnel_ids}
            onToggle={(value) => toggleArray("visiting_personnel_ids", value)}
          />
          <FormField label="Kullanılan Araç Plakası">
            <select value={values.vehicle_plate} onChange={(event) => update("vehicle_plate", event.target.value)}>
              <option value="">Plaka seçin</option>
              {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>)}
            </select>
          </FormField>
          <SelectionPicker
            className="md:col-span-2"
            label="Kullanılan Makine ve Ekipmanları"
            options={equipment.map((item) => ({ label: item.name, value: item.id }))}
            selected={values.used_equipment_ids}
            onToggle={toggleEquipment}
          />
        </FormCard>

        <FormCard title="Zaman Bilgileri">
          <DateTimeField label="Atölyeden Çıkış Tarih Saati" value={values.workshop_departure_at} onChange={(value) => update("workshop_departure_at", value)} />
          <DateTimeField label="Müşteriye Varış Tarih Saati" value={values.customer_arrival_at} onChange={(value) => update("customer_arrival_at", value)} />
          <DateTimeField label="Müşteriden Çıkış Tarih Saati" value={values.customer_departure_at} onChange={(value) => update("customer_departure_at", value)} />
          <DateTimeField label="Eve / Ofise Giriş Tarih Saati" value={values.factory_return_at} onChange={(value) => update("factory_return_at", value)} />
        </FormCard>

        <FormCard title="Ürün Bilgileri">
          <ProductItemsField items={formWorkItems} onUpdate={updateReportWorkItem} />
          <CheckPicker
            className="md:col-span-2"
            label="İşlem Görecek Ürün Türü"
            options={productTypes.map((value) => ({ label: value, value }))}
            selected={values.product_types}
            onToggle={(value) => toggleArray("product_types", value)}
          />
          {values.product_types.includes("Diğer") ? (
            <TextField label="Diğer Açıklama" value={values.product_type_other} onChange={(value) => update("product_type_other", value)} />
          ) : null}
        </FormCard>

        <FormCard title="Yapılan İşlemler">
          <CheckPicker
            className="md:col-span-2"
            label="Yapılacak İşlem"
            options={processActions.map((value) => ({ label: value, value }))}
            selected={values.process_actions}
            onToggle={(value) => toggleArray("process_actions", value)}
          />
          {values.process_actions.includes("Kenar Kesim") ? (
            <RadioField
              label="Kenar Kesim"
              options={["Makine ile", "El ile"]}
              value={values.edge_cut_method}
              onChange={(value) => update("edge_cut_method", value as ReportFormValues["edge_cut_method"])}
            />
          ) : null}
          {values.process_actions.includes("Diğer") ? (
            <TextField label="Diğer İşlem Açıklama" value={values.process_action_other} onChange={(value) => update("process_action_other", value)} />
          ) : null}
          <TextField className="md:col-span-2" multiline label="Kullanılan Mekanik Bağlantı Tipi ve Miktarı" value={values.mechanical_connection} onChange={(value) => update("mechanical_connection", value)} />
          <TextField className="md:col-span-2" multiline label="Kullanılan Profil Tipi ve Miktarı" value={values.profile_material} onChange={(value) => update("profile_material", value)} />
          <TextField label="Kaç Yıldır Çalışıyordu?" value={values.removed_belt_years} onChange={(value) => update("removed_belt_years", value)} />
          <CheckPicker
            className="md:col-span-2"
            label="Değiştirme Sebebi Nedir?"
            options={replacementReasonOptions.map((value) => ({ label: value, value }))}
            selected={values.replacement_reasons}
            onToggle={(value) => toggleArray("replacement_reasons", value)}
          />
          {values.replacement_reasons.includes("Diğer") ? (
            <TextField label="Diğer Sebep" value={values.replacement_reason_other} onChange={(value) => update("replacement_reason_other", value)} />
          ) : null}
        </FormCard>

        <FormCard title="Test ve Pres Bilgileri">
          <RadioField label="Ürün Test Parçası Var mı?" options={["Var", "Yok"]} value={values.has_test_piece} onChange={(value) => update("has_test_piece", value as ReportFormValues["has_test_piece"])} />
          <RadioField label="Test Durumu" options={["Test Yapıldı", "Test Yapılmadı"]} value={values.test_status} onChange={(value) => update("test_status", value as ReportFormValues["test_status"])} />
          <FormField label="Gözlemci Personel">
            <select value={values.observer_personnel_id} onChange={(event) => update("observer_personnel_id", event.target.value)}>
              <option value="">Personel seçilmedi</option>
              {personnel.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name}</option>)}
            </select>
          </FormField>
          <TextField label="Dış Personel Açıklama" value={values.observer_external_name} onChange={(value) => update("observer_external_name", value)} />
          <FormField label="Pres İşlemi Başlama Saati">
            <input type="time" value={values.press_start_time} onChange={(event) => update("press_start_time", event.target.value)} />
          </FormField>
          <FormField label="Pres İşlemi Bitiş Saati">
            <input type="time" value={values.press_end_time} onChange={(event) => update("press_end_time", event.target.value)} />
          </FormField>
          <RadioField label="Enerji Kesintisi Oldu mu?" options={["Hayır", "Evet"]} value={values.power_outage} onChange={(value) => update("power_outage", value as ReportFormValues["power_outage"])} />
          <RadioField label="Basınç Düşmesi Oldu mu?" options={["Hayır", "Evet"]} value={values.pressure_drop} onChange={(value) => update("pressure_drop", value as ReportFormValues["pressure_drop"])} />
          <RadioField label="Üst Isı Alt Isı Dengesi Uygun mu?" options={["Hayır", "Evet"]} value={values.heat_balance_ok} onChange={(value) => update("heat_balance_ok", value as ReportFormValues["heat_balance_ok"])} />
        </FormCard>

        <FormCard title="Teknik Detaylar">
          <TextField className="md:col-span-2" multiline label="Yapılan İşlem Açıklama" value={values.process_description} onChange={(value) => update("process_description", value)} />
          <RadioField
            label="Faturalandırma Durumu"
            options={["Yapılan İşlem Tarafınıza Fatura Edilecektir", "Bedelsiz İşlem Yapılmıştır"]}
            value={values.billing_status}
            onChange={(value) => update("billing_status", value as ReportFormValues["billing_status"])}
          />
          <TextField className="md:col-span-2" multiline label="Teknik Detaylar" value={values.technical_details} onChange={(value) => update("technical_details", value)} />
        </FormCard>

        <FormCard title="Gerdirme ve Blanket">
          <RadioField label="Gerdirme İşlemi Yapıldı mı?" options={["Evet", "Hayır"]} value={values.tensioning_done} onChange={(value) => update("tensioning_done", value as ReportFormValues["tensioning_done"])} />
          <ToggleField label="Müşteri Daha Sonra Kendisi Yapacak" value={values.customer_will_tension} onChange={(value) => update("customer_will_tension", value)} />
          <ToggleField label="Gerdirme İşlemini Müşteri Kendisi Otomatik Sistemde Yaptı" value={values.customer_tensioned_auto} onChange={(value) => update("customer_tensioned_auto", value)} />
          <TextField label="Uygulanan Basınç Miktarı" value={values.pressure_value} onChange={(value) => update("pressure_value", value)} />
          <TextField label="Birim" value={values.pressure_unit} onChange={(value) => update("pressure_unit", value)} />
          <TextField inputMode="numeric" label="Ön Gerdirme Değeri %" value={values.pre_tension_percent} onChange={(value) => update("pre_tension_percent", value)} />
          <ToggleField label="Hat Çalışır Durumda Teslim Edildi" value={values.line_delivered_running} onChange={(value) => update("line_delivered_running", value)} />
          <RadioField label="Blanketler İçin Pürüzlendirme Bilgisi Verildi mi?" options={["Evet", "Hayır"]} value={values.blanket_roughening_info_given} onChange={(value) => update("blanket_roughening_info_given", value as ReportFormValues["blanket_roughening_info_given"])} />
          <TextField label="Bilgilendirme Yapılan Kişi Ad Soyad" value={values.blanket_info_person_name} onChange={(value) => update("blanket_info_person_name", value)} />
        </FormCard>

        <Card>
          <CardHeader>
            <CardTitle>Fotoğraflar</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <ShadcnButton asChild size="sm">
                <label>
                  <IconCamera aria-hidden />
                  Kamera
                  <input
                    accept="image/*"
                    capture="environment"
                    hidden
                    type="file"
                    onChange={(event) => {
                      addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </ShadcnButton>
              <ShadcnButton asChild size="sm" variant="outline">
                <label>
                  <IconPhoto aria-hidden />
                  Galeri
                  <input
                    accept="image/*"
                    hidden
                    multiple
                    type="file"
                    onChange={(event) => {
                      addPhotos(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </ShadcnButton>
            </div>
            {photos.length === 0 && savedPhotos.length === 0 ? <p className="text-sm text-muted-foreground">Fotoğraf seçilmedi.</p> : null}
            {savedPhotos.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {savedPhotos.map((photo) => (
                  <div className="grid content-start gap-2" key={photo.id}>
                    <SignaturePhotoPreview caption={photo.caption ?? "Kayıtlı fotoğraf"} url={photo.url} />
                    <div>
                      <Button disabled={loading} icon={<IconTrash aria-hidden />} onClick={() => removeSavedPhoto(photo)} variant="subtle">Kayıtlı fotoğrafı kaldır</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {photos.length > 0 ? (
              <ItemGroup className="gap-2">
                {photos.map((photo) => (
                  <Item className="flex-nowrap items-end" key={photo.localId} size="sm" variant="outline">
                    <ItemContent className={cn("min-w-0", controlClasses)}>
                      <ItemTitle className="w-full min-w-0 break-all">{photo.file.name}</ItemTitle>
                      <input
                        aria-label="Fotoğraf açıklaması"
                        placeholder="Açıklama"
                        value={photo.caption}
                        onChange={(event) => updatePhotoCaption(photo.localId, event.target.value)}
                      />
                    </ItemContent>
                    <ItemActions>
                      <Button icon={<IconTrash aria-hidden />} onClick={() => removePhoto(photo.localId)} variant="subtle">
                        Sil
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            ) : null}
          </CardContent>
        </Card>

        {validationMessage ? <Alert tone="error">{validationMessage}</Alert> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button className="h-10 sm:h-8" disabled={loading} icon={<IconDeviceFloppy aria-hidden />} onClick={() => submitReport("DRAFT")} variant="secondary">
            Taslak Kaydet
          </Button>
          <Button className="h-10 sm:h-8" disabled={loading || companies.length === 0} icon={<IconSend aria-hidden />} onClick={() => {
            const parsed = reportFormSchema.safeParse(prepareReportValues(values, belts, equipment));
            if (!parsed.success) { setValidationMessage(parsed.error.issues[0]?.message ?? "Formu kontrol edin."); return; }
            setValidationMessage(""); setReviewing(true); window.scrollTo({ top: 0, behavior: "instant" });
          }}>
            {loading ? "Kaydediliyor" : "Teslim ve imza"}
          </Button>
        </div>
      </fieldset>
      {reviewing ? <CustomerSignatureApproval companyName={selectedCompany?.name ?? "Firma"} reportDate={values.report_date}
        initialName={values.company_contact_name} loading={loading} onBack={() => setReviewing(false)}
        onSubmit={(signature) => submitReport("SUBMITTED", signature)}
        summary={<>
          <span>{values.process_actions.join(" · ")}</span>
          <span>{values.process_description || "İşlem açıklaması girilmedi."}</span>
          <span>{values.work_items.map((item) => [item.line_name, item.belt_code || item.belt_name, item.product_quantity && item.product_quantity + " adet"].filter(Boolean).join(" / ")).join(" · ")}</span>
          <span>{values.line_delivered_running ? "Hat çalışır durumda teslim edildi." : "Hat çalışır teslim olarak işaretlenmedi."}</span>
          {values.technical_details ? <span>{values.technical_details}</span> : null}
          {values.billing_status ? <strong className="font-medium">{values.billing_status}</strong> : null}
          <span>{savedPhotos.length + photos.length} fotoğraf · Raporun tamamını incelemek için “Rapora dön” seçeneğini kullanın.</span>
          {savedPhotos.map((photo) => <SignaturePhotoPreview key={photo.id} url={photo.url} caption={photo.caption ?? "Kayıtlı fotoğraf"} />)}
          {photos.map((photo) => <SignaturePhotoPreview key={photo.localId} file={photo.file} caption={photo.caption || photo.file.name} />)}
        </>} /> : null}
    </>
  );
}

// Form bolumu: shadcn Card + iki sutunlu alan izgarasi (app/reports/[id] duzenleme formu ile ayni alanlar).
function FormCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function TextField({
  className,
  inputMode,
  label,
  multiline = false,
  value,
  onChange
}: {
  className?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  multiline?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField className={className} label={label}>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input inputMode={inputMode} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </FormField>
  );
}

function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <FormField label={label}>
      <input type="datetime-local" value={toDatetimeLocal(value)} onChange={(event) => onChange(fromDatetimeLocal(event.target.value))} />
    </FormField>
  );
}

function RadioField({
  label,
  options,
  value,
  onChange
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seçilmedi</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </FormField>
  );
}

function CheckRow({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span>{label}</span>
    </label>
  );
}

// app/reports/[id] "EditCheckPicker" ile ayni: satir ici onay kutulari.
function CheckPicker({
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
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {options.map((option) => (
          <CheckRow checked={selected.includes(option.value)} key={option.value} label={option.label} onToggle={() => onToggle(option.value)} />
        ))}
      </div>
    </FormField>
  );
}

// app/reports/[id] "EditSelectionPicker" ile ayni: acilir secim listesi.
function SelectionPicker({
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
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);

  return (
    <FormField className={className} label={label}>
      <details className="rounded-md border shadow-xs">
        <summary className="flex min-h-9 cursor-pointer items-center px-3 py-1 text-sm">{selectedLabels.length > 0 ? selectedLabels.join(", ") : options.length > 0 ? "Seçim yapın" : "Seçilebilir kayıt yok"}</summary>
        <div className="grid gap-1 border-t p-2">
          {options.map((option) => (
            <label className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent" key={option.value}>
              <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => onToggle(option.value)} />
              <span>{option.label}</span>
              {selected.includes(option.value) ? <IconCircleCheck aria-hidden className="ml-auto size-4" /> : null}
            </label>
          ))}
        </div>
      </details>
    </FormField>
  );
}

function ProductItemsField({
  items,
  onUpdate
}: {
  items: ReportWorkItem[];
  onUpdate: (index: number, key: keyof ReportWorkItem, value: string) => void;
}) {
  const rows = normalizeReportWorkItems(items);

  return (
    <div className="grid gap-2 md:col-span-2">
      <Label>Ürün Detayları</Label>
      <div className={cn("grid gap-4 md:gap-2", controlClasses)}>
        <div className="hidden gap-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-6">
          <span>Ürün Kodu</span>
          <span>Makine Adı</span>
          <span>Item / Coil Kodu</span>
          <span>En</span>
          <span>Boy</span>
          <span>Miktar</span>
        </div>
        {rows.map((item, index) => (
          <div className="grid grid-cols-2 items-center gap-2 md:grid-cols-6" key={index}>
            <div className={cn(readonlyClasses, "col-span-2 md:col-span-1")}>{item.belt_code || "Bant kodu seçin"}</div>
            <input
              aria-label={`${item.belt_code || index + 1}. satır makine adı`}
              onChange={(event) => onUpdate(index, "machine_name", event.target.value)}
              placeholder="Makine adı"
              value={item.machine_name}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır item veya coil kodu`}
              onChange={(event) => onUpdate(index, "coil_code", event.target.value)}
              placeholder="Item / Coil kodu"
              value={item.coil_code}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır en`}
              onChange={(event) => onUpdate(index, "product_width", event.target.value)}
              placeholder="En"
              value={item.product_width}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır boy`}
              onChange={(event) => onUpdate(index, "product_length", event.target.value)}
              placeholder="Boy"
              value={item.product_length}
            />
            <input
              aria-label={`${item.belt_code || index + 1}. satır miktar`}
              className="col-span-2 md:col-span-1"
              inputMode="numeric"
              onChange={(event) => onUpdate(index, "product_quantity", event.target.value)}
              placeholder="Miktar"
              value={item.product_quantity}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportWorkItemsField({
  belts,
  companySelected,
  items,
  lines,
  onAdd,
  onRemove,
  onUpdate
}: {
  belts: Belt[];
  companySelected: boolean;
  items: ReportWorkItem[];
  lines: CompanyLine[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, key: keyof ReportWorkItem, value: string) => void;
}) {
  const rows = normalizeReportWorkItems(items);

  return (
    <div className="grid gap-2 md:col-span-2">
      <Label>İş Kalemleri</Label>
      <div className={cn("grid gap-2", controlClasses)}>
        {rows.map((item, index) => (
          <div className="flex items-start gap-2" key={index}>
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2">
              <select
                aria-label={`${index + 1}. iş kalemi hat`}
                disabled={!companySelected}
                onChange={(event) => onUpdate(index, "line_name", event.target.value)}
                value={item.line_name}
              >
                <option value="">{companySelected ? "Hat seçin" : "Önce firma seçin"}</option>
                {lines.map((line) => <option key={line.id} value={line.name}>{line.name}</option>)}
              </select>
              <select aria-label={`${index + 1}. iş kalemi bant kodu`} onChange={(event) => onUpdate(index, "belt_id", event.target.value)} value={item.belt_id}>
                <option value="">Bant kodu seçin</option>
                {belts.map((belt) => <option key={belt.id} value={belt.id}>{formatBeltLabel(belt)}</option>)}
              </select>
            </div>
            {rows.length > 1 ? (
              <IconButton aria-label={`${index + 1}. iş kalemini kaldır`} icon={<IconX aria-hidden />} onClick={() => onRemove(index)} variant="subtle" />
            ) : null}
          </div>
        ))}
      </div>
      <Button className="w-fit" icon={<IconPlus aria-hidden />} onClick={onAdd} variant="secondary">
        Kalem Ekle
      </Button>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 self-end text-sm md:min-h-9">
      <Checkbox checked={value} onCheckedChange={(checked) => onChange(checked === true)} />
      <span>{label}</span>
    </label>
  );
}
