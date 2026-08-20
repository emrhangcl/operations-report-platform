"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../components/admin-shell";
import { PageHeader } from "../components/page-header";
import { getBrowserSupabase } from "../lib/supabase-browser";

interface DashboardCounts {
  totalReports: number;
  monthlyReports: number;
  drafts: number;
  personnel: number;
  companies: number;
  lines: number;
  vehicles: number;
}

const emptyCounts: DashboardCounts = {
  totalReports: 0,
  monthlyReports: 0,
  drafts: 0,
  personnel: 0,
  companies: 0,
  lines: 0,
  vehicles: 0
};

export default function DashboardPage() {
  const [counts, setCounts] = useState(emptyCounts);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const client = supabase;

    async function load() {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
        .toISOString()
        .slice(0, 10);

      const [
        totalReports,
        monthlyReports,
        drafts,
        personnel,
        companies,
        lines,
        vehicles
      ] = await Promise.all([
        client.from("reports").select("id", { count: "exact", head: true }),
        client
          .from("reports")
          .select("id", { count: "exact", head: true })
          .gte("report_date", firstDay),
        client
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "DRAFT"),
        client
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "PERSONNEL"),
        client
          .from("companies")
          .select("id", { count: "exact", head: true }),
        client
          .from("company_lines")
          .select("id", { count: "exact", head: true }),
        client
          .from("vehicles")
          .select("id", { count: "exact", head: true })
      ]);

      const hasError = [
        totalReports.error,
        monthlyReports.error,
        drafts.error,
        personnel.error,
        companies.error,
        lines.error,
        vehicles.error
      ].some(Boolean);

      if (hasError) {
        setError("Dashboard bilgileri alınamadı. Bağlantınızı kontrol edin.");
        return;
      }

      setCounts({
        totalReports: totalReports.count ?? 0,
        monthlyReports: monthlyReports.count ?? 0,
        drafts: drafts.count ?? 0,
        personnel: personnel.count ?? 0,
        companies: companies.count ?? 0,
        lines: lines.count ?? 0,
        vehicles: vehicles.count ?? 0
      });
    }

    load().catch(() => {
      setError("Dashboard bilgileri alınamadı. Bağlantınızı kontrol edin.");
    });
  }, []);

  return (
    <AdminShell>
      <PageHeader
        title="Yönetim Paneli"
        description="Gerçek veritabanı kayıtlarından hesaplanan özet."
      />
      {error ? <div className="message error">{error}</div> : null}
      <section className="grid stats">
        <StatCard label="Toplam Rapor" value={counts.totalReports} />
        <StatCard label="Bu Ayki Raporlar" value={counts.monthlyReports} />
        <StatCard label="Taslaklar" value={counts.drafts} />
        <StatCard label="Personel" value={counts.personnel} />
        <StatCard label="Firma" value={counts.companies} />
        <StatCard label="Hat" value={counts.lines} />
        <StatCard label="Araç" value={counts.vehicles} />
      </section>
    </AdminShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
