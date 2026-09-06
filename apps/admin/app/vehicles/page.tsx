"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Vehicle } from "@operations/types";
import { vehicleSchema } from "@operations/validation";
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
import { getBrowserSupabase } from "../../lib/supabase-browser";

type VehicleForm = {
  plate: string;
  description: string;
};

const emptyForm: VehicleForm = {
  plate: "",
  description: ""
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Vehicle | null>(null);

  async function load() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setMessage("Araç listesi alınamadı.");
      return;
    }
    setVehicles((data ?? []) as Vehicle[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("Araç listesi alınamadı."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const normalizedForm = {
      ...form,
      plate: form.plate.toLocaleUpperCase("tr-TR")
    };
    const parsed = vehicleSchema.safeParse(normalizedForm);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Araç bilgilerini kontrol edin.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const payload = {
        ...parsed.data,
        description: parsed.data.description || null
      };
      const request = editingId
        ? supabase.from("vehicles").update(payload).eq("id", editingId)
        : supabase.from("vehicles").insert(payload);
      const { error } = await request;
      if (error) {
        setMessage("Araç kaydedilemedi. Aynı plaka zaten kayıtlı olabilir.");
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
      setMessage(editingId ? "Araç güncellendi." : "Araç eklendi.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(vehicle: Vehicle) {
    setMessage("");
    setLoading(true);
    try {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id);
      if (error) {
        setMessage("Araç silinemedi.");
        return;
      }
      await load();
      setMessage("Araç silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  function edit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      plate: vehicle.plate,
      description: vehicle.description ?? ""
    });
  }

  return (
    <>
      <PageHeaderShell
        title="Araçlar"
        description="Mobil raporda personelin seçeceği araç plakalarını yönetin."
        action={<StatusBadge label={`${vehicles.length} araç`} tone="neutral" />}
      />
      <form className="form-panel" onSubmit={submit}>
        <FormSection>
          <div className="form-grid">
            <FormField label="Plaka">
              <input
                onChange={(event) => setForm({ ...form, plate: event.target.value.toLocaleUpperCase("tr-TR") })}
                required
                value={form.plate}
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
            {editingId ? "Güncelle" : "Araç Ekle"}
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
        {vehicles.length === 0 ? (
          <EmptyState>Henüz araç eklenmemiş.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Plaka</DataTableHead>
                <DataTableHead>Açıklama</DataTableHead>
                <DataTableHead>Oluşturulma</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {vehicles.map((vehicle) => (
                <DataTableRow key={vehicle.id}>
                  <DataTableCell>{vehicle.plate}</DataTableCell>
                  <DataTableCell>{vehicle.description ?? "-"}</DataTableCell>
                  <DataTableCell>{new Date(vehicle.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <FormActions style={{ marginTop: 0 }}>
                      <Button icon={<Pencil aria-hidden size={16} />} onClick={() => edit(vehicle)} variant="secondary">
                        Düzenle
                      </Button>
                      <Button
                        disabled={loading}
                        icon={<Trash2 aria-hidden size={16} />}
                        onClick={() => setPendingDelete(vehicle)}
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
        description={pendingDelete ? `"${pendingDelete.plate}" plakalı araç silinsin mi?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void remove(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Araç silme onayı"
      />
    </>
  );
}
