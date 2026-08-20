"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Pencil, Save, Trash2, X } from "lucide-react";
import type { Company } from "@tunca/types";
import { companySchema } from "@tunca/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

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
    if (!confirm(`"${company.name}" firması silinsin mi?`)) return;

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
      await load();
      setMessage("Firma silindi.");
    } finally {
      setLoading(false);
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
    <AdminShell>
      <PageHeader
        title="Firmalar"
        description="Rapor formlarında seçilecek müşteri firmalarını yönetin."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Firma Adı">
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              value={form.name}
            />
          </Field>
          <Field label="Adres">
            <input
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              value={form.address}
            />
          </Field>
          <Field label="Yetkili Kişi">
            <input
              onChange={(event) => setForm({ ...form, contact_name: event.target.value })}
              value={form.contact_name}
            />
          </Field>
          <Field label="Yetkili Telefon">
            <input
              onChange={(event) => setForm({ ...form, contact_phone: event.target.value })}
              value={form.contact_phone}
            />
          </Field>
        </div>
        <div className="actions">
          <button className="button" disabled={loading} type="submit">
            <Save aria-hidden size={18} />
            {editingId ? "Güncelle" : "Firma Ekle"}
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
      {message ? <div className={message.includes("silindi") ? "message info" : "message error"}>{message}</div> : null}
      <div className="table-panel">
        {companies.length === 0 ? (
          <div className="empty">
            Henüz firma eklenmemiş. Yeni firma eklemek için &quot;Firma Ekle&quot; butonunu kullanın.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Firma</th>
                <th>Yetkili</th>
                <th>Telefon</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <Building2 aria-hidden size={16} /> {company.name}
                    <br />
                    <small>{company.address ?? "-"}</small>
                  </td>
                  <td>{company.contact_name ?? "-"}</td>
                  <td>{company.contact_phone ?? "-"}</td>
                  <td>{new Date(company.created_at).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="button secondary" onClick={() => edit(company)} type="button">
                        <Pencil aria-hidden size={16} />
                        Düzenle
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => remove(company)} type="button">
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
