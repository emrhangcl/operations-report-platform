"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Company, CompanyLine } from "@operations/types";
import { companyLineSchema } from "@operations/validation";
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
import { getBrowserClient } from "../../lib/browser-client";

type LineForm = {
  company_id: string;
  name: string;
};

const emptyForm: LineForm = {
  company_id: "",
  name: ""
};

export default function LinesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [lines, setLines] = useState<CompanyLine[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CompanyLine | null>(null);

  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies]
  );

  async function load() {
    const db = getBrowserClient();
    if (!db) return;
    const [companyRows, lineRows] = await Promise.all([
      db.from("companies").select("*").order("name"),
      db.from("company_lines").select("*").order("created_at", { ascending: false })
    ]);
    if (companyRows.error || lineRows.error) {
      setMessage("Hat listesi alınamadı.");
      return;
    }
    setCompanies((companyRows.data ?? []) as Company[]);
    setLines((lineRows.data ?? []) as CompanyLine[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Hat listesi alınamadı."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const parsed = companyLineSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Hat bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      const db = getBrowserClient();
      if (!db) return;
      const request = editingId
        ? db.from("company_lines").update(parsed.data).eq("id", editingId)
        : db.from("company_lines").insert(parsed.data);
      const { error } = await request;
      if (error) {
        setMessage("Hat kaydedilemedi. Aynı firmada aynı hat adı zaten olabilir.");
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
      setMessage(editingId ? "Hat güncellendi." : "Hat eklendi.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(line: CompanyLine) {
    setMessage("");
    setLoading(true);
    try {
      const db = getBrowserClient();
      if (!db) return;
      const { error } = await db.from("company_lines").delete().eq("id", line.id);
      if (error) {
        setMessage("Hat silinemedi.");
        return;
      }
      await load();
      setMessage("Hat silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  function edit(line: CompanyLine) {
    setEditingId(line.id);
    setForm({
      company_id: line.company_id,
      name: line.name
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Hatlar"
        description="Her firma için mobil raporda seçilecek hat listesini yönetin."
        action={<StatusBadge label={`${lines.length} hat`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Firma">
              <select
                onChange={(event) => setForm({ ...form, company_id: event.target.value })}
                required
                value={form.company_id}
              >
                <option value="">Firma seçin</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Hat Adı">
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
                value={form.name}
              />
            </FormField>
          </div>
        </FormSection>
        <FormActions>
          <Button disabled={loading || companies.length === 0} icon={<Save aria-hidden size={18} />} type="submit">
            {editingId ? "Güncelle" : "Hat Ekle"}
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
        <Alert tone={message.includes("eklendi") || message.includes("güncellendi") || message.includes("silindi") ? "success" : "error"}>
          {message}
        </Alert>
      ) : null}
      <DataTablePanel>
        {lines.length === 0 ? (
          <EmptyState>Henüz firma hattı eklenmemiş.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Firma</DataTableHead>
                <DataTableHead>Hat</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {lines.map((line) => (
                <DataTableRow key={line.id}>
                  <DataTableCell>{companyNames.get(line.company_id) ?? "-"}</DataTableCell>
                  <DataTableCell>{line.name}</DataTableCell>
                  <DataTableCell>{new Date(line.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(line)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button
                        disabled={loading}
                        icon={<Trash2 aria-hidden size={16} />}
                        onClick={() => setPendingDelete(line)}
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
        description={pendingDelete ? `"${pendingDelete.name}" hattı silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Hat silme onayı"
      />
    </>
  );
}
