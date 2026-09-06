"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Pencil, Save, Trash2, X } from "lucide-react";
import type { Company } from "@operations/types";
import { companySchema } from "@operations/validation";
import {
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  EmptyState,
  FormActions,
  FormField,
  FormSection,
  PageHeaderShell,
  StatusBadge
} from "../../components/ui";
import { clearSupabaseReadCache, getBrowserSupabase } from "../../lib/supabase-browser";

type CompanyForm = {
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
};

const emptyForm: CompanyForm = {
  name: "",
  address: "",
  contact_name: "",
  contact_phone: ""
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Company | null>(null);

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage("Firmalar alınamadı.");
      return;
    }
    setCompanies((data ?? []) as Company[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Firmalar alınamadı."));
  }, []);

  async function authHeaders() {
    const supabase = getBrowserSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    return data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsed = companySchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Firma bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const payload = {
        ...parsed.data,
        address: parsed.data.address || null,
        contact_name: parsed.data.contact_name || null,
        contact_phone: parsed.data.contact_phone || null
      };
      const request = editingId
        ? supabase.from("companies").update(payload).eq("id", editingId)
        : supabase.from("companies").insert(payload);
      const { error } = await request;
      if (error) {
        setMessage("Firma kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.");
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function remove(company: Company) {
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/companies/${company.id}`, {
        method: "DELETE",
        headers: {
          ...(await authHeaders())
        }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(body?.message ?? "Firma silinemedi.");
        return;
      }
      clearSupabaseReadCache();
      await load();
      setMessage("Firma silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  function edit(company: Company) {
    setEditingId(company.id);
    setForm({
      name: company.name,
      address: company.address ?? "",
      contact_name: company.contact_name ?? "",
      contact_phone: company.contact_phone ?? ""
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Firmalar"
        description="Rapor formlarında seçilecek müşteri firmalarını yönetin."
        action={<StatusBadge label={`${companies.length} firma`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Firma Adı">
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </FormField>
            <FormField label="Adres">
              <input
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                value={form.address}
              />
            </FormField>
            <FormField label="Yetkili Kişi">
              <input
                onChange={(event) => setForm({ ...form, contact_name: event.target.value })}
                value={form.contact_name}
              />
            </FormField>
            <FormField label="Yetkili Telefon">
              <input
                onChange={(event) => setForm({ ...form, contact_phone: event.target.value })}
                value={form.contact_phone}
              />
            </FormField>
          </div>
        </FormSection>
        <FormActions>
          <Button disabled={loading} icon={<Save aria-hidden size={18} />} type="submit">
            {editingId ? "Güncelle" : "Firma Ekle"}
          </Button>
          {editingId ? (
            <Button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              icon={<X aria-hidden size={18} />}
              variant="subtle"
            >
              Vazgeç
            </Button>
          ) : null}
        </FormActions>
      </form>
      {message ? (
        <Alert tone={message.includes("silindi") ? "success" : "error"}>{message}</Alert>
      ) : null}
      <DataTablePanel>
        {companies.length === 0 ? (
          <EmptyState>
            Henüz firma eklenmemiş. Yeni firma eklemek için &quot;Firma Ekle&quot; butonunu kullanın.
          </EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Firma</DataTableHead>
                <DataTableHead>Yetkili</DataTableHead>
                <DataTableHead>Telefon</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {companies.map((company) => (
                <DataTableRow key={company.id}>
                  <DataTableCell>
                    <Building2 aria-hidden size={16} /> {company.name}
                    <br />
                    <small>{company.address ?? "-"}</small>
                  </DataTableCell>
                  <DataTableCell>{company.contact_name ?? "-"}</DataTableCell>
                  <DataTableCell>{company.contact_phone ?? "-"}</DataTableCell>
                  <DataTableCell>{new Date(company.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(company)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button
                        disabled={loading}
                        icon={<Trash2 aria-hidden size={16} />}
                        onClick={() => setPendingDelete(company)}
                        variant="danger"
                      >
                        Sil
                      </Button>
                    </FormActions>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTablePanel>
      <ConfirmDialog
        confirmLabel="Sil"
        description={pendingDelete ? `"${pendingDelete.name}" firması silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Firma silme onayı"
      />
    </>
  );
}
