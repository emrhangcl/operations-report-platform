"use client";

import {
  Activity,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  PackageOpen,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlatformDashboard } from "./_components/platform-client";
import {
  formatDate,
  formatMoney,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  OwnerEmpty,
  OwnerLoading,
  OwnerMetric,
  OwnerPageHeader,
  OwnerPanel,
  StatusBadge
} from "./_components/platform-ui";

export default function PlatformOverviewPage() {
  const { data, error, loading, reload } = usePlatformDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const metrics = data.metrics;
  const organizationNames = useMemo(
    () => new Map(data.organizations.map((organization) => [organization.id, organization.name])),
    [data.organizations]
  );
  const largestPlan = Math.max(1, ...metrics.plan_distribution.map((item) => item.organization_count));

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  return (
    <div className="owner-page">
      <OwnerPageHeader
        actions={(
          <button className="owner-button owner-button-secondary" disabled={refreshing} onClick={refresh} type="button">
            <RefreshCw aria-hidden className={refreshing ? "owner-spin" : ""} size={17} /> Yenile
          </button>
        )}
        description="Gelir, abonelik, müşteri ve sistem sağlığının güncel özeti. Ayrıntılar sol menüde kendi çalışma alanlarında bulunur."
        eyebrow="Platform merkezi"
        title="Genel Bakış"
      />

      {error ? <div className="owner-message error" role="alert">{error}</div> : null}
      {loading ? <OwnerLoading /> : (
        <>
          <section aria-label="Temel metrikler" className="owner-metric-grid">
            <OwnerMetric detail={`${metrics.active_subscriptions} aktif abonelik`} icon={<TrendingUp aria-hidden size={18} />} label="Aylık düzenli gelir" tone="blue" value={formatMoney(metrics.mrr_minor)} />
            <OwnerMetric detail={`Yıllık görünüm ${formatMoney(metrics.arr_minor)}`} icon={<CircleDollarSign aria-hidden size={18} />} label="Toplam tahsilat" tone="green" value={formatMoney(metrics.successful_collected_minor)} />
            <OwnerMetric detail={`Son 30 günde +${metrics.new_organizations_30d}`} icon={<Building2 aria-hidden size={18} />} label="Kayıtlı firma" tone="violet" value={metrics.total_organizations} />
            <OwnerMetric detail={`${metrics.pending_payments} ödeme bekliyor`} icon={<UsersRound aria-hidden size={18} />} label="Aktif kullanıcı" tone="orange" value={metrics.active_users} />
          </section>

          <section aria-label="Abonelik sağlığı" className="owner-health-grid owner-enter">
            {[
              ["Aylık", metrics.monthly_subscriptions],
              ["Yıllık", metrics.yearly_subscriptions],
              ["Ömür boyu", metrics.lifetime_subscriptions],
              ["Ek sürede", metrics.grace_period_accounts],
              ["Salt okunur", metrics.read_only_accounts],
              ["Başarısız yenileme", metrics.failed_renewals]
            ].map(([label, value]) => (
              <div className={label === "Başarısız yenileme" && Number(value) > 0 ? "warning" : ""} key={label}>
                <span>{label}</span><strong>{value}</strong>
              </div>
            ))}
          </section>

          <div className="owner-overview-grid">
            <OwnerPanel
              action={<Link className="owner-text-link" href="/platform/organizations">Tüm firmalar <ArrowUpRight aria-hidden size={15} /></Link>}
              description="Son eklenen ve güncel abonelik durumu bulunan hesaplar"
              title="Firma hareketi"
            >
              {data.organizations.length === 0 ? <OwnerEmpty text="Henüz kayıtlı firma bulunmuyor." /> : (
                <DataTablePanel className="owner-compact-table-wrap">
                  <DataTable className="owner-table">
                    <DataTableHeader><DataTableRow><DataTableHead>Firma</DataTableHead><DataTableHead>Durum</DataTableHead><DataTableHead>Abonelik</DataTableHead><DataTableHead>Kayıt</DataTableHead></DataTableRow></DataTableHeader>
                    <DataTableBody>
                      {data.organizations.slice(0, 6).map((organization) => (
                        <DataTableRow key={organization.id}>
                          <DataTableCell><Link className="owner-table-link" href={`/platform/organizations/${organization.id}`}><strong>{organization.name}</strong><span>{organization.slug}</span></Link></DataTableCell>
                          <DataTableCell><StatusBadge status={organization.status} /></DataTableCell>
                          <DataTableCell><StatusBadge status={organization.subscription?.status} /></DataTableCell>
                          <DataTableCell>{formatDate(organization.created_at, false)}</DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTablePanel>
              )}
            </OwnerPanel>

            <OwnerPanel
              action={<Link className="owner-text-link" href="/platform/plans">Paketleri yönet <ArrowUpRight aria-hidden size={15} /></Link>}
              description="Aktif aboneliklerin paketlere göre dağılımı"
              title="Paket dağılımı"
            >
              {metrics.plan_distribution.length === 0 ? <OwnerEmpty text="Paketli firma bulunmuyor." /> : (
                <div className="owner-distribution-list">
                  {metrics.plan_distribution.map((item, index) => (
                    <div key={item.plan_name}>
                      <div><span>{item.plan_name}</span><strong>{item.organization_count}</strong></div>
                      <span className="owner-progress"><i style={{ width: `${Math.max(8, item.organization_count / largestPlan * 100)}%`, animationDelay: `${index * 70}ms` }} /></span>
                    </div>
                  ))}
                </div>
              )}
            </OwnerPanel>
          </div>

          <div className="owner-overview-grid owner-overview-grid-lower">
            <OwnerPanel
              action={<Link className="owner-text-link" href="/platform/logs">Tüm kayıtlar <ArrowUpRight aria-hidden size={15} /></Link>}
              description="Son yönetim ve sistem olayları"
              title="Son hareketler"
            >
              {data.auditLogs.length === 0 ? <OwnerEmpty text="Henüz sistem kaydı bulunmuyor." /> : (
                <ul className="owner-activity-list">
                  {data.auditLogs.slice(0, 6).map((audit) => (
                    <li key={audit.id}>
                      <span className="owner-activity-icon"><Activity aria-hidden size={16} /></span>
                      <div><strong>{audit.action}</strong><span>{organizationNames.get(audit.organizationId ?? "") ?? "Platform"} · {formatDate(audit.createdAt)}</span></div>
                      <small>{audit.entityTable}</small>
                    </li>
                  ))}
                </ul>
              )}
            </OwnerPanel>

            <OwnerPanel description="Kritik platform kontrollerinin son durumu" title="Sistem sağlığı">
              <div className="owner-system-summary">
                <div className={metrics.payment_error_count > 0 ? "danger" : "success"}>
                  {metrics.payment_error_count > 0 ? <ShieldAlert aria-hidden size={20} /> : <ShieldCheck aria-hidden size={20} />}
                  <div><strong>Ödeme olayları</strong><span>{metrics.payment_error_count > 0 ? `${metrics.payment_error_count} işleme hatası incelenmeli.` : "İşleme hatası bulunmuyor."}</span></div>
                </div>
                <div>
                  <PackageOpen aria-hidden size={20} />
                  <div><strong>Satışa açık paketler</strong><span>{data.plans.filter((plan) => plan.is_active && plan.is_public).length} paket web sitesinde yayınlanıyor.</span></div>
                </div>
                <div>
                  <ShieldCheck aria-hidden size={20} />
                  <div><strong>Son yedekleme kaydı</strong><span>{formatDate(metrics.last_successful_backup_at)}</span></div>
                </div>
              </div>
              <Link className="owner-button owner-button-secondary owner-full-button" href="/platform/system">Sistem ayrıntılarını aç <ArrowUpRight aria-hidden size={16} /></Link>
            </OwnerPanel>
          </div>
        </>
      )}
    </div>
  );
}
