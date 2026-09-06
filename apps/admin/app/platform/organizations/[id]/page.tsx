"use client";

import {
  ArrowLeft,
  CircleDollarSign,
  Download,
  FileClock,
  ImagePlus,
  LoaderCircle,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  XCircle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "../../../../components/ui";
import { platformRequest, PlatformRequestError, usePlatformDashboard } from "../../_components/platform-client";
import type { OrganizationAction, OrganizationDetail } from "../../_components/platform-types";
import { formatDate, formatMoney, OwnerEmpty, OwnerLoading, OwnerPageHeader, OwnerPanel, StatusBadge } from "../../_components/platform-ui";

type DetailTab = "users" | "payments" | "exports" | "logs";
type PendingConfirmation =
  | { action: OrganizationAction; kind: "organization-action"; message: string }
  | { kind: "export"; message: string }
  | { kind: "remove-logo"; message: string };

export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: dashboard, reload: reloadDashboard } = usePlatformDashboard();
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<DetailTab>("users");
  const [planId, setPlanId] = useState("");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  const loadDetail = useCallback(async () => {
    setError("");
    try {
      setDetail(await platformRequest<OrganizationDetail>(`/api/platform/organizations/${params.id}`));
    } catch (requestError) {
      if (requestError instanceof PlatformRequestError && (requestError.status === 401 || requestError.status === 403)) {
        window.location.assign(requestError.status === 401 ? "/login" : "/forbidden");
        return;
      }
      setError(requestError instanceof Error ? requestError.message : "Firma ayrıntısı alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const currentSubscription = detail?.subscriptions.find((subscription) => subscription.is_current) ?? null;
  const activePlans = useMemo(() => dashboard.plans.filter((plan) => plan.is_active), [dashboard.plans]);

  useEffect(() => {
    setPlanId(currentSubscription?.plan_id ?? activePlans[0]?.id ?? "");
    setBillingInterval(currentSubscription?.billing_interval === "yearly" ? "yearly" : "monthly");
  }, [activePlans, currentSubscription?.billing_interval, currentSubscription?.plan_id]);

  async function runAction(action: OrganizationAction) {
    setBusy(action.action);
    setError("");
    setNotice("");
    try {
      await platformRequest(`/api/platform/organizations/${params.id}`, { method: "PATCH", body: JSON.stringify(action) });
      setNotice("İşlem uygulandı ve sistem kaydına işlendi.");
      await Promise.all([loadDetail(), reloadDashboard()]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "İşlem uygulanamadı.");
    } finally {
      setBusy("");
    }
  }

  async function requestExport() {
    setBusy("export");
    setError("");
    try {
      await platformRequest(`/api/platform/organizations/${params.id}/exports`, {
        method: "POST",
        body: JSON.stringify({ scope: "organization" })
      });
      setNotice("Dışa aktarma talebi kuyruğa alındı.");
      await loadDetail();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Dışa aktarma talebi oluşturulamadı.");
    } finally {
      setBusy("");
    }
  }

  async function uploadLogo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!logoFile) {
      setError("Önce bir logo dosyası seçin.");
      return;
    }

    setBusy("logo");
    setError("");
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("logo", logoFile);
      await platformRequest(`/api/platform/organizations/${params.id}/logo`, {
        method: "POST",
        body: formData
      });
      setLogoFile(null);
      setLogoInputKey((value) => value + 1);
      setNotice("Firma logosu güncellendi.");
      await loadDetail();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Logo yüklenemedi.");
    } finally {
      setBusy("");
    }
  }

  async function removeLogo() {
    setBusy("logo");
    setError("");
    setNotice("");
    try {
      await platformRequest(`/api/platform/organizations/${params.id}/logo`, { method: "DELETE" });
      setLogoFile(null);
      setLogoInputKey((value) => value + 1);
      setNotice("Firma logosu kaldırıldı.");
      await loadDetail();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Logo kaldırılamadı.");
    } finally {
      setBusy("");
    }
  }

  function confirmPendingAction() {
    const pending = pendingConfirmation;
    if (!pending) return;

    setPendingConfirmation(null);
    if (pending.kind === "organization-action") {
      void runAction(pending.action);
    } else if (pending.kind === "export") {
      void requestExport();
    } else {
      void removeLogo();
    }
  }

  if (loading) return <div className="owner-page"><OwnerLoading /></div>;
  if (!detail) return <div className="owner-page"><OwnerPageHeader description="Firma kaydı açılamadı." eyebrow="Müşteri yönetimi" title="Firma bulunamadı" />{error ? <div className="owner-message error">{error}</div> : null}</div>;

  const organization = detail.organization;

  return (
    <div className="owner-page">
      <OwnerPageHeader
        actions={<Link className="owner-button owner-button-secondary" href="/platform/organizations"><ArrowLeft aria-hidden size={17} /> Firma listesi</Link>}
        description={`${organization.slug} · ${organization.billing_email ?? "Faturalandırma e-postası yok"}`}
        eyebrow="Firma ayrıntısı"
        title={organization.name}
      />
      {notice ? <div className="owner-message success" role="status">{notice}</div> : null}
      {error ? <div className="owner-message error" role="alert">{error}</div> : null}

      <div className="owner-detail-grid">
        <OwnerPanel title="Hesap özeti">
          <div className="owner-detail-heading"><span className="owner-company-avatar">{organization.name.slice(0, 2).toLocaleUpperCase("tr-TR")}</span><div><strong>{organization.legal_name ?? organization.name}</strong><span>{organization.tax_identifier ?? "Vergi bilgisi girilmedi"}</span></div><StatusBadge status={organization.status} /></div>
          <dl className="owner-key-values">
            <div><dt>Abonelik</dt><dd><StatusBadge status={currentSubscription?.status} /></dd></div>
            <div><dt>Dönem</dt><dd>{currentSubscription?.billing_interval ?? "Tanımlanmadı"}</dd></div>
            <div><dt>Zaman dilimi</dt><dd>{organization.timezone}</dd></div>
            <div><dt>Kayıt tarihi</dt><dd>{formatDate(organization.created_at)}</dd></div>
            <div><dt>Kullanıcı</dt><dd>{detail.members.filter((member) => member.is_active).length} aktif</dd></div>
            <div><dt>Son güncelleme</dt><dd>{formatDate(organization.updated_at)}</dd></div>
          </dl>
        </OwnerPanel>

        <OwnerPanel description="Bu işlemler yalnızca platform sahibi tarafından uygulanabilir." title="Erişim ve abonelik">
          <div className="owner-action-row">
            {organization.status === "active" ? (
              <button className="owner-button owner-button-secondary" disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "suspend" }, kind: "organization-action", message: "Bu firma askıya alınsın mı?" })} type="button"><PauseCircle aria-hidden size={17} /> Askıya al</button>
            ) : organization.status === "suspended" ? (
              <button className="owner-button owner-button-secondary" disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "activate" }, kind: "organization-action", message: "Bu firma yeniden aktifleştirilsin mi?" })} type="button"><PlayCircle aria-hidden size={17} /> Aktifleştir</button>
            ) : null}
            {currentSubscription?.status === "lifetime" ? (
              <button className="owner-button owner-button-secondary" disabled={Boolean(busy) || !planId} onClick={() => setPendingConfirmation({ action: { action: "remove_lifetime", planId, billingInterval }, kind: "organization-action", message: "Ömür boyu erişim kaldırılıp seçili paket ödeme bekliyor durumuna alınsın mı?" })} type="button">Ömür boyu erişimi kaldır</button>
            ) : (
              <button className="owner-button" disabled={Boolean(busy) || organization.status === "closed"} onClick={() => setPendingConfirmation({ action: { action: "grant_lifetime" }, kind: "organization-action", message: "Bu firmaya ömür boyu erişim verilsin mi?" })} type="button"><ShieldCheck aria-hidden size={17} /> Ömür boyu erişim ver</button>
            )}
          </div>
          <div className="owner-plan-controls">
            <label><span>Paket</span><select disabled={Boolean(busy)} onChange={(event) => setPlanId(event.target.value)} value={planId}><option value="">Paket seçin</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
            <label><span>Dönem</span><select disabled={Boolean(busy)} onChange={(event) => setBillingInterval(event.target.value as "monthly" | "yearly")} value={billingInterval}><option value="monthly">Aylık</option><option value="yearly">Yıllık</option></select></label>
            <button className="owner-button owner-button-secondary" disabled={Boolean(busy) || !planId || organization.status === "closed"} onClick={() => setPendingConfirmation({ action: { action: "change_plan", planId, billingInterval }, kind: "organization-action", message: "Firmanın paketi değiştirilsin ve ödeme bekliyor durumuna alınsın mı?" })} type="button">Paketi değiştir</button>
          </div>
          <div className="owner-danger-zone">
            <button className="owner-button owner-button-ghost" disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ kind: "export", message: "Bu firma için veri dışa aktarma talebi oluşturulsun mu?" })} type="button"><Download aria-hidden size={17} /> Verileri dışa aktar</button>
            {organization.status !== "closed" ? <button className="owner-button owner-button-danger" disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "start_closure" }, kind: "organization-action", message: "Kapatma süreci başlatılsın mı? Firma verileri silinmez." })} type="button"><XCircle aria-hidden size={17} /> Kapatma sürecini başlat</button> : null}
          </div>
        </OwnerPanel>
      </div>

      <OwnerPanel className="owner-branding-panel" description="Admin ve personel ekranlarında bu firmaya özel marka gösterilir." title="Firma logosu">
        <div className="owner-branding-layout">
          <div className="owner-branding-preview">
            {organization.logo_url ? (
              <Image alt={`${organization.name} logosu`} height={112} src={organization.logo_url} unoptimized width={300} />
            ) : (
              <div className="owner-branding-empty"><ImagePlus aria-hidden size={26} /><strong>Logo yüklenmedi</strong><span>Varsayılan portal markası kullanılıyor.</span></div>
            )}
          </div>
          <form className="owner-branding-form" onSubmit={uploadLogo}>
            <label>
              <span>Logo dosyası</span>
              <input
                accept="image/png,image/jpeg,image/webp"
                key={logoInputKey}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  if (nextFile && nextFile.size > 2 * 1024 * 1024) {
                    setError("Logo dosyası en fazla 2 MB olabilir.");
                    setLogoFile(null);
                    return;
                  }
                  setError("");
                  setLogoFile(nextFile);
                }}
                type="file"
              />
            </label>
            <small>PNG, JPG veya WebP. En fazla 2 MB.</small>
            <div className="owner-action-row">
              <button className="owner-button" disabled={Boolean(busy) || !logoFile} type="submit">
                {busy === "logo" ? <LoaderCircle aria-hidden className="spin" size={17} /> : <Upload aria-hidden size={17} />}
                Logoyu kaydet
              </button>
              {organization.logo_url ? <button className="owner-button owner-button-danger" disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ kind: "remove-logo", message: "Bu firmanın logosu kaldırılsın mı?" })} type="button"><Trash2 aria-hidden size={17} /> Logoyu kaldır</button> : null}
            </div>
          </form>
        </div>
      </OwnerPanel>

      <OwnerPanel className="owner-detail-tabs-panel" title="Firma geçmişi">
        <div aria-label="Firma geçmişi bölümleri" className="owner-tabs" role="tablist">
          {([
            ["users", "Kullanıcılar", UserRound, detail.members.length],
            ["payments", "Ödemeler", CircleDollarSign, detail.payments.length],
            ["exports", "Dışa Aktarımlar", Download, detail.exportRequests.length],
            ["logs", "İşlem Kayıtları", FileClock, detail.auditLogs.length]
          ] as const).map(([value, label, Icon, count]) => (
            <button aria-selected={tab === value} className={tab === value ? "active" : ""} key={value} onClick={() => setTab(value)} role="tab" type="button"><Icon aria-hidden size={17} /> {label}<span>{count}</span></button>
          ))}
        </div>

        {tab === "users" ? (
          detail.members.length === 0 ? <OwnerEmpty text="Bu firmada kullanıcı bulunmuyor." /> : <div className="owner-list">{detail.members.map((member) => <div key={member.profile_id}><span className="owner-list-icon"><UserRound aria-hidden size={17} /></span><div><strong>{member.profile ? `${member.profile.first_name} ${member.profile.last_name}` : "Profil bulunamadı"}</strong><span>{member.profile?.email ?? "E-posta yok"}</span></div><small>{member.role}</small><StatusBadge status={member.is_active ? "active" : "suspended"} /></div>)}</div>
        ) : null}
        {tab === "payments" ? (
          detail.payments.length === 0 ? <OwnerEmpty text="Ödeme kaydı bulunmuyor." /> : <div className="owner-list">{detail.payments.map((payment) => <div key={payment.id}><span className="owner-list-icon"><CircleDollarSign aria-hidden size={17} /></span><div><strong>{formatMoney(payment.amount_minor, payment.currency)}</strong><span>{payment.provider} · {formatDate(payment.created_at)}</span></div><StatusBadge status={payment.status} /></div>)}</div>
        ) : null}
        {tab === "exports" ? (
          detail.exportRequests.length === 0 ? <OwnerEmpty text="Dışa aktarma talebi bulunmuyor." /> : <div className="owner-list">{detail.exportRequests.map((request) => <div key={request.id}><span className="owner-list-icon"><Download aria-hidden size={17} /></span><div><strong>{request.scope === "organization" ? "Firma verisi" : request.scope}</strong><span>{formatDate(request.requested_at)}</span></div><StatusBadge status={request.status} /></div>)}</div>
        ) : null}
        {tab === "logs" ? (
          detail.auditLogs.length === 0 ? <OwnerEmpty text="İşlem kaydı bulunmuyor." /> : <div className="owner-list">{detail.auditLogs.map((audit) => <div key={audit.id}><span className="owner-list-icon"><FileClock aria-hidden size={17} /></span><div><strong>{audit.action}</strong><span>{audit.entity_table} · {formatDate(audit.created_at)}</span></div><small>{audit.actor_id ? audit.actor_id.slice(0, 8) : "sistem"}</small></div>)}</div>
        ) : null}
      </OwnerPanel>
      <ConfirmDialog
        description={pendingConfirmation?.message}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
        open={Boolean(pendingConfirmation)}
        title="İşlem onayı"
      />
    </div>
  );
}
