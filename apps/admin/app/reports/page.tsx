"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Download, FilterX, LoaderCircle, Trash2 } from "lucide-react";
import type { Belt, Company, Profile, ReportListItem } from "@operations/types";
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
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

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
    if (nextFilters.beltId) {
      query = query.or(`belt_id.eq.${nextFilters.beltId},work_items.cs.${JSON.stringify([{ belt_id: nextFilters.beltId }])}`);
    }
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
    if (exporting) return;
    setExporting(true);
    setMessage("");

    try {
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
      link.download = `Operasyon_Raporlari_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function deleteReports(ids: string[]) {
    if (ids.length === 0) return;

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
      clearSupabaseReadCache();
      await loadReports();
      setMessage(ids.length === 1 ? "Rapor silindi." : "Seçili raporlar silindi.");
    } finally {
      setLoading(false);
      setPendingDelete(null);
    }
  }

  return (
    <>
      <PageHeaderShell
        title="Raporlar"
        description="Raporları filtreleyin, detaylarını açın ve Excel aktarımı yapın."
        action={
          <FormActions style={{ marginTop: 0 }}>
            <StatusBadge label={`${reports.length} rapor`} tone="neutral" />
            <Button
              disabled={exporting || selected.size === 0}
              icon={exporting ? <LoaderCircle aria-hidden className="spin" size={18} /> : <Download aria-hidden size={18} />}
              onClick={() => exportReports("selected")}
            >
              {exporting ? "Aktarılıyor" : "Excel'e Aktar"}
            </Button>
            <Button
              disabled={loading || selected.size === 0}
              icon={<Trash2 aria-hidden size={18} />}
              onClick={() => setPendingDelete([...selected])}
              variant="danger"
            >
              Seçilenleri Sil
            </Button>
          </FormActions>
        }
      />

      <form
        className="form-panel"
        onSubmit={(event) => {
          event.preventDefault();
          void loadReports();
        }}
      >
        <FormSection>
          <div className="form-grid">
            <FormField htmlFor="reports-start" label="Başlangıç Tarihi">
              <input id="reports-start" name="start" onChange={updateFilter} type="date" value={filters.start} />
            </FormField>
            <FormField htmlFor="reports-end" label="Bitiş Tarihi">
              <input id="reports-end" name="end" onChange={updateFilter} type="date" value={filters.end} />
            </FormField>
            <FormField htmlFor="reports-number" label="Rapor No">
              <input id="reports-number" name="reportNo" onChange={updateFilter} value={filters.reportNo} />
            </FormField>
            <FormField htmlFor="reports-company" label="Firma">
              <select id="reports-company" name="companyId" onChange={updateFilter} value={filters.companyId}>
              <option value="">Tümü</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
              </select>
            </FormField>
            <FormField htmlFor="reports-personnel" label="Personel">
              <select id="reports-personnel" name="personnelId" onChange={updateFilter} value={filters.personnelId}>
              <option value="">Tümü</option>
              {personnel.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.first_name} {profile.last_name}
                </option>
              ))}
              </select>
            </FormField>
            <FormField htmlFor="reports-belt" label="Bant">
              <select id="reports-belt" name="beltId" onChange={updateFilter} value={filters.beltId}>
              <option value="">Tümü</option>
              {belts.map((belt) => (
                <option key={belt.id} value={belt.id}>{formatBeltLabel(belt)}</option>
              ))}
              </select>
            </FormField>
            <FormField htmlFor="reports-status" label="Durum">
              <select id="reports-status" name="status" onChange={updateFilter} value={filters.status}>
              <option value="">Tümü</option>
              <option value="DRAFT">Taslak</option>
              <option value="SUBMITTED">Gönderildi</option>
              </select>
            </FormField>
          </div>
        </FormSection>
        <FormActions>
          <Button disabled={loading} type="submit">
            Filtrele
          </Button>
          <Button
            icon={<FilterX aria-hidden size={18} />}
            onClick={() => {
              setFilters(emptyFilters);
              loadReports(emptyFilters).catch(() => setMessage("Raporlar alınamadı."));
            }}
            variant="subtle"
          >
            Temizle
          </Button>
          <Button
            disabled={exporting}
            icon={exporting ? <LoaderCircle aria-hidden className="spin" size={18} /> : <Download aria-hidden size={18} />}
            onClick={() => exportReports("filtered")}
            variant="secondary"
          >
            {exporting ? "Aktarılıyor" : "Filtre Sonucunu Aktar"}
          </Button>
          <span>Seçilen: {selected.size} rapor</span>
        </FormActions>
      </form>

      {message ? <Alert tone={message.includes("silindi") ? "success" : "error"}>{message}</Alert> : null}
      <DataTablePanel>
        {reports.length === 0 ? (
          <EmptyState title="Rapor bulunamadı">Henüz rapor oluşturulmamış veya seçili filtrelerle eşleşen rapor yok.</EmptyState>
        ) : (
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>
                  <input aria-label="Sayfadaki raporları seç" checked={allSelected} onChange={togglePage} type="checkbox" />
                </DataTableHead>
                <DataTableHead>Rapor No</DataTableHead>
                <DataTableHead>Tarih</DataTableHead>
                <DataTableHead>Firma</DataTableHead>
                <DataTableHead>Formu Dolduran Personel</DataTableHead>
                <DataTableHead>Giden Personel</DataTableHead>
                <DataTableHead>İşlem</DataTableHead>
                <DataTableHead>Durum</DataTableHead>
                <DataTableHead>Oluşturulma Tarihi</DataTableHead>
                <DataTableHead>İşlemler</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {reports.map((report) => (
                <DataTableRow key={report.id}>
                  <DataTableCell>
                    <input
                      aria-label={`${report.report_number ?? "Taslak"} raporunu seç`}
                      checked={selected.has(report.id)}
                      onChange={() => toggleReport(report.id)}
                      type="checkbox"
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <Link href={`/reports/${report.id}`}>
                      {report.report_number ?? "Taslak"}
                    </Link>
                  </DataTableCell>
                  <DataTableCell>{new Date(report.report_date).toLocaleDateString("tr-TR")}</DataTableCell>
                  <DataTableCell>{report.company_name_snapshot ?? "-"}</DataTableCell>
                  <DataTableCell>{report.created_by_name_snapshot ?? "-"}</DataTableCell>
                  <DataTableCell>
                    {report.report_personnel?.map((item) => item.name_snapshot).join(", ") || "-"}
                  </DataTableCell>
                  <DataTableCell>{report.process_actions?.join(", ") || "-"}</DataTableCell>
                  <DataTableCell>
                    <StatusBadge
                      label={report.status === "SUBMITTED" ? "Gönderildi" : "Taslak"}
                      tone={report.status === "SUBMITTED" ? "success" : "warning"}
                    />
                  </DataTableCell>
                  <DataTableCell>{new Date(report.created_at).toLocaleString("tr-TR")}</DataTableCell>
                  <DataTableCell>
                    <Button
                      disabled={loading}
                      icon={<Trash2 aria-hidden size={16} />}
                      onClick={() => setPendingDelete([report.id])}
                      variant="danger"
                    >
                      Sil
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </DataTablePanel>
      <ConfirmDialog
        confirmLabel="Sil"
        description={
          pendingDelete
            ? pendingDelete.length === 1
              ? "Bu rapor kalıcı olarak silinsin mi?"
              : `${pendingDelete.length} rapor kalıcı olarak silinsin mi?`
            : undefined
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            void deleteReports(pendingDelete);
          }
        }}
        open={Boolean(pendingDelete)}
        title="Rapor silme onayı"
      />
    </>
  );
}

function formatBeltLabel(belt: Belt) {
  return belt.name ? `${belt.code} - ${belt.name}` : belt.code;
}
