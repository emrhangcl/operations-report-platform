"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, ClipboardCheck, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type {
  Belt,
  Company,
  CompanyLine,
  InstallationAssignment,
  InstallationAssignmentStatus,
  Profile,
  ReportWorkItem,
  Vehicle
} from "@tunca/types";
import { processActions, productTypes } from "@tunca/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

type AssignmentForm = {
  title: string;
  assigned_to_profile_id: string;
  scheduled_date: string;
  notes: string;
  company_id: string;
  company_contacts: CompanyContactDraft[];
  company_contact_name: string;
  company_contact_phone: string;
  line_name: string;
  work_items: ReportWorkItem[];
  machine_brand_model: string;
  belt_id: string;
  vehicle_plate: string;
  used_equipment: string;
  product_code: string;
  product_measure: string;
  product_width: string;
  product_length: string;
  product_quantity: string;
  product_item_coil_code: string;
  product_types: string[];
  product_type_other: string;
  process_actions: string[];
  edge_cut_method: string;
  process_action_other: string;
  removed_belt_years: string;
  replacement_reasons: string[];
  replacement_reason_other: string;
  billing_status: string;
};

type CompanyContactDraft = {
  name: string;
  phone: string;
};

const emptyForm: AssignmentForm = {
  title: "",
  assigned_to_profile_id: "",
  scheduled_date: "",
  notes: "",
  company_id: "",
  company_contacts: [{ name: "", phone: "" }],
  company_contact_name: "",
  company_contact_phone: "",
  line_name: "",
  work_items: [{ line_name: "", belt_id: "", belt_code: "", belt_name: "" }],
  machine_brand_model: "",
  belt_id: "",
  vehicle_plate: "",
  used_equipment: "",
  product_code: "",
  product_measure: "",
  product_width: "",
  product_length: "",
  product_quantity: "",
  product_item_coil_code: "",
  product_types: [],
  product_type_other: "",
  process_actions: [],
  edge_cut_method: "",
  process_action_other: "",
  removed_belt_years: "",
  replacement_reasons: [],
  replacement_reason_other: "",
  billing_status: ""
};

const replacementReasonOptions = [
  "Mekanik sıkıntılardan dolayı",
  "Ek yeri açtı",
  "Sorun yoktu, bant ortalama ömrü doldu",
  "Diğer"
];

