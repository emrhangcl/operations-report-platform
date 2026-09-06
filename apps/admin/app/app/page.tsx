"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, CalendarDays, Car, ClipboardCheck, FileClock, FileText, GitBranch, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, LoadingState, PageHeaderShell } from "../../components/ui";
import { getBrowserSupabase } from "../../lib/supabase-browser";

interface DashboardCounts {
  totalReports: number;
  monthlyReports: number;
  drafts: number;
  assignments: number;
  personnel: number;
  companies: number;
  lines: number;
  vehicles: number;
}

const emptyCounts: DashboardCounts = {
  totalReports: 0,
  monthlyReports: 0,
  drafts: 0,
  assignments: 0,
  personnel: 0,
  companies: 0,
  lines: 0,
  vehicles: 0
};

export default function DashboardPage() {
  const [counts, setCounts] = useState(emptyCounts);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    const client = supabase;

    async function load() {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const [totalReports, monthlyReports, drafts, assignments, personnel, companies, lines, vehicles] = await Promise.all([
        client.from("reports").select("id", { count: "exact", head: true }),
        client.from("reports").select("id", { count: "exact", head: true }).gte("report_date", firstDay),
        client.from("reports").select("id", { count: "exact", head: true }).eq("status", "DRAFT"),
        client.from("installation_assignments").select("id", { count: "exact", head: true }).in("status", ["ASSIGNED", "IN_PROGRESS"]),
        client.from("profiles").select("id", { count: "exact", head: true }).eq("role", "PERSONNEL"),
        client.from("companies").select("id", { count: "exact", head: true }),
        client.from("company_lines").select("id", { count: "exact", head: true }),
        client.from("vehicles").select("id", { count: "exact", head: true })
      ]);

      if ([totalReports, monthlyReports, drafts, assignments, personnel, companies, lines, vehicles].some((result) => result.error)) {
        setError("Dashboard bilgileri alınamadı. Bağlantınızı kontrol edin.");
        setIsLoading(false);
        return;
      }

      setCounts({
        totalReports: totalReports.count ?? 0,
        monthlyReports: monthlyReports.count ?? 0,
        drafts: drafts.count ?? 0,
        assignments: assignments.count ?? 0,
        personnel: personnel.count ?? 0,
        companies: companies.count ?? 0,
        lines: lines.count ?? 0,
        vehicles: vehicles.count ?? 0
      });
      setIsLoading(false);
    }

    load().catch(() => {
      setError("Dashboard bilgileri alınamadı. Bağlantınızı kontrol edin.");
      setIsLoading(false);
    });
  }, []);

  return (
    <>
      <PageHeaderShell
        eyebrow="Operasyon merkezi"
        title="Yönetim Paneli"
        description="Güncel operasyon, rapor ve kayıt özeti."
        action={(
          <Link className="button" href="/assignments">
            <ClipboardCheck aria-hidden size={18} /> Montaj Ata
          </Link>
        )}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {isLoading ? (
        <LoadingState label="Operasyon özeti hazırlanıyor..." />
      ) : (
        <section aria-label="Operasyon metrikleri" className="grid stats">
          <StatCard href="/reports" icon={FileText} label="Toplam Rapor" value={counts.totalReports} />
          <StatCard href="/reports" icon={CalendarDays} label="Bu Ayki Raporlar" value={counts.monthlyReports} />
          <StatCard href="/reports" icon={FileClock} label="Taslaklar" value={counts.drafts} />
          <StatCard href="/assignments" icon={ClipboardCheck} label="Aktif Montajlar" value={counts.assignments} />
          <StatCard href="/personnel" icon={Users} label="Personel" value={counts.personnel} />
          <StatCard href="/companies" icon={Building2} label="Firma" value={counts.companies} />
          <StatCard href="/lines" icon={GitBranch} label="Hat" value={counts.lines} />
          <StatCard href="/vehicles" icon={Car} label="Araç" value={counts.vehicles} />
        </section>
      )}
    </>
  );
}

function StatCard({ href, icon: Icon, label, value }: { href: string; icon: LucideIcon; label: string; value: number }) {
  return (
    <Link className="card stat-card" href={href}>
      <span className="stat-icon"><Icon aria-hidden size={18} /></span>
      <span className="stat-content">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
      </span>
    </Link>
  );
}
