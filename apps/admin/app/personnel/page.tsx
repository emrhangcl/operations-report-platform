"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, Pencil, Save, Trash2, UserPlus, X } from "lucide-react";
import type { Profile, UserRole } from "@operations/types";
import { userAccountSchema } from "@operations/validation";
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

type PersonnelForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
};

const emptyForm: PersonnelForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  password: "",
  role: "PERSONNEL"
};

export default function PersonnelPage() {
  const [rows, setRows] = useState<Profile[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Profile | null>(null);

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
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

    const parsed = userAccountSchema.safeParse(form);
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
            role: parsed.data.role,
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
        } else {
          clearSupabaseReadCache();
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
      clearSupabaseReadCache();
      await load();
      setMessage("Personel silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
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
      password: "",
      role: profile.role
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Kullanıcılar"
        description="Personel ve admin hesaplarını oluşturun, düzenleyin ve silin."
        action={<StatusBadge label={`${rows.length} kullanıcı`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Ad">
              <input
                onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                required
                value={form.first_name}
              />
            </FormField>
            <FormField label="Soyad">
              <input
                onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                required
                value={form.last_name}
              />
            </FormField>
            <FormField label="E-posta / Kullanıcı Adı">
              <input
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
                type="email"
                value={form.email}
              />
            </FormField>
            <FormField label="Telefon">
              <input
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                value={form.phone}
              />
            </FormField>
            <FormField label="Yetki">
              <select
                onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
                value={form.role}
              >
                <option value="PERSONNEL">Personel</option>
                <option value="ADMIN">Admin / Talep Açan</option>
              </select>
            </FormField>
            {!editingId ? (
              <FormField label="İlk Şifre">
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  required
                  type="password"
                  value={form.password}
                />
              </FormField>
            ) : null}
          </div>
        </FormSection>
        <FormActions>
          <Button disabled={loading} icon={editingId ? <Save aria-hidden size={18} /> : <UserPlus aria-hidden size={18} />} type="submit">
            {editingId ? "Güncelle" : "Kullanıcı Hesabı Oluştur"}
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
        <Alert tone={message.includes("üretildi") || message.includes("silindi") ? "success" : "error"}>
          {message}
        </Alert>
      ) : null}
      <DataTablePanel>
        {rows.length === 0 ? (
          <EmptyState>Henüz kullanıcı eklenmemiş.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Ad Soyad</DataTableHead>
                <DataTableHead>Telefon</DataTableHead>
                <DataTableHead>E-posta</DataTableHead>
                <DataTableHead>Yetki</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {rows.map((profile) => (
                <DataTableRow key={profile.id}>
                  <DataTableCell>{profile.first_name} {profile.last_name}</DataTableCell>
                  <DataTableCell>{profile.phone ?? "-"}</DataTableCell>
                  <DataTableCell>{profile.email ?? "-"}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={profile.role === "ADMIN" ? "Admin" : "Personel"}
                      tone={profile.role === "ADMIN" ? "success" : "warning"}
                    />
                  </DataTableCell>
                  <DataTableCell>{new Date(profile.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(profile)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button disabled={loading} icon={<KeyRound aria-hidden size={16} />} onClick={() => resetPassword(profile)} variant="subtle">
                        Şifre Sıfırla
                      </Button>
                      <Button disabled={loading} icon={<Trash2 aria-hidden size={16} />} onClick={() => setPendingDelete(profile)} variant="danger">
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
        description={pendingDelete ? `${pendingDelete.first_name} ${pendingDelete.last_name} silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Personel silme onayı"
      />
    </>
  );
}
