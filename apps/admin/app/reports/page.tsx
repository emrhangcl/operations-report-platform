"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, FilterX, Trash2 } from "lucide-react";
import type { Belt, Company, Profile, ReportListItem } from "@tunca/types";
import { AdminShell } from "../../components/admin-shell";
import { PageHeader } from "../../components/page-header";
import { getBrowserSupabase } from "../../lib/supabase-browser";

type Filters = {
  start: string;
  end: string;
  reportNo: string;
  companyId: string;
  personnelId: string;
  beltId: string;
  status: string;
};

const emptyFilters: Filters = {
  start: "",
  end: "",
  reportNo: "",
  companyId: "",
  personnelId: "",
  beltId: "",
  status: ""
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [personnel, setPersonnel] = useState<Profile[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadLookups() {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const [companyRows, beltRows, personnelRows] = await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase.from("belts").select("*").order("code"),
      supabase.from("profiles").select("*").eq("role", "PERSONNEL").order("first_name")
    ]);
    setCompanies((companyRows.data ?? []) as Company[]);
    setBelts((beltRows.data ?? []) as Belt[]);
    setPersonnel((personnelRows.data ?? []) as Profile[]);
  }

  async function loadReports(nextFilters = filters) {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    let query = supabase
      .from("reports")
      .select("*, report_personnel(name_snapshot)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (nextFilters.start) query = query.gte("report_date", nextFilters.start);
    if (nextFilters.end) query = query.lte("report_date", nextFilters.end);
    if (nextFilters.reportNo) query = query.ilike("report_number", `%${nextFilters.reportNo}%`);
    if (nextFilters.companyId) query = query.eq("company_id", nextFilters.companyId);
    if (nextFilters.personnelId) query = query.eq("created_by_user_id", nextFilters.personnelId);
    if (nextFilters.beltId) query = query.eq("belt_id", nextFilters.beltId);
    if (nextFilters.status) query = query.eq("status", nextFilters.status);

    const { data, error } = await query;
    if (error) {
      setMessage("Raporlar alınamadı.");
    } else {
      setReports((data ?? []) as ReportListItem[]);
      setSelected(new Set());
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLookups().catch(() => setMessage("Filtre listeleri alınamadı."));
    loadReports().catch(() => setMessage("Raporlar alınamadı."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSelected = useMemo(
    () => reports.length > 0 && reports.every((report) => selected.has(report.id)),
    [reports, selected]
  );

  function updateFilter(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  function toggleReport(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function togglePage() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(reports.map((report) => report.id)));
  }

  async function authHeaders() {
    const supabase = getBrowserSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    return data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined;
  }

  async function exportReports(mode: "selected" | "filtered") {
    const headers = await authHeaders();
    if (!headers?.Authorization) {
      setMessage("Excel aktarımı için oturum doğrulanamadı.");
      return;
    }

    const params = new URLSearchParams();
    if (mode === "selected") {
      [...selected].forEach((id) => params.append("id", id));
    } else {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
    }

    const response = await fetch(`/api/admin/reports/export?${params.toString()}`, {
      headers: {
        ...headers
      }
    });

    if (!response.ok) {
      setMessage("Excel dosyası üretilemedi.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TUNCA_Raporlar_${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteReports(ids: string[]) {
    if (ids.length === 0) return;
    const approved = confirm(
      ids.length === 1
        ? "Bu rapor kalıcı olarak silinsin mi?"
        : `${ids.length} rapor kalıcı olarak silinsin mi?`
    );
    if (!approved) return;

    const headers = await authHeaders();
    if (!headers?.Authorization) {
      setMessage("Silme işlemi için oturum doğrulanamadı.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/reports/${id}`, {
          method: "DELETE",
          headers
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null;
          setMessage(body?.message ?? "Rapor silinemedi.");
          return;
        }
      }
      await loadReports();
      setMessage(ids.length === 1 ? "Rapor silindi." : "Seçili raporlar silindi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminShell>
      <PageHeader
        title="Raporlar"
        description="Raporları filtreleyin, detaylarını açın ve Excel aktarımı yapın."
        action={
          <div className="actions" style={{ marginTop: 0 }}>
            <button
              className="button"
              disabled={selected.size === 0}
              onClick={() => exportReports("selected")}
              type="button"
            >
              <Download aria-hidden size={18} />
              Excel&apos;e Aktar
            </button>
            <button
              className="button danger"
              disabled={loading || selected.size === 0}
              onClick={() => deleteReports([...selected])}
              type="button"
            >
              <Trash2 aria-hidden size={18} />
              Seçilenleri Sil
            </button>
          </div>
        }
      />

      <div className="form-panel">
        <div className="form-grid">
          <Field label="Başlangıç Tarihi">
            <input name="start" onChange={updateFilter} type="date" value={filters.start} />
          </Field>
          <Field label="Bitiş Tarihi">
            <input name="end" onChange={updateFilter} type="date" value={filters.end} />
          </Field>
          <Field label="Rapor No">
            <input name="reportNo" onChange={updateFilter} value={filters.reportNo} />
          </Field>
          <Field label="Firma">
            <select name="companyId" onChange={updateFilter} value={filters.companyId}>
              <option value="">Tümü</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Personel">
            <select name="personnelId" onChange={updateFilter} value={filters.personnelId}>
              <option value="">Tümü</option>
              {personnel.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.first_name} {profile.last_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bant">
            <select name="beltId" onChange={updateFilter} value={filters.beltId}>
              <option value="">Tümü</option>
              {belts.map((belt) => (
                <option key={belt.id} value={belt.id}>{formatBeltLabel(belt)}</option>
              ))}
            </select>
          </Field>
          <Field label="Durum">
            <select name="status" onChange={updateFilter} value={filters.status}>
              <option value="">Tümü</option>
              <option value="DRAFT">Taslak</option>
              <option value="SUBMITTED">Gönderildi</option>
            </select>
          </Field>
        </div>
        <div className="actions">
          <button className="button" disabled={loading} onClick={() => loadReports()} type="button">
            Filtrele
          </button>
          <button
            className="button subtle"
            onClick={() => {
              setFilters(emptyFilters);
              loadReports(emptyFilters).catch(() => setMessage("Raporlar alınamadı."));
            }}
            type="button"
          >
            <FilterX aria-hidden size={18} />
            Temizle
          </button>
          <button className="button secondary" onClick={() => exportReports("filtered")} type="button">
            Filtre Sonucunu Aktar
          </button>
          <span>Seçilen: {selected.size} rapor</span>
        </div>
      </div>

      {message ? <div className={message.includes("silindi") ? "message info" : "message error"}>{message}</div> : null}
      <div className="table-panel">
        {reports.length === 0 ? (
          <div className="empty">Henüz rapor oluşturulmamış.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>
                  <input checked={allSelected} onChange={togglePage} type="checkbox" />
                </th>
                <th>Rapor No</th>
                <th>Tarih</th>
                <th>Firma</th>
                <th>Formu Dolduran Personel</th>
                <th>Giden Personel</th>
                <th>İşlem</th>
                <th>Durum</th>
                <th>Oluşturulma Tarihi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <input
                      checked={selected.has(report.id)}
                      onChange={() => toggleReport(report.id)}
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <Link href={`/reports/${report.id}`}>
                      {report.report_number ?? "Taslak"}
                    </Link>
                  </td>
                  <td>{new Date(report.report_date).toLocaleDateString("tr-TR")}</td>
                  <td>{report.company_name_snapshot ?? "-"}</td>
                  <td>{report.created_by_name_snapshot ?? "-"}</td>
                  <td>
                    {report.report_personnel?.map((item) => item.name_snapshot).join(", ") || "-"}
                  </td>
                  <td>{report.process_actions?.join(", ") || "-"}</td>
                  <td>
                    <span className={`status ${report.status === "SUBMITTED" ? "ok" : "warn"}`}>
                      {report.status === "SUBMITTED" ? "Gönderildi" : "Taslak"}
                    </span>
                  </td>
                  <td>{new Date(report.created_at).toLocaleString("tr-TR")}</td>
                  <td>
                    <button
                      className="button danger"
                      disabled={loading}
                      onClick={() => deleteReports([report.id])}
                      type="button"
                    >
                      <Trash2 aria-hidden size={16} />
                      Sil
                    </button>
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

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}
