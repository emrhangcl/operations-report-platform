"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Belt } from "@tunca/types";
import { beltSchema } from "@tunca/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

type BeltForm = {
  name: string;
  code: string;
  description: string;
};

const emptyForm: BeltForm = {
  name: "",
  code: "",
  description: ""
};

export default function BeltsPage() {
  const [belts, setBelts] = useState<Belt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("belts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage("Bantlar alınamadı.");
      return;
    }
    setBelts((data ?? []) as Belt[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Bantlar alınamadı."));
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
    const parsed = beltSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Bant bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const payload = {
      ...parsed.data,
      code: parsed.data.code || null,
      description: parsed.data.description || null
    };
    const request = editingId
      ? supabase.from("belts").update(payload).eq("id", editingId)
      : supabase.from("belts").insert(payload);
    const { error } = await request;
    if (error) setMessage("Bant kaydedilemedi. Bilgileri kontrol edip tekrar deneyin.");
    else {
      setForm(emptyForm);
      setEditingId(null);
      await load();
    }
    setLoading(false);
  }

  async function remove(belt: Belt) {
    if (!confirm(`"${belt.name}" bandı silinsin mi?`)) return;

    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/belts/${belt.id}`, {
        method: "DELETE",
        headers: {
          ...(await authHeaders())
        }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(body?.message ?? "Bant silinemedi.");
        return;
      }
      await load();
      setMessage("Bant silindi.");
    } finally {
      setLoading(false);
    }
  }

  function edit(belt: Belt) {
    setEditingId(belt.id);
    setForm({
      name: belt.name,
      code: belt.code ?? "",
      description: belt.description ?? ""
    });
  }

  return (
    <AdminShell>
      <PageHeader
        title="Bantlar"
        description="Mobil raporda seçilecek aktif bant listesini yönetin."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Bant Adı">
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
              value={form.name}
            />
          </Field>
          <Field label="Kod">
            <input
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              value={form.code}
            />
          </Field>
          <Field label="Açıklama">
            <input
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              value={form.description}
            />
          </Field>
        </div>
        <div className="actions">
          <button className="button" disabled={loading} type="submit">
            <Save aria-hidden size={18} />
            {editingId ? "Güncelle" : "Bant Ekle"}
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
        {belts.length === 0 ? (
          <div className="empty">Henüz bant eklenmemiş.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bant</th>
                <th>Kod</th>
                <th>Açıklama</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {belts.map((belt) => (
                <tr key={belt.id}>
                  <td>{belt.name}</td>
                  <td>{belt.code ?? "-"}</td>
                  <td>{belt.description ?? "-"}</td>
                  <td>{new Date(belt.created_at).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="button secondary" onClick={() => edit(belt)} type="button">
                        <Pencil aria-hidden size={16} />
                        Düzenle
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => remove(belt)} type="button">
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
