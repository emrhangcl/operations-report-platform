"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Equipment } from "@operations/types";
import { equipmentSchema } from "@operations/validation";
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

type EquipmentForm = {
  name: string;
  description: string;
};

const emptyForm: EquipmentForm = {
  name: "",
  description: ""
};

export default function EquipmentPage() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Equipment | null>(null);

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const { data, error } = await supabase
      .from("equipment")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      setMessage("Ekipman listesi alınamadı.");
      return;
    }

    setEquipment((data ?? []) as Equipment[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Ekipman listesi alınamadı."));
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

    const parsed = equipmentSchema.safeParse({ ...form, is_active: true });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Ekipman bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...parsed.data,
        description: parsed.data.description || null
      };
      const response = await fetch(editingId ? `/api/admin/equipment/${editingId}` : "/api/admin/equipment", {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders())
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(body?.message ?? "Ekipman kaydedilemedi. Aynı ekipman adı kayıtlı olabilir.");
        return;
      }

      clearSupabaseReadCache();
      setForm(emptyForm);
      setEditingId(null);
      await load();
      setMessage(editingId ? "Ekipman güncellendi." : "Ekipman eklendi.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(item: Equipment) {
    setMessage("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/equipment/${item.id}`, {
        method: "DELETE",
        headers: {
          ...(await authHeaders())
        }
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        setMessage(body?.message ?? "Ekipman silinemedi.");
        return;
      }

      clearSupabaseReadCache();
      await load();
      setMessage("Ekipman silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  function edit(item: Equipment) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? ""
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Ekipmanlar"
        description="Montaj ataması ve personel raporlarında seçilecek makine/ekipman listesini yönetin."
        action={<StatusBadge label={`${equipment.length} ekipman`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Ekipman Adı">
              <input
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
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
            {editingId ? "Güncelle" : "Ekipman Ekle"}
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
        {equipment.length === 0 ? (
          <EmptyState>Henüz ekipman eklenmemiş.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Ekipman</DataTableHead>
                <DataTableHead>Açıklama</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {equipment.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell>{item.name}</DataTableCell>
                  <DataTableCell>{item.description ?? "-"}</DataTableCell>
                  <DataTableCell>{new Date(item.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(item)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button
                        disabled={loading}
                        icon={<Trash2 aria-hidden size={16} />}
                        onClick={() => setPendingDelete(item)}
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
        description={pendingDelete ? `"${pendingDelete.name}" ekipmanı silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Ekipman silme onayı"
      />
    </>
  );
}
