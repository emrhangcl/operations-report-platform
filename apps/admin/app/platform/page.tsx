"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  FileClock,
  LogOut,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BillingInterval, OrganizationStatus, SubscriptionStatus } from "@operations/types";
import { ProductBrand } from "../../components/logo";
import { getBrowserSupabase } from "../../lib/supabase-browser";

interface PlatformMetrics {
  total_organizations: number;
  active_subscriptions: number;
  monthly_subscriptions: number;
  yearly_subscriptions: number;
  lifetime_subscriptions: number;
  pending_payments: number;
  failed_renewals: number;
  canceled_subscriptions: number;
  grace_period_accounts: number;
  read_only_accounts: number;
  mrr_minor: number;
  arr_minor: number;
  successful_collected_minor: number;
  refunded_total_minor: number;
  new_organizations_30d: number;
  active_users: number;
  payment_error_count: number;
  last_successful_backup_at: string | null;
  plan_distribution: Array<{ plan_name: string; organization_count: number }>;
}

interface Plan {
  id: string;
  code: string;
  name: string;
  currency: string;
  monthly_price_minor: number | null;
  yearly_price_minor: number | null;
  is_active: boolean;
  is_public: boolean;
}

interface OrganizationSubscription {
  id: string;
  status: SubscriptionStatus;
  billing_interval: BillingInterval;
  plan_id: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  grace_period_ends_at: string | null;
  is_current: boolean;
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  billing_email: string | null;
  created_at: string;
  closed_at: string | null;
  subscription: OrganizationSubscription | null;
}

interface PaymentEvent {
  id: string;
  organizationId: string | null;
  provider: string;
  eventType: string;
  signatureVerified: boolean;
  processedAt: string | null;
  receivedAt: string;
  hasError: boolean;
}

interface GlobalAuditLog {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  createdAt: string;
}

interface DashboardPayload {
  metrics: PlatformMetrics;
  plans: Plan[];
  organizations: OrganizationRow[];
  paymentEvents: PaymentEvent[];
  auditLogs: GlobalAuditLog[];
}

interface OrganizationMember {
  profile_id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
  } | null;
}

interface OrganizationPayment {
  id: string;
  provider: string;
  status: string;
  amount_minor: number;
  refunded_amount_minor: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}

interface OrganizationSubscriptionHistory extends OrganizationSubscription {
  provider: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OrganizationAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
}

interface ExportRequest {
  id: string;
  organization_id: string;
  scope: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
}

interface OrganizationDetail {
  organization: OrganizationRow & {
    legal_name: string | null;
    tax_identifier: string | null;
    timezone: string;
    updated_at: string;
  };
  members: OrganizationMember[];
  subscriptions: OrganizationSubscriptionHistory[];
  payments: OrganizationPayment[];
  auditLogs: OrganizationAuditLog[];
  exportRequests: ExportRequest[];
}

type OrganizationAction =
  | { action: "suspend" | "activate" | "start_closure" | "grant_lifetime"; planId?: null; billingInterval?: null }
  | { action: "remove_lifetime" | "change_plan"; planId: string; billingInterval: "monthly" | "yearly" };

const emptyMetrics: PlatformMetrics = {
  total_organizations: 0,
  active_subscriptions: 0,
  monthly_subscriptions: 0,
  yearly_subscriptions: 0,
  lifetime_subscriptions: 0,
  pending_payments: 0,
  failed_renewals: 0,
  canceled_subscriptions: 0,
  grace_period_accounts: 0,
  read_only_accounts: 0,
  mrr_minor: 0,
  arr_minor: 0,
  successful_collected_minor: 0,
  refunded_total_minor: 0,
  new_organizations_30d: 0,
  active_users: 0,
  payment_error_count: 0,
  last_successful_backup_at: null,
  plan_distribution: []
};

const emptyDashboard: DashboardPayload = {
  metrics: emptyMetrics,
  plans: [],
  organizations: [],
  paymentEvents: [],
  auditLogs: []
};

const statusLabels: Record<OrganizationStatus | SubscriptionStatus, string> = {
  active: "Aktif",
  suspended: "Askıda",
  closed: "Kapatıldı",
  pending: "Ödeme bekliyor",
  past_due: "Vadesi geçti",
  grace_period: "Ek süre",
  read_only: "Salt okunur",
  canceled: "İptal edildi",
  lifetime: "Lifetime"
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Kayıt yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kayıt yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul"
  }).format(date);
}

