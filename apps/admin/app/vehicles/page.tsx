"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import type { Vehicle } from "@operations/types";
import { vehicleSchema } from "@operations/validation";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
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
    if (!confirm(`"${vehicle.plate}" plakalı araç silinsin mi?`)) return;

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
    <AdminShell>
      <PageHeader
        title="Araçlar"
        description="Mobil raporda personelin seçeceği araç plakalarını yönetin."
      />
      <form className="form-panel" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Plaka">
            <input
              onChange={(event) => setForm({ ...form, plate: event.target.value.toLocaleUpperCase("tr-TR") })}
              required
              value={form.plate}
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
            {editingId ? "Güncelle" : "Araç Ekle"}
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
        {vehicles.length === 0 ? (
          <div className="empty">Henüz araç eklenmemiş.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plaka</th>
                <th>Açıklama</th>
                <th>Oluşturulma</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td>{vehicle.plate}</td>
                  <td>{vehicle.description ?? "-"}</td>
                  <td>{new Date(vehicle.created_at).toLocaleDateString("tr-TR")}</td>
                  <td>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <button className="button secondary" onClick={() => edit(vehicle)} type="button">
                        <Pencil aria-hidden size={16} />
                        Düzenle
                      </button>
                      <button className="button danger" disabled={loading} onClick={() => remove(vehicle)} type="button">
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
