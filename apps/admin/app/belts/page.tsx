"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Belt } from "@operations/types";
import { beltSchema } from "@operations/validation";
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

type BeltForm = {
  code: string;
  name: string;
  description: string;
};

const emptyForm: BeltForm = {
  code: "",
  name: "",
  description: ""
};

export default function BeltsPage() {
  const [belts, setBelts] = useState<Belt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Belt | null>(null);

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("belts")
      .select("*")
      .order("code", { ascending: true });
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
      name: parsed.data.name || null,
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
      clearSupabaseReadCache();
      await load();
      setMessage("Bant silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  function edit(belt: Belt) {
    setEditingId(belt.id);
    setForm({
      code: belt.code,
      name: belt.name ?? "",
      description: belt.description ?? ""
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Bantlar"
        description="Mobil raporda seçilecek aktif bant listesini yönetin."
        action={<StatusBadge label={`${belts.length} bant`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Bant Kodu">
              <input
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                required
                value={form.code}
              />
            </FormField>
            <FormField label="Bant Adı">
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Opsiyonel"
                value={form.name}
              />
            </FormField>
            <FormField label="Açıklama">
              <input
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                value={form.description}
              />
            </FormField>
          </div>
        </FormSection>
        <FormActions>
          <Button disabled={loading} icon={<Save aria-hidden size={18} />} type="submit">
            {editingId ? "Güncelle" : "Bant Ekle"}
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
      {message ? <Alert tone={message.includes("silindi") ? "success" : "error"}>{message}</Alert> : null}
      <DataTablePanel>
        {belts.length === 0 ? (
          <EmptyState>Henüz bant eklenmemiş.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Kod</DataTableHead>
                <DataTableHead>Bant Adı</DataTableHead>
                <DataTableHead>Açıklama</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {belts.map((belt) => (
                <DataTableRow key={belt.id}>
                  <DataTableCell>{belt.code}</DataTableCell>
                  <DataTableCell>{belt.name ?? "-"}</DataTableCell>
                  <DataTableCell>{belt.description ?? "-"}</DataTableCell>
                  <DataTableCell>{new Date(belt.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(belt)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button
                        disabled={loading}
                        icon={<Trash2 aria-hidden size={16} />}
                        onClick={() => setPendingDelete(belt)}
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
        description={pendingDelete ? `"${formatBeltLabel(pendingDelete)}" bandı silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Bant silme onayı"
      />
    </>
  );
}

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}