function formatMoney(minor: number | null | undefined, currency = "TRY") {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "Veri yok";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

function statusClass(status: string | null | undefined) {
  return `platform-status platform-status-${status ?? "unknown"}`;
}

function statusLabel(status: string | null | undefined) {
  return status && status in statusLabels ? statusLabels[status as keyof typeof statusLabels] : "Bilinmiyor";
}

function planName(plans: Plan[], planId: string | null | undefined) {
  return plans.find((plan) => plan.id === planId)?.name ?? "Paket seçilmedi";
}

export default function PlatformPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [planId, setPlanId] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getAccessToken = useCallback(async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const loadDashboard = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const response = await fetch("/api/platform/dashboard", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401 || response.status === 403) {
      router.replace("/forbidden");
      return;
    }

    if (!response.ok) {
      throw new Error("Platform paneli verileri alınamadı.");
    }

    const next = (await response.json()) as DashboardPayload;
    setDashboard({ ...emptyDashboard, ...next, metrics: { ...emptyMetrics, ...next.metrics } });
    setSelectedOrganizationId((current) =>
      current && next.organizations.some((organization) => organization.id === current) ? current : next.organizations[0]?.id ?? null
    );
  }, [getAccessToken, router]);

  const loadDetail = useCallback(async (organizationId: string) => {
    const token = await getAccessToken();
    if (!token) return;

    setDetailLoading(true);
    try {
      const response = await fetch(`/api/platform/organizations/${organizationId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        router.replace("/forbidden");
        return;
      }

      if (!response.ok) {
        throw new Error("Firma detayları alınamadı.");
      }

      setDetail((await response.json()) as OrganizationDetail);
    } finally {
      setDetailLoading(false);
    }
  }, [getAccessToken, router]);

  useEffect(() => {
    loadDashboard()
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Platform paneli açılamadı."))
      .finally(() => setLoading(false));
  }, [loadDashboard]);

  useEffect(() => {
    if (selectedOrganizationId) {
      loadDetail(selectedOrganizationId).catch(() => setError("Firma detayları alınamadı."));
    } else {
      setDetail(null);
    }
  }, [loadDetail, selectedOrganizationId]);

  useEffect(() => {
    const currentSubscription = detail?.subscriptions.find((subscription) => subscription.is_current);
    setPlanId(currentSubscription?.plan_id ?? dashboard.plans.find((plan) => plan.is_active)?.id ?? "");
    setBillingInterval(currentSubscription?.billing_interval === "yearly" ? "yearly" : "monthly");
  }, [dashboard.plans, detail]);

  const organizationNames = useMemo(
    () => new Map(dashboard.organizations.map((organization) => [organization.id, organization.name])),
    [dashboard.organizations]
  );

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      await loadDashboard();
      if (selectedOrganizationId) await loadDetail(selectedOrganizationId);
      setNotice("Platform verileri yenilendi.");
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : "Platform paneli yenilenemedi.");
    } finally {
      setRefreshing(false);
    }
  }

  async function signOut() {
    const supabase = getBrowserSupabase();
    await supabase?.auth.signOut();
    router.replace("/login");
  }

  async function runOrganizationAction(organizationId: string, action: OrganizationAction, confirmation: string) {
    if (!window.confirm(confirmation)) return;

    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setBusyAction(`${organizationId}:${action.action}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/platform/organizations/${organizationId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(action)
      });
      const responseBody = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(responseBody.message ?? "Platform işlemi uygulanamadı.");
      }

      setNotice("Platform işlemi uygulandı ve audit kaydına yazıldı.");
      await loadDashboard();
      await loadDetail(organizationId);
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Platform işlemi uygulanamadı.");
    } finally {
      setBusyAction("");
    }
  }

  async function requestOrganizationExport(organizationId: string) {
    if (!window.confirm("Bu firma için veri dışa aktarma talebi oluşturulsun mu?")) return;

    const token = await getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setBusyAction(`${organizationId}:export`);
    setError("");
    try {
      const response = await fetch(`/api/platform/organizations/${organizationId}/exports`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scope: "organization" })
      });
      const responseBody = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) throw new Error(responseBody.message ?? "Dışa aktarma talebi oluşturulamadı.");
      setNotice("Dışa aktarma talebi kuyruğa alındı.");
      await loadDetail(organizationId);
    } catch (exportError: unknown) {
      setError(exportError instanceof Error ? exportError.message : "Dışa aktarma talebi oluşturulamadı.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return <main className="platform-loading"><ShieldCheck aria-hidden size={22} /> Platform paneli yükleniyor...</main>;
  }

  const metrics = dashboard.metrics;
  const selectedOrganization = detail?.organization ?? null;
  const currentSubscription = detail?.subscriptions.find((subscription) => subscription.is_current) ?? null;
  const activePlans = dashboard.plans.filter((plan) => plan.is_active);

  return (
    <main className="platform-page">
      <header className="platform-topbar">
        <Link className="platform-brand" href="/platform">
          <ProductBrand />
          <span className="platform-context-label">Platform Yönetimi</span>
        </Link>
        <nav className="platform-topbar-actions" aria-label="Platform menüsü">
          <Link className="button secondary" href="/app">
            <Building2 aria-hidden size={17} /> Firma paneli
          </Link>
          <button className="button subtle" onClick={signOut} type="button">
            <LogOut aria-hidden size={17} /> Çıkış
          </button>
        </nav>
      </header>

      <div className="platform-container">
        <section className="platform-page-heading">
          <div>
            <span className="platform-eyebrow">Merkezi platform yönetimi</span>
            <h1>Platform paneli</h1>
            <p>Firma, abonelik, ödeme ve güvenlik durumunu yalnızca doğrulanmış kayıtlar üzerinden yönetin.</p>
          </div>
          <button className="button secondary" disabled={refreshing} onClick={refresh} type="button">
            <RefreshCw aria-hidden className={refreshing ? "platform-spin" : ""} size={17} /> Yenile
          </button>
        </section>

        {notice ? <div className="message info">{notice}</div> : null}
        {error ? <div className="message error">{error}</div> : null}

        <section className="platform-metric-grid" aria-label="Platform metrikleri">
          <MetricCard icon={<Building2 aria-hidden size={18} />} label="Kayıtlı firma" value={metrics.total_organizations} />
          <MetricCard icon={<CheckCircle2 aria-hidden size={18} />} label="Aktif abonelik" value={metrics.active_subscriptions} />
          <MetricCard label="Aylık abonelik" value={metrics.monthly_subscriptions} />
          <MetricCard label="Yıllık abonelik" value={metrics.yearly_subscriptions} />
          <MetricCard label="Lifetime abonelik" value={metrics.lifetime_subscriptions} tone="ok" />
          <MetricCard icon={<CircleDollarSign aria-hidden size={18} />} label="Bekleyen ödeme" value={metrics.pending_payments} tone="warn" />
          <MetricCard icon={<AlertTriangle aria-hidden size={18} />} label="Başarısız yenileme" value={metrics.failed_renewals} tone="danger" />
          <MetricCard label="İptal edilen" value={metrics.canceled_subscriptions} />
          <MetricCard label="Grace period" value={metrics.grace_period_accounts} tone="warn" />
          <MetricCard label="Salt okunur" value={metrics.read_only_accounts} tone="warn" />
          <MetricCard label="Son 30 gün kayıt" value={metrics.new_organizations_30d} />
          <MetricCard icon={<UserRound aria-hidden size={18} />} label="Aktif kullanıcı" value={metrics.active_users} />
          <MetricCard label="MRR" value={formatMoney(metrics.mrr_minor)} />
          <MetricCard label="ARR" value={formatMoney(metrics.arr_minor)} />
          <MetricCard label="Başarılı tahsilat" value={formatMoney(metrics.successful_collected_minor)} tone="ok" />
          <MetricCard label="İade toplamı" value={formatMoney(metrics.refunded_total_minor)} tone="warn" />
        </section>

        <section className="platform-summary-grid">
          <div className="platform-panel platform-plan-panel">
            <PanelHeading icon={<CircleDollarSign aria-hidden size={18} />} title="Paket dağılımı" />
            {metrics.plan_distribution.length === 0 ? (
              <EmptyState text="Henüz paketli firma bulunmuyor." />
            ) : (
              <ul className="platform-list">
                {metrics.plan_distribution.map((distribution) => (
                  <li key={distribution.plan_name}>
                    <span>{distribution.plan_name}</span>
                    <strong>{distribution.organization_count}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="platform-note-row">
              <span>Net gelir</span>
              <strong>Sağlayıcı verisi yok</strong>
            </div>
            <div className="platform-note-row">
              <span>Son başarılı yedekleme</span>
              <strong>{formatDate(metrics.last_successful_backup_at)}</strong>
            </div>
          </div>

          <div className="platform-panel">
            <PanelHeading icon={<AlertTriangle aria-hidden size={18} />} title="Sistem ve güvenlik uyarıları" />
            <div className="platform-alert-list">
              <div className={metrics.payment_error_count > 0 ? "platform-alert danger" : "platform-alert ok"}>
                {metrics.payment_error_count > 0 ? <AlertTriangle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}
                <div>
                  <strong>Ödeme olayları</strong>
                  <span>{metrics.payment_error_count > 0 ? `${metrics.payment_error_count} işleme hatası var.` : "İşleme hatası bulunmuyor."}</span>
                </div>
              </div>
              <div className="platform-alert warn">
                <FileClock aria-hidden size={18} />
                <div>
                  <strong>Yedekleme kaydı</strong>
                  <span>{metrics.last_successful_backup_at ? formatDate(metrics.last_successful_backup_at) : "Harici yedekleme kaydı bağlanmadı."}</span>
                </div>
              </div>
            </div>
            <p className="platform-disclaimer">Kart bilgileri ve hassas ödeme alanları bu panelde gösterilmez.</p>
          </div>
        </section>

        <section className="platform-workspace-grid">
          <div className="platform-panel platform-organizations-panel">
            <PanelHeading icon={<Building2 aria-hidden size={18} />} title="Firmalar" detail={`${dashboard.organizations.length} kayıt`} />
            {dashboard.organizations.length === 0 ? (
              <EmptyState text="Henüz kayıtlı firma bulunmuyor." />
            ) : (
              <div className="platform-table-scroll">
                <table className="platform-table">
                  <thead>
                    <tr>
                      <th>Firma</th>
                      <th>Durum</th>
                      <th>Abonelik</th>
                      <th>Oluşturulma</th>
                      <th><span className="sr-only">İşlemler</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.organizations.map((organization) => {
                      const isSelected = selectedOrganizationId === organization.id;
                      const statusBusy = busyAction === `${organization.id}:suspend` || busyAction === `${organization.id}:activate`;
                      return (
                        <tr className={isSelected ? "selected" : ""} key={organization.id}>
                          <td>
                            <button className="platform-row-link" onClick={() => setSelectedOrganizationId(organization.id)} type="button">
                              <strong>{organization.name}</strong>
                              <span>{organization.slug}</span>
                            </button>
                          </td>
                          <td><span className={statusClass(organization.status)}>{statusLabel(organization.status)}</span></td>
                          <td>
                            <strong>{organization.subscription ? statusLabel(organization.subscription.status) : "Yok"}</strong>
                            <span className="platform-table-muted">{organization.subscription ? planName(dashboard.plans, organization.subscription.plan_id) : "Ödeme bekliyor"}</span>
                          </td>
                          <td>{formatDate(organization.created_at)}</td>
                          <td>
                            <div className="platform-row-actions">
                              <button className="button subtle compact" onClick={() => setSelectedOrganizationId(organization.id)} type="button">
                                Detay <ChevronRight aria-hidden size={15} />
                              </button>
                              {organization.status === "active" ? (
                                <button
                                  aria-label={`${organization.name} firmasını askıya al`}
                                  className="icon-button compact danger"
                                  disabled={statusBusy}
                                  onClick={() => runOrganizationAction(organization.id, { action: "suspend" }, "Bu firma askıya alınsın mı?")}
                                  title="Firmayı askıya al"
                                  type="button"
                                >
                                  <PauseCircle aria-hidden size={17} />
                                </button>
                              ) : organization.status === "suspended" ? (
                                <button
                                  aria-label={`${organization.name} firmasını aktifleştir`}
                                  className="icon-button compact"
                                  disabled={statusBusy}
                                  onClick={() => runOrganizationAction(organization.id, { action: "activate" }, "Bu firma aktifleştirilsin mı?")}
                                  title="Firmayı aktifleştir"
                                  type="button"
                                >
                                  <PlayCircle aria-hidden size={17} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="platform-panel platform-detail-panel">
            {detailLoading && !detail ? <EmptyState text="Firma detayı yükleniyor..." /> : null}
            {!detailLoading && !selectedOrganization ? <EmptyState text="Detay görmek için bir firma seçin." /> : null}
            {selectedOrganization ? (
              <>
                <div className="platform-detail-heading">
                  <div>
                    <span className="platform-eyebrow">Firma detayı</span>
                    <h2>{selectedOrganization.name}</h2>
                    <p>{selectedOrganization.slug}</p>
                  </div>
                  <span className={statusClass(selectedOrganization.status)}>{statusLabel(selectedOrganization.status)}</span>
                </div>
                <dl className="platform-detail-kv">
                  <div><dt>Faturalandırma e-postası</dt><dd>{selectedOrganization.billing_email ?? "Kayıt yok"}</dd></div>
                  <div><dt>Zaman dilimi</dt><dd>{selectedOrganization.timezone}</dd></div>
                  <div><dt>Kayıt tarihi</dt><dd>{formatDate(selectedOrganization.created_at)}</dd></div>
                  <div><dt>Mevcut abonelik</dt><dd>{currentSubscription ? `${statusLabel(currentSubscription.status)} / ${currentSubscription.billing_interval}` : "Kayıt yok"}</dd></div>
                </dl>

                <section className="platform-control-section">
                  <PanelHeading icon={<ShieldCheck aria-hidden size={18} />} title="Yetkili işlemler" />
                  <div className="platform-control-actions">
                    {selectedOrganization.status === "active" ? (
                      <button className="button subtle" disabled={busyAction !== ""} onClick={() => runOrganizationAction(selectedOrganization.id, { action: "suspend" }, "Bu firma askıya alınsın mı?")} type="button">
                        <PauseCircle aria-hidden size={17} /> Askıya al
                      </button>
                    ) : selectedOrganization.status === "suspended" ? (
                      <button className="button subtle" disabled={busyAction !== ""} onClick={() => runOrganizationAction(selectedOrganization.id, { action: "activate" }, "Bu firma aktifleştirilsin mı?")} type="button">
                        <PlayCircle aria-hidden size={17} /> Aktifleştir
                      </button>
                    ) : null}
                    {selectedOrganization.status !== "closed" ? (
                      <button className="button danger" disabled={busyAction !== ""} onClick={() => runOrganizationAction(selectedOrganization.id, { action: "start_closure" }, "Kapatma süreci başlatılsın mı? Veriler silinmez.")} type="button">
                        <XCircle aria-hidden size={17} /> Kapatma sürecini başlat
                      </button>
                    ) : null}
                    {currentSubscription?.status === "lifetime" ? (
                      <button className="button secondary" disabled={busyAction !== ""} onClick={() => runOrganizationAction(selectedOrganization.id, { action: "remove_lifetime", planId, billingInterval }, "Lifetime erişim kaldırılıp ücretli paket beklemeye alınsın mı?")} type="button">
                        Lifetime kaldır
                      </button>
                    ) : (
                      <button className="button" disabled={busyAction !== "" || selectedOrganization.status === "closed"} onClick={() => runOrganizationAction(selectedOrganization.id, { action: "grant_lifetime" }, "Bu firmaya devredilemez lifetime erişim verilsin mi?")} type="button">
                        Lifetime ver
                      </button>
                    )}
                  </div>
                  <div className="platform-plan-controls">
                    <label className="field">
                      <span>Paket</span>
                      <select disabled={activePlans.length === 0 || busyAction !== ""} onChange={(event) => setPlanId(event.target.value)} value={planId}>
                        <option value="">Paket seçin</option>
                        {activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>Dönem</span>
                      <select disabled={busyAction !== ""} onChange={(event) => setBillingInterval(event.target.value as "monthly" | "yearly")} value={billingInterval}>
                        <option value="monthly">Aylık</option>
                        <option value="yearly">Yıllık</option>
                      </select>
                    </label>
                    <button
                      className="button secondary"
                      disabled={!planId || activePlans.length === 0 || busyAction !== "" || selectedOrganization.status === "closed"}
                      onClick={() => runOrganizationAction(selectedOrganization.id, { action: "change_plan", planId, billingInterval }, "Seçilen paket bu firma için ödeme bekliyor durumuna alınsın mı?")}
                      type="button"
                    >
                      Paketi değiştir
                    </button>
                  </div>
                  <button className="button subtle platform-export-button" disabled={busyAction !== ""} onClick={() => requestOrganizationExport(selectedOrganization.id)} type="button">
                    <Download aria-hidden size={17} /> Veri dışa aktarma talebi oluştur
                  </button>
                </section>

                <DetailList title="Kullanıcılar" icon={<UserRound aria-hidden size={17} />}>
                  {detail?.members.length ? detail.members.map((member) => (
                    <li key={member.profile_id}>
                      <div><strong>{member.profile ? `${member.profile.first_name} ${member.profile.last_name}` : "Profil bulunamadı"}</strong><span>{member.profile?.email ?? "E-posta yok"}</span></div>
                      <span className={member.is_active ? "platform-mini-state ok" : "platform-mini-state"}>{member.role}{member.is_active ? "" : " / pasif"}</span>
                    </li>
                  )) : <EmptyListItem text="Bu firmada kullanıcı bulunmuyor." />}
                </DetailList>

                <DetailList title="Ödeme geçmişi" icon={<CircleDollarSign aria-hidden size={17} />}>
                  {detail?.payments.length ? detail.payments.slice(0, 8).map((payment) => (
                    <li key={payment.id}>
                      <div><strong>{formatMoney(payment.amount_minor, payment.currency)}</strong><span>{payment.provider} / {formatDate(payment.created_at)}</span></div>
                      <span className={statusClass(payment.status)}>{statusLabel(payment.status)}</span>
                    </li>
                  )) : <EmptyListItem text="Ödeme kaydı bulunmuyor." />}
                </DetailList>

                <DetailList title="Dışa aktarma talepleri" icon={<Download aria-hidden size={17} />}>
                  {detail?.exportRequests.length ? detail.exportRequests.slice(0, 5).map((request) => (
                    <li key={request.id}>
                      <div><strong>{request.scope === "organization" ? "Firma verisi" : request.scope}</strong><span>{formatDate(request.requested_at)}</span></div>
                      <span className="platform-mini-state">{request.status}</span>
                    </li>
                  )) : <EmptyListItem text="Dışa aktarma talebi bulunmuyor." />}
                </DetailList>

                <DetailList title="Audit log" icon={<FileClock aria-hidden size={17} />}>
                  {detail?.auditLogs.length ? detail.auditLogs.slice(0, 8).map((audit) => (
                    <li key={audit.id}>
                      <div><strong>{audit.action}</strong><span>{audit.entity_table} / {formatDate(audit.created_at)}</span></div>
                      <span className="platform-table-muted">{audit.actor_id ? audit.actor_id.slice(0, 8) : "sistem"}</span>
                    </li>
                  )) : <EmptyListItem text="Audit kaydı bulunmuyor." />}
                </DetailList>
              </>
            ) : null}
          </aside>
        </section>

        <section className="platform-lower-grid">
          <div className="platform-panel">
            <PanelHeading icon={<CircleDollarSign aria-hidden size={18} />} title="Son webhook olayları" />
            {dashboard.paymentEvents.length === 0 ? <EmptyState text="Henüz webhook olayı bulunmuyor." /> : (
              <ul className="platform-list platform-event-list">
                {dashboard.paymentEvents.map((event) => (
                  <li key={event.id}>
                    <div><strong>{event.eventType}</strong><span>{organizationNames.get(event.organizationId ?? "") ?? "Firma yok"} / {event.provider}</span></div>
                    <span className={event.hasError ? "platform-mini-state danger" : "platform-mini-state ok"}>{event.hasError ? "Hatalı" : event.signatureVerified ? "Doğrulandı" : "Doğrulanmadı"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="platform-panel">
            <PanelHeading icon={<FileClock aria-hidden size={18} />} title="Son platform işlemleri" />
            {dashboard.auditLogs.length === 0 ? <EmptyState text="Henüz platform işlemi bulunmuyor." /> : (
              <ul className="platform-list platform-event-list">
                {dashboard.auditLogs.map((audit) => (
                  <li key={audit.id}>
                    <div><strong>{audit.action}</strong><span>{organizationNames.get(audit.organizationId ?? "") ?? "Firma yok"} / {formatDate(audit.createdAt)}</span></div>
                    <span className="platform-table-muted">{audit.entityTable}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <Link className="platform-back-link" href="/">
          <ArrowLeft aria-hidden size={16} /> Ürün ana sayfasına dön
        </Link>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, value, tone = "" }: { icon?: React.ReactNode; label: string; value: React.ReactNode; tone?: string }) {
  return <div className={`platform-metric-card ${tone ? `tone-${tone}` : ""}`}><div className="platform-metric-label">{icon}{label}</div><strong>{value}</strong></div>;
}

function PanelHeading({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return <div className="platform-panel-heading"><h2>{icon}{title}</h2>{detail ? <span>{detail}</span> : null}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="platform-empty"><FileClock aria-hidden size={19} /><span>{text}</span></div>;
}

function EmptyListItem({ text }: { text: string }) {
  return <li className="platform-empty-list-item">{text}</li>;
}

function DetailList({ children, icon, title }: { children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return <section className="platform-detail-list"><PanelHeading icon={icon} title={title} /><ul>{children}</ul></section>;
}
