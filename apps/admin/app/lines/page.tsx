"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Company, CompanyLine } from "@operations/types";
import { companyLineSchema } from "@operations/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

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

  const companyNames = useMemo(
    () => new Map(companies.map((company) => [company.id, company.name])),
    [companies]
  );

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const [companyRows, lineRows] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("company_lines").select("*").order("created_at", { ascending: false })
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
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const request = editingId
        ? supabase.from("company_lines").update(parsed.data).eq("id", editingId)
        : supabase.from("company_lines").insert(parsed.data);
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
    if (!confirm(`"${line.name}" hattı silinsin mi?`)) return;

    setMessage("");
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const { error } = await supabase.from("company_lines").delete().eq("id", line.id);
      if (error) {
        setMessage("Hat silinemedi.");
        return;
      }
      await load();
      setMessage("Hat silindi.");
    } finally {
      setLoading(false);
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
    <AdminShell>
      <PageHeader
        title="Hatlar"
        description="Her firma için mobil raporda seçilecek hat listesini yönetin."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Firma">
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
          </Field>
          <Field label="Hat Adı">
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              value={form.name}
            />
          </Field>
        </div>
        <div className="actions">
          <button className="button" disabled={loading || companies.length === 0} type="submit">
            <Save aria-hidden size={18} />
            {editingId ? "Güncelle" : "Hat Ekle"}
          </button>
          {editingId ? (
            <button
              className="button subtle"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              type="button"
            >
              <X aria-hidden size={18} />
              Vazgeç
            </button>
          ) : null}
        </div>
      </form>
      {message ? <div className={message.includes("eklendi") || message.includes("güncellendi") || message.includes("silindi") ? "message info" : "message error"}>{message}</div> : null}
      <div className="table-panel">
        {lines.length === 0 ? (
          <div className="empty">Henüz firma hattı eklenmemiş.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Hat</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>{companyNames.get(line.company_id) ?? "-"}</td>
                  <td>{line.name}</td>
                  <td>{new Date(line.created_at).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="button secondary" onClick={() => edit(line)} type="button">
                        <Pencil aria-hidden size={16} />
                        Düzenle
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => remove(line)} type="button">
                        <Trash2 aria-hidden size={16} />
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
