"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Pencil, Save, Trash2, UserPlus, X } from "lucide-react";
import type { Profile } from "@tunca/types";
import { personnelSchema } from "@tunca/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

type PersonnelForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
};

const emptyForm: PersonnelForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: ""
};

export default function PersonnelPage() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "PERSONNEL")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage("Personel listesi alınamadı.");
      return;
    }
    setRows((data ?? []) as Profile[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Personel listesi alınamadı."));
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

    const parsed = personnelSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Personel bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      if (editingId) {
        const { error } = await supabase
          .from("profiles")
          .update({
            first_name: parsed.data.first_name,
            last_name: parsed.data.last_name,
            email: parsed.data.email,
            phone: parsed.data.phone || null,
            is_active: true
          })
          .eq("id", editingId);
        if (error) setMessage("Personel güncellenemedi.");
      } else {
        if (form.password.length < 8) {
          setMessage("Yeni kullanıcı hesabı için en az 8 karakter şifre girin.");
          setLoading(false);
          return;
        }
        const response = await fetch("/api/admin/personnel/create-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders())
          },
          body: JSON.stringify({
            ...parsed.data,
            password: form.password
          })
        });
        if (!response.ok) {
          setMessage("Personel hesabı oluşturulamadı.");
        }
      }

      setForm(emptyForm);
      setEditingId(null);
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function remove(profile: Profile) {
    if (!confirm(`${profile.first_name} ${profile.last_name} silinsin mi?`)) return;

    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/personnel/${profile.id}`, {
        method: "DELETE",
        headers: {
          ...(await authHeaders())
        }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(body?.message ?? "Personel silinemedi.");
        return;
      }
      await load();
      setMessage("Personel silindi.");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(profile: Profile) {
    setLoading(true);
    const response = await fetch("/api/admin/personnel/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders())
      },
      body: JSON.stringify({ email: profile.email })
    });
    setMessage(
      response.ok
        ? "Şifre sıfırlama bağlantısı üretildi. Supabase e-posta ayarlarınızı kontrol edin."
        : "Şifre sıfırlama işlemi başlatılamadı."
    );
    setLoading(false);
  }

  function edit(profile: Profile) {
    setEditingId(profile.id);
    setForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      email: profile.email ?? "",
      phone: profile.phone ?? "",
      password: ""
    });
  }

  return (
    <AdminShell>
      <PageHeader
        title="Personel"
        description="Saha kullanıcılarını ve aktiflik durumlarını yönetin."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Ad">
            <input
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
              required
              value={form.first_name}
            />
          </Field>
          <Field label="Soyad">
            <input
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
              required
              value={form.last_name}
            />
          </Field>
          <Field label="E-posta / Kullanıcı Adı">
            <input
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              type="email"
              value={form.email}
            />
          </Field>
          <Field label="Telefon">
            <input
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              value={form.phone}
            />
          </Field>
          {!editingId ? (
            <Field label="İlk Şifre">
              <input
                minLength={8}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
                type="password"
                value={form.password}
              />
            </Field>
          ) : null}
        </div>
        <div className="actions">
          <button className="button" disabled={loading} type="submit">
            {editingId ? <Save aria-hidden size={18} /> : <UserPlus aria-hidden size={18} />}
            {editingId ? "Güncelle" : "Kullanıcı Hesabı Oluştur"}
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
      {message ? <div className={message.includes("üretildi") || message.includes("silindi") ? "message info" : "message error"}>{message}</div> : null}
      <div className="table-panel">
        {rows.length === 0 ? (
          <div className="empty">Henüz personel eklenmemiş.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ad Soyad</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Kullanıcı Hesabı</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((profile) => (
                <tr key={profile.id}>
                  <td>{profile.first_name} {profile.last_name}</td>
                  <td>{profile.phone ?? "-"}</td>
                  <td>{profile.email ?? "-"}</td>
                  <td>Var</td>
                  <td>{new Date(profile.created_at).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="button secondary" onClick={() => edit(profile)} type="button">
                        <Pencil aria-hidden size={16} />
                        Düzenle
                      </button>
                      <button className="button subtle" disabled={loading} onClick={() => resetPassword(profile)} type="button">
                        <KeyRound aria-hidden size={16} />
                        Şifre Sıfırla
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => remove(profile)} type="button">
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