const statusLabels: Record<InstallationAssignmentStatus, string> = {
  ASSIGNED: "Atandı",
  IN_PROGRESS: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  CANCELLED: "İptal"
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<InstallationAssignment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [companyLines, setCompanyLines] = useState<CompanyLine[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const personnelById = useMemo(
    () => new Map(personnel.map((profile) => [profile.id, profile])),
    [personnel]
  );

  const selectedCompanyLines = useMemo(
    () => companyLines.filter((line) => line.company_id === form.company_id),
    [companyLines, form.company_id]
  );

  const beltsById = useMemo(
    () => new Map(belts.map((belt) => [belt.id, belt])),
    [belts]
  );
  const productCodes = useMemo(
    () => workItemProductCodes(form.work_items, beltsById),
    [beltsById, form.work_items]
  );

  async function loadLookups() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const [companyRows, beltRows, lineRows, vehicleRows, personnelRows] = await Promise.all([
      supabase.from("companies").select("*").eq("is_active", true).order("name"),
      supabase.from("belts").select("*").eq("is_active", true).order("code"),
      supabase.from("company_lines").select("*").order("name"),
      supabase.from("vehicles").select("*").order("plate"),
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "PERSONNEL")
        .eq("is_active", true)
        .order("first_name")
    ]);

    setCompanies((companyRows.data ?? []) as Company[]);
    setBelts((beltRows.data ?? []) as Belt[]);
    setCompanyLines((lineRows.data ?? []) as CompanyLine[]);
    setVehicles((vehicleRows.data ?? []) as Vehicle[]);
    setPersonnel((personnelRows.data ?? []) as Profile[]);
  }

  async function loadAssignments() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("installation_assignments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setMessage("Montaj atamaları alınamadı.");
      return;
    }

    setAssignments((data ?? []) as InstallationAssignment[]);
  }

  useEffect(() => {
    loadLookups().catch(() => setMessage("Seçim listeleri alınamadı."));
    loadAssignments().catch(() => setMessage("Montaj atamaları alınamadı."));
  }, []);

  function update<K extends keyof AssignmentForm>(key: K, value: AssignmentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateCompany(companyId: string) {
    const company = companies.find((item) => item.id === companyId);
    const contacts = contactsFromFallback(company?.contact_name ?? "", company?.contact_phone ?? "");
    setForm((current) => ({
      ...current,
      company_id: companyId,
      company_contacts: contacts,
      company_contact_name: contacts[0]?.name ?? "",
      company_contact_phone: contacts[0]?.phone ?? "",
      line_name: "",
      work_items: [emptyWorkItem()],
      belt_id: ""
    }));
  }

  function updateContact(index: number, key: keyof CompanyContactDraft, value: string) {
    setForm((current) => {
      const contacts = normalizeContacts(
        current.company_contacts.map((contact, contactIndex) =>
          contactIndex === index ? { ...contact, [key]: value } : contact
        )
      );
      return syncPrimaryContact({ ...current, company_contacts: contacts });
    });
  }

  function addContact() {
    setForm((current) => ({
      ...current,
      company_contacts: [...normalizeContacts(current.company_contacts), { name: "", phone: "" }]
    }));
  }

  function removeContact(index: number) {
    setForm((current) => {
      const nextContacts = normalizeContacts(current.company_contacts.filter((_, contactIndex) => contactIndex !== index));
      return syncPrimaryContact({
        ...current,
        company_contacts: nextContacts.length > 0 ? nextContacts : [{ name: "", phone: "" }]
      });
    });
  }

  function updateWorkItem(index: number, key: keyof ReportWorkItem, value: string) {
    setForm((current) => {
      const items = normalizeWorkItems(current.work_items).map((item, itemIndex) => {
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

      return syncPrimaryWorkItem({ ...current, work_items: items });
    });
  }

  function addWorkItem() {
    setForm((current) =>
      syncPrimaryWorkItem({
        ...current,
        work_items: [...normalizeWorkItems(current.work_items), emptyWorkItem()]
      })
    );
  }

  function removeWorkItem(index: number) {
    setForm((current) => {
      const nextItems = normalizeWorkItems(current.work_items).filter((_, itemIndex) => itemIndex !== index);
      return syncPrimaryWorkItem({
        ...current,
        work_items: nextItems.length > 0 ? nextItems : [emptyWorkItem()]
      });
    });
  }

  function toggleArray(key: "product_types" | "process_actions" | "replacement_reasons", value: string) {
    const current = form[key];
    update(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!form.assigned_to_profile_id) {
      setMessage("Atanacak personeli seçin.");
      return;
    }

    if (!form.company_id) {
      setMessage("Firma seçimi zorunludur.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      const primaryWorkItem = compactWorkItems(form.work_items)[0] ?? emptyWorkItem();
      const payload = {
        title: form.title.trim(),
        assigned_to_profile_id: form.assigned_to_profile_id,
        scheduled_date: form.scheduled_date || null,
        notes: form.notes.trim() || null,
        company_id: form.company_id,
        line_name: primaryWorkItem.line_name.trim() || null,
        report_values: buildReportValues(form, belts)
      };

      const request = editingId
        ? supabase.from("installation_assignments").update(payload).eq("id", editingId)
        : supabase.from("installation_assignments").insert(payload);

      const { error } = await request;

      if (error) {
        setMessage("Montaj ataması kaydedilemedi.");
        return;
      }

      resetForm();
      await loadAssignments();
      setMessage(editingId ? "Montaj ataması güncellendi." : "Montaj ataması oluşturuldu.");
    } finally {
      setLoading(false);
    }
  }

  function edit(assignment: InstallationAssignment) {
    setEditingId(assignment.id);
    setForm(formFromAssignment(assignment));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function setStatus(assignment: InstallationAssignment, status: InstallationAssignmentStatus) {
    const label = status === "CANCELLED" ? "iptal edilsin" : "güncellensin";
    if (!confirm(`"${assignment.title}" ${label} mi?`)) return;

    setLoading(true);
    setMessage("");
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      const { error } = await supabase
        .from("installation_assignments")
        .update({ status })
        .eq("id", assignment.id);

      if (error) {
        setMessage("Montaj durumu güncellenemedi.");
        return;
      }

      await loadAssignments();
      setMessage("Montaj durumu güncellendi.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(assignment: InstallationAssignment) {
    if (!confirm(`"${assignment.title}" kalıcı olarak silinsin mi?`)) return;

    setLoading(true);
    setMessage("");
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      const { error } = await supabase
        .from("installation_assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) {
        setMessage("Montaj ataması silinemedi.");
        return;
      }

      await loadAssignments();
      setMessage("Montaj ataması silindi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Montaj Atamaları"
        description="Bilinen montaj bilgilerini doldurun, işi seçilen personele atayın."
      />

      <form className="form-panel assignment-form" onSubmit={submit}>
        <div className="assignment-form-sections">
          <FormSection title="Atama ve Firma">
            <div className="form-grid assignment-grid">
              <Field label="Atama Başlığı">
                <input
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Boş bırakılırsa firma ve hat adı kullanılır"
                  value={form.title}
                />
              </Field>
              <Field label="Atanacak Personel">
                <select
                  onChange={(event) => update("assigned_to_profile_id", event.target.value)}
                  required
                  value={form.assigned_to_profile_id}
                >
                  <option value="">Personel seçin</option>
                  {personnel.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.first_name} {profile.last_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Planlanan Tarih">
                <input
                  onChange={(event) => update("scheduled_date", event.target.value)}
                  type="date"
                  value={form.scheduled_date}
                />
              </Field>
              <Field label="Firma">
                <select onChange={(event) => updateCompany(event.target.value)} required value={form.company_id}>
                  <option value="">Firma seçin</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </Field>
              <ContactFields
                contacts={form.company_contacts}
                onAdd={addContact}
                onRemove={removeContact}
                onUpdate={updateContact}
              />
              <WorkItemsField
                belts={belts}
                companySelected={Boolean(form.company_id)}
                items={form.work_items}
                lines={selectedCompanyLines}
                onAdd={addWorkItem}
                onRemove={removeWorkItem}
                onUpdate={updateWorkItem}
              />
              <Field label="Makina Marka Modeli">
                <input
                  onChange={(event) => update("machine_brand_model", event.target.value)}
                  value={form.machine_brand_model}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Araç ve Ürün">
            <div className="form-grid assignment-grid">
              <Field label="Araç Plakası">
                <select onChange={(event) => update("vehicle_plate", event.target.value)} value={form.vehicle_plate}>
                  <option value="">Plaka seçin</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>
                  ))}
                </select>
              </Field>
              <Field className="span-2" label="Kullanılacak Makine/Ekipman">
                <textarea onChange={(event) => update("used_equipment", event.target.value)} value={form.used_equipment} />
              </Field>
              <Field label="Ürün Kodları">
                <ProductCodeList codes={productCodes} />
              </Field>
              <Field label="En">
                <input onChange={(event) => update("product_width", event.target.value)} value={form.product_width} />
              </Field>
              <Field label="Boy">
                <input onChange={(event) => update("product_length", event.target.value)} value={form.product_length} />
              </Field>
              <Field label="Miktar">
                <input onChange={(event) => update("product_quantity", event.target.value)} value={form.product_quantity} />
              </Field>
              <Field label="Item / Coil Kodu">
                <input
                  onChange={(event) => update("product_item_coil_code", event.target.value)}
                  value={form.product_item_coil_code}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="İşlem ve Teknik">
            <div className="form-grid assignment-grid">
              <CheckPicker
                className="span-2 assignment-compact-picker"
                label="Ürün Türü"
                options={productTypes.map((value) => ({ label: value, value }))}
                selected={form.product_types}
                onToggle={(value) => toggleArray("product_types", value)}
              />
              {form.product_types.includes("Diğer") ? (
                <Field label="Diğer Ürün Türü">
                  <input onChange={(event) => update("product_type_other", event.target.value)} value={form.product_type_other} />
                </Field>
              ) : null}
              <CheckPicker
                className="span-2 assignment-compact-picker"
                label="Yapılacak İşlem"
                options={processActions.map((value) => ({ label: value, value }))}
                selected={form.process_actions}
                onToggle={(value) => toggleArray("process_actions", value)}
              />
              {form.process_actions.includes("Kenar Kesim") ? (
                <Field label="Kenar Kesim">
                  <select onChange={(event) => update("edge_cut_method", event.target.value)} value={form.edge_cut_method}>
                    <option value="">Seçilmedi</option>
                    <option value="Makine ile">Makine ile</option>
                    <option value="El ile">El ile</option>
                  </select>
                </Field>
              ) : null}
              {form.process_actions.includes("Diğer") ? (
                <Field label="Diğer İşlem">
                  <input onChange={(event) => update("process_action_other", event.target.value)} value={form.process_action_other} />
                </Field>
              ) : null}
              <Field label="Eski Bant Çalışma Süresi">
                <input onChange={(event) => update("removed_belt_years", event.target.value)} value={form.removed_belt_years} />
              </Field>
              <CheckPicker
                className="span-2 assignment-compact-picker"
                label="Değiştirme Sebebi"
                options={replacementReasonOptions.map((value) => ({ label: value, value }))}
                selected={form.replacement_reasons}
                onToggle={(value) => toggleArray("replacement_reasons", value)}
              />
              {form.replacement_reasons.includes("Diğer") ? (
                <Field label="Diğer Sebep">
                  <input
                    onChange={(event) => update("replacement_reason_other", event.target.value)}
                    value={form.replacement_reason_other}
                  />
                </Field>
              ) : null}
            </div>
          </FormSection>

          <FormSection title="Not ve Faturalandırma">
            <div className="form-grid assignment-grid">
              <Field label="Faturalandırma">
                <select onChange={(event) => update("billing_status", event.target.value)} value={form.billing_status}>
                  <option value="">Seçilmedi</option>
                  <option value="Yapılan İşlem Tarafınıza Fatura Edilecektir">
                    Yapılan İşlem Tarafınıza Fatura Edilecektir
                  </option>
                  <option value="Bedelsiz İşlem Yapılmıştır">Bedelsiz İşlem Yapılmıştır</option>
                </select>
              </Field>
              <Field className="span-2" label="Personel Notu">
                <textarea onChange={(event) => update("notes", event.target.value)} value={form.notes} />
              </Field>
            </div>
          </FormSection>
        </div>
        <div className="actions">
          <button className="button" disabled={loading} type="submit">
            {editingId ? <Save aria-hidden size={18} /> : <ClipboardCheck aria-hidden size={18} />}
            {editingId ? "Atamayı Güncelle" : "Montaj Ata"}
          </button>
          {editingId ? (
            <button className="button subtle" onClick={resetForm} type="button">
              <X aria-hidden size={18} />
              Vazgeç
            </button>
          ) : null}
        </div>
      </form>

      {message ? <div className={message.includes("silindi") || message.includes("oluşturuldu") || message.includes("güncellendi") ? "message info" : "message error"}>{message}</div> : null}

      <div className="table-panel">
        {assignments.length === 0 ? (
          <div className="empty">Henüz montaj ataması yok.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Atama</th>
                <th>Personel</th>
                <th>Firma / Hat</th>
                <th>Tarih</th>
                <th>Durum</th>
                <th>Rapor</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const assignedProfile = personnelById.get(assignment.assigned_to_profile_id);

                return (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.title}</strong>
                      <br />
                      <small>{assignment.notes ?? "-"}</small>
                    </td>
                    <td>
                      {assignedProfile
                        ? `${assignedProfile.first_name} ${assignedProfile.last_name}`
                        : "Personel bulunamadı"}
                    </td>
                    <td>
                      {assignment.company_name_snapshot ?? "-"}
                      <br />
                      <small>{assignmentWorkItemsText(assignment)}</small>
                    </td>
                    <td>{assignment.scheduled_date ? formatDate(assignment.scheduled_date) : "-"}</td>
                    <td>
                      <span className={`status ${statusClass(assignment.status)}`}>
                        {statusLabels[assignment.status]}
                      </span>
                    </td>
                    <td>{assignment.report_id ? "Rapor oluşturuldu" : "-"}</td>
                    <td>
                      <div className="actions" style={{ marginTop: 0 }}>
                        <button className="button secondary" onClick={() => edit(assignment)} type="button">
                          <Pencil aria-hidden size={16} />
                          Düzenle
                        </button>
                        {assignment.status !== "COMPLETED" && assignment.status !== "CANCELLED" ? (
                          <button
                            className="button subtle"
                            disabled={loading}
                            onClick={() => setStatus(assignment, "CANCELLED")}
                            type="button"
                          >
                            <Ban aria-hidden size={16} />
                            İptal
                          </button>
                        ) : null}
                        <button className="button danger" disabled={loading} onClick={() => remove(assignment)} type="button">
                          <Trash2 aria-hidden size={16} />
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function buildReportValues(form: AssignmentForm, belts: Belt[]): Record<string, unknown> {
  const contacts = compactContacts(form.company_contacts);
  const workItems = enrichWorkItems(compactWorkItems(form.work_items), belts);
  const primaryWorkItem = workItems[0] ?? emptyWorkItem();
  const productCodes = workItemProductCodes(workItems);

  return {
    report_date: form.scheduled_date,
    company_id: form.company_id,
    company_contacts: contacts,
    company_contact_name: contacts[0]?.name ?? "",
    company_contact_phone: contacts[0]?.phone ?? "",
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: form.machine_brand_model,
    belt_id: primaryWorkItem.belt_id,
    vehicle_plate: form.vehicle_plate,
    used_equipment: form.used_equipment,
    product_code: productCodes.join("\n") || form.product_code,
    product_measure: "",
    product_width: form.product_width,
    product_length: form.product_length,
    product_quantity: form.product_quantity,
    product_item_coil_code: form.product_item_coil_code,
    product_types: form.product_types,
    product_type_other: form.product_type_other,
    process_actions: form.process_actions,
    edge_cut_method: form.edge_cut_method,
    process_action_other: form.process_action_other,
    removed_belt_years: form.removed_belt_years,
    replacement_reasons: form.replacement_reasons,
    replacement_reason_other: form.replacement_reason_other,
    billing_status: form.billing_status
  };
}

function formFromAssignment(assignment: InstallationAssignment): AssignmentForm {
  const values = toRecord(assignment.report_values);
  const companyContacts = contactsFromValue(
    values.company_contacts,
    stringValue(values.company_contact_name),
    stringValue(values.company_contact_phone)
  );
  const primaryContact = compactContacts(companyContacts)[0] ?? { name: "", phone: "" };
  const workItems = workItemsFromValue(
    values.work_items,
    (stringValue(values.line_name) || assignment.line_name) ?? "",
    stringValue(values.belt_id)
  );
  const primaryWorkItem = compactWorkItems(workItems)[0] ?? workItems[0] ?? emptyWorkItem();

  return {
    ...emptyForm,
    title: assignment.title,
    assigned_to_profile_id: assignment.assigned_to_profile_id,
    scheduled_date: assignment.scheduled_date ?? "",
    notes: assignment.notes ?? "",
    company_id: (stringValue(values.company_id) || assignment.company_id) ?? "",
    company_contacts: companyContacts,
    company_contact_name: primaryContact.name,
    company_contact_phone: primaryContact.phone,
    line_name: primaryWorkItem.line_name,
    work_items: workItems,
    machine_brand_model: stringValue(values.machine_brand_model),
    belt_id: primaryWorkItem.belt_id,
    vehicle_plate: stringValue(values.vehicle_plate),
    used_equipment: stringValue(values.used_equipment),
    product_code: stringValue(values.product_code),
    product_measure: "",
    product_width: stringValue(values.product_width),
    product_length: stringValue(values.product_length),
    product_quantity: stringValue(values.product_quantity),
    product_item_coil_code: stringValue(values.product_item_coil_code),
    product_types: arrayValue(values.product_types),
    product_type_other: stringValue(values.product_type_other),
    process_actions: arrayValue(values.process_actions),
    edge_cut_method: stringValue(values.edge_cut_method),
    process_action_other: stringValue(values.process_action_other),
    removed_belt_years: stringValue(values.removed_belt_years),
    replacement_reasons: arrayValue(values.replacement_reasons),
    replacement_reason_other: stringValue(values.replacement_reason_other),
    billing_status: stringValue(values.billing_status)
  };
}

function statusClass(status: InstallationAssignmentStatus) {
  if (status === "COMPLETED") return "ok";
  if (status === "CANCELLED") return "off";
  return "warn";
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function contactsFromFallback(name: string, phone: string): CompanyContactDraft[] {
  return name.trim() || phone.trim() ? [{ name, phone }] : [{ name: "", phone: "" }];
}

function contactsFromValue(value: unknown, fallbackName: string, fallbackPhone: string): CompanyContactDraft[] {
  if (Array.isArray(value)) {
    const contacts = value
      .map((item) => toRecord(item))
      .map((item) => ({
        name: stringValue(item.name),
        phone: stringValue(item.phone)
      }))
      .filter((contact) => contact.name.trim() || contact.phone.trim());

    if (contacts.length > 0) {
      return contacts;
    }
  }

  return contactsFromFallback(fallbackName, fallbackPhone);
}

function normalizeContacts(contacts: CompanyContactDraft[]) {
  return contacts.length > 0 ? contacts : [{ name: "", phone: "" }];
}

function compactContacts(contacts: CompanyContactDraft[]) {
  return contacts
    .map((contact) => ({
      name: contact.name.trim(),
      phone: contact.phone.trim()
    }))
    .filter((contact) => contact.name || contact.phone);
}

function syncPrimaryContact<T extends AssignmentForm>(form: T): T {
  const firstContact = compactContacts(form.company_contacts)[0] ?? { name: "", phone: "" };
  return {
    ...form,
    company_contact_name: firstContact.name,
    company_contact_phone: firstContact.phone
  };
}

function emptyWorkItem(): ReportWorkItem {
  return { line_name: "", belt_id: "", belt_code: "", belt_name: "" };
}

function normalizeWorkItems(items: ReportWorkItem[]) {
  return items.length > 0 ? items : [emptyWorkItem()];
}

function compactWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name);
}

function enrichWorkItems(items: ReportWorkItem[], belts: Belt[]) {
  const beltsById = new Map(belts.map((belt) => [belt.id, belt]));
  return items.map((item) => {
    const belt = beltsById.get(item.belt_id);
    return {
      ...item,
      belt_code: item.belt_code || belt?.code || "",
      belt_name: item.belt_name || belt?.name || ""
    };
  });
}

function workItemProductCodes(items: ReportWorkItem[], beltsById?: Map<string, Belt>) {
  return compactWorkItems(items)
    .map((item) => item.belt_code || beltsById?.get(item.belt_id)?.code || "")
    .filter(Boolean);
}

function workItemsFromValue(value: unknown, fallbackLineName: string, fallbackBeltId: string): ReportWorkItem[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toRecord(item))
      .map((item) => ({
        line_name: stringValue(item.line_name),
        belt_id: stringValue(item.belt_id),
        belt_code: stringValue(item.belt_code),
        belt_name: stringValue(item.belt_name)
      }))
      .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name);

    if (items.length > 0) {
      return items;
    }
  }

  return normalizeWorkItems([
    { line_name: fallbackLineName, belt_id: fallbackBeltId, belt_code: "", belt_name: "" }
  ]);
}

function syncPrimaryWorkItem<T extends AssignmentForm>(form: T): T {
  const firstItem = compactWorkItems(form.work_items)[0] ?? form.work_items[0] ?? emptyWorkItem();
  return {
    ...form,
    line_name: firstItem.line_name,
    belt_id: firstItem.belt_id
  };
}

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}

function formatWorkItemLabel(item: ReportWorkItem) {
  const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
  return [item.line_name, beltLabel].filter(Boolean).join(" / ");
}

function assignmentWorkItemsText(assignment: InstallationAssignment) {
  const values = toRecord(assignment.report_values);
  const items = compactWorkItems(
    workItemsFromValue(values.work_items, assignment.line_name ?? "", stringValue(values.belt_id))
  );
  return items.map(formatWorkItemLabel).filter(Boolean).join(" • ") || assignment.line_name || "-";
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="form-subsection">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ContactFields({
  contacts,
  onAdd,
  onRemove,
  onUpdate
}: {
  contacts: CompanyContactDraft[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, key: keyof CompanyContactDraft, value: string) => void;
}) {
  return (
    <div className="field span-2 contact-list-field">
      <label>Yetkili Kişiler</label>
      <div className="contact-list">
        {contacts.map((contact, index) => (
          <div className="contact-row" key={index}>
            <input
              aria-label={`Yetkili ${index + 1} adı`}
              onChange={(event) => onUpdate(index, "name", event.target.value)}
              placeholder="Ad Soyad"
              value={contact.name}
            />
            <input
              aria-label={`Yetkili ${index + 1} telefonu`}
              onChange={(event) => onUpdate(index, "phone", event.target.value)}
              placeholder="Telefon"
              value={contact.phone}
            />
            {contacts.length > 1 ? (
              <button className="button subtle icon-button" onClick={() => onRemove(index)} type="button">
                <X aria-hidden size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button className="button secondary contact-add-button" onClick={onAdd} type="button">
        Yetkili Ekle
      </button>
    </div>
  );
}

function ProductCodeList({ codes }: { codes: string[] }) {
  return (
    <div className="product-code-list">
      {codes.length > 0 ? (
        codes.map((code, index) => <span key={`${code}-${index}`}>{code}</span>)
      ) : (
        <em>Bant kodu seçilince otomatik gelir</em>
      )}
    </div>
  );
}

function WorkItemsField({
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
  const rows = normalizeWorkItems(items);

  return (
    <div className="field span-2 work-items-field">
      <label>Hat ve Bant Kalemleri</label>
      <div className="work-item-list">
        {rows.map((item, index) => (
          <div className="work-item-row" key={index}>
            <select
              disabled={!companySelected}
              onChange={(event) => onUpdate(index, "line_name", event.target.value)}
              value={item.line_name}
            >
              <option value="">{companySelected ? "Hat seçin" : "Önce firma seçin"}</option>
              {lines.map((line) => (
                <option key={line.id} value={line.name}>{line.name}</option>
              ))}
            </select>
            <select onChange={(event) => onUpdate(index, "belt_id", event.target.value)} value={item.belt_id}>
              <option value="">Bant kodu seçin</option>
              {belts.map((belt) => (
                <option key={belt.id} value={belt.id}>{formatBeltLabel(belt)}</option>
              ))}
            </select>
            {rows.length > 1 ? (
              <button className="button subtle icon-button" onClick={() => onRemove(index)} type="button">
                <X aria-hidden size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button className="button secondary contact-add-button" onClick={onAdd} type="button">
        <Plus aria-hidden size={16} />
        Kalem Ekle
      </button>
    </div>
  );
}

function Field({
  children,
  className,
  label
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={["field", className].filter(Boolean).join(" ")}>
      <label>{label}</label>
      {children}
    </div>
  );
}

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
    <div className={["field", className].filter(Boolean).join(" ")}>
      <label>{label}</label>
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
    </div>
  );
}
