"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, CalendarDays, Car, ClipboardCheck, FileClock, FileText, GitBranch, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, LoadingState, PageHeaderShell } from "../../components/ui";
import { getBrowserClient } from "../../lib/browser-client";

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
    const db = getBrowserClient();
    if (!db) {
      setIsLoading(false);
      return;
    }
    const client = db;

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
        title="Yönetim Paneli"
        description="Aktif işler, tamamlanmayı bekleyen kayıtlar ve organizasyon kapsamı."
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
        <section aria-label="Operasyon özeti" className="operations-dashboard">
          <div className="operations-dashboard-main">
            <Link className="operations-focus" href="/assignments">
              <span className="operations-focus-icon"><ClipboardCheck aria-hidden size={22} /></span>
              <span className="operations-focus-copy">
                <span>Aktif montajlar</span>
                <strong>{counts.assignments}</strong>
                <small>Atanmış veya sahada devam eden işler</small>
              </span>
              <span className="operations-focus-action">Atamaları aç</span>
            </Link>

            <div className="operations-support-grid">
              <Link href="/reports">
                <CalendarDays aria-hidden size={19} />
                <span><small>Bu ayki raporlar</small><strong>{counts.monthlyReports}</strong></span>
              </Link>
              <Link href="/reports">
                <FileClock aria-hidden size={19} />
                <span><small>Tamamlanmayı bekleyen taslaklar</small><strong>{counts.drafts}</strong></span>
              </Link>
            </div>
          </div>

          <aside className="operations-report-total">
            <div>
              <FileText aria-hidden size={20} />
              <span>Rapor arşivi</span>
            </div>
            <strong>{counts.totalReports}</strong>
            <p>Organizasyon kapsamında kayıtlı toplam rapor.</p>
            <Link href="/reports">Rapor listesini aç</Link>
          </aside>

          <div className="operations-registers">
            <div className="operations-registers-heading">
              <h2>Operasyon altyapısı</h2>
              <p>Atama ve rapor akışında kullanılan güncel kayıt kapsamı.</p>
            </div>
            <div className="operations-register-list">
              <RegisterMetric href="/personnel" icon={Users} label="Personel" value={counts.personnel} />
              <RegisterMetric href="/companies" icon={Building2} label="Firmalar" value={counts.companies} />
              <RegisterMetric href="/lines" icon={GitBranch} label="Hatlar" value={counts.lines} />
              <RegisterMetric href="/vehicles" icon={Car} label="Araçlar" value={counts.vehicles} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function RegisterMetric({ href, icon: Icon, label, value }: { href: string; icon: LucideIcon; label: string; value: number }) {
  return (
    <Link href={href}>
      <Icon aria-hidden size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}
