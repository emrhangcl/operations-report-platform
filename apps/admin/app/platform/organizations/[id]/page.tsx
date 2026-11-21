"use client";

import {
  IconArrowLeft,
  IconCircleX,
  IconDownload,
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconShieldCheck,
  IconTrash,
  IconUpload
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ConfirmDialog, EmptyState } from "@/components/firm-ui";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Separator } from "@/components/shadcn/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { platformRequest, PlatformRequestError, usePlatformDashboard } from "../../_components/platform-client";
import type { OrganizationAction, OrganizationDetail } from "../../_components/platform-types";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  formatDate,
  formatMoney,
  OwnerEmpty,
  OwnerLoading,
  OwnerPage,
  OwnerPageHeader,
  OwnerPanel,
  StatusBadge
} from "../../_components/platform-ui";

type DetailTab = "users" | "payments" | "exports" | "logs";
type PendingConfirmation =
  | { action: OrganizationAction; kind: "organization-action"; message: string }
  | { kind: "export"; message: string }
  | { kind: "remove-logo"; message: string }
  | { kind: "delete-organization"; message: string };

export default function PlatformOrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
  const [deletionConfirmation, setDeletionConfirmation] = useState("");

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
    if (pending.kind === "delete-organization" && deletionConfirmation.trim() !== detail?.organization.slug) return;

    setPendingConfirmation(null);
    if (pending.kind === "organization-action") {
      void runAction(pending.action);
    } else if (pending.kind === "export") {
      void requestExport();
    } else if (pending.kind === "delete-organization") {
      void deleteOrganization();
    } else {
      void removeLogo();
    }
  }

  async function deleteOrganization() {
    setBusy("delete");
    setError("");
    setNotice("");
    try {
      await platformRequest(`/api/platform/organizations/${params.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmationSlug: deletionConfirmation.trim(), confirmDeletion: true })
      });
      await reloadDashboard();
      router.replace("/platform/organizations");
    } catch (deleteError) {
      await loadDetail();
      setError(deleteError instanceof Error ? deleteError.message : "Firma silinemedi. Tekrar deneyin.");
    } finally {
      setBusy("");
    }
  }

  if (loading) return <OwnerPage><OwnerLoading /></OwnerPage>;
  if (!detail) return <OwnerPage><OwnerPageHeader description="Firma kaydı açılamadı." eyebrow="Müşteri yönetimi" title="Firma bulunamadı" />{error ? <Alert tone="error">{error}</Alert> : null}</OwnerPage>;

  const organization = detail.organization;
  const deletionPending = Boolean(organization.deletion_started_at);
  const historyTabs = [
    { value: "users", label: "Kullanıcılar", count: detail.members.length },
    { value: "payments", label: "Ödemeler", count: detail.payments.length },
    { value: "exports", label: "Dışa Aktarımlar", count: detail.exportRequests.length },
    { value: "logs", label: "İşlem Kayıtları", count: detail.auditLogs.length }
  ] as const;

  return (
    <OwnerPage>
      <OwnerPageHeader
        actions={<Button asChild size="sm" variant="outline"><Link href="/platform/organizations"><IconArrowLeft /> Firma listesi</Link></Button>}
        description={`${organization.slug} · ${organization.billing_email ?? "Faturalandırma e-postası yok"}`}
        eyebrow="Firma ayrıntısı"
        title={organization.name}
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hesap özeti</CardTitle>
            <CardDescription>{organization.legal_name ?? organization.name} · {organization.tax_identifier ?? "Vergi bilgisi girilmedi"}</CardDescription>
            <CardAction><StatusBadge status={organization.status} /></CardAction>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Abonelik</dt><dd><StatusBadge status={currentSubscription?.status} /></dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Dönem</dt><dd className="text-sm font-medium">{currentSubscription?.billing_interval ?? "Tanımlanmadı"}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Zaman dilimi</dt><dd className="text-sm font-medium">{organization.timezone}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Kayıt tarihi</dt><dd className="text-sm font-medium tabular-nums">{formatDate(organization.created_at)}</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Kullanıcı</dt><dd className="text-sm font-medium tabular-nums">{detail.members.filter((member) => member.is_active).length} aktif</dd></div>
              <div className="flex flex-col gap-1"><dt className="text-sm text-muted-foreground">Son güncelleme</dt><dd className="text-sm font-medium tabular-nums">{formatDate(organization.updated_at)}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <OwnerPanel description="Bu işlemler yalnızca platform sahibi tarafından uygulanabilir." title="Erişim ve abonelik">
          <div className="flex flex-wrap gap-2">
            {organization.status === "active" ? (
              <Button disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "suspend" }, kind: "organization-action", message: "Bu firma askıya alınsın mı?" })} size="sm" type="button" variant="outline"><IconPlayerPause /> Askıya al</Button>
            ) : !deletionPending ? (
              <Button disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "activate" }, kind: "organization-action", message: "Bu firma yeniden açılsın mı? Mevcut aboneliği korunur; erişim abonelik durumuna göre belirlenir." })} size="sm" type="button" variant="outline"><IconPlayerPlay /> {organization.status === "closed" ? "Firmayı yeniden aç" : "Aktifleştir"}</Button>
            ) : null}
            {currentSubscription?.status === "lifetime" ? (
              <Button disabled={Boolean(busy) || !planId || organization.status === "closed"} onClick={() => setPendingConfirmation({ action: { action: "remove_lifetime", planId, billingInterval }, kind: "organization-action", message: "Ömür boyu erişim kaldırılıp seçili paket ödeme bekliyor durumuna alınsın mı?" })} size="sm" type="button" variant="outline">Ömür boyu erişimi kaldır</Button>
            ) : (
              <Button disabled={Boolean(busy) || organization.status === "closed"} onClick={() => setPendingConfirmation({ action: { action: "grant_lifetime" }, kind: "organization-action", message: "Bu firmaya ömür boyu erişim verilsin mi?" })} size="sm" type="button"><IconShieldCheck /> Ömür boyu erişim ver</Button>
            )}
          </div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-plan">Paket</Label>
              <Select disabled={Boolean(busy)} onValueChange={setPlanId} value={planId}>
                <SelectTrigger className="w-full" id="organization-plan" size="sm">
                  <SelectValue placeholder="Paket seçin" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((plan) => <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-interval">Dönem</Label>
              <Select disabled={Boolean(busy)} onValueChange={(value) => setBillingInterval(value as "monthly" | "yearly")} value={billingInterval}>
                <SelectTrigger className="w-full sm:w-32" id="organization-interval" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Aylık</SelectItem>
                  <SelectItem value="yearly">Yıllık</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button disabled={Boolean(busy) || !planId || organization.status === "closed"} onClick={() => setPendingConfirmation({ action: { action: "change_plan", planId, billingInterval }, kind: "organization-action", message: "Firmanın paketi değiştirilsin ve ödeme bekliyor durumuna alınsın mı?" })} size="sm" type="button" variant="outline">Paketi değiştir</Button>
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button disabled={Boolean(busy) || deletionPending} onClick={() => setPendingConfirmation({ kind: "export", message: "Bu firma için veri dışa aktarma talebi oluşturulsun mu?" })} size="sm" type="button" variant="ghost"><IconDownload /> Verileri dışa aktar</Button>
            {organization.status !== "closed" ? <Button disabled={Boolean(busy)} onClick={() => setPendingConfirmation({ action: { action: "start_closure" }, kind: "organization-action", message: "Kapatma süreci başlatılsın mı? Firma verileri silinmez." })} size="sm" type="button" variant="destructive"><IconCircleX /> Kapatma sürecini başlat</Button> : null}
            <Button disabled={Boolean(busy)} onClick={() => {
              setDeletionConfirmation("");
              setPendingConfirmation({ kind: "delete-organization", message: "Firma, ona bağlı yönetici ve personel giriş hesapları, raporlar, fotoğraflar ve abonelik kayıtları kalıcı olarak silinir. Bu işlem geri alınamaz. Platform yöneticisi ve başka firmaya bağlı hesaplar korunur." });
            }} size="sm" type="button" variant="destructive"><IconTrash /> {busy === "delete" ? "Firma ve hesaplar siliniyor…" : deletionPending ? "Silme işlemini tamamla" : "Firma ve hesaplarını sil"}</Button>
          </div>
          {deletionPending ? <p className="text-sm text-muted-foreground" role="status">Kalıcı silme işlemi başladı. Firma erişimi kapalıdır. İşlem yarıda kaldıysa “Silme işlemini tamamla” ile tekrar deneyin.</p> : null}
        </OwnerPanel>
      </div>

      <OwnerPanel description="Admin ve personel ekranlarında bu firmaya özel marka gösterilir." title="Firma logosu">
        <div className="grid grid-cols-1 gap-4 @3xl/main:grid-cols-2">
          <div className="flex min-h-32 items-center justify-center rounded-lg border p-4">
            {organization.logo_url ? (
              <Image alt={`${organization.name} logosu`} className="h-auto max-h-28 w-auto max-w-full object-contain" height={112} src={organization.logo_url} unoptimized width={300} />
            ) : (
              <EmptyState className="py-6" title="Logo yüklenmedi">Varsayılan portal markası kullanılıyor.</EmptyState>
            )}
          </div>
          <form className="flex flex-col gap-3" onSubmit={uploadLogo}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="organization-logo">Logo dosyası</Label>
              <Input
                accept="image/png,image/jpeg,image/webp"
                disabled={Boolean(busy) || deletionPending}
                id="organization-logo"
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
              <p className="text-sm text-muted-foreground">PNG, JPG veya WebP. En fazla 2 MB.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={Boolean(busy) || deletionPending || !logoFile} size="sm" type="submit">
                {busy === "logo" ? <IconLoader2 className="animate-spin" /> : <IconUpload />}
                Logoyu kaydet
              </Button>
              {organization.logo_url ? <Button disabled={Boolean(busy) || deletionPending} onClick={() => setPendingConfirmation({ kind: "remove-logo", message: "Bu firmanın logosu kaldırılsın mı?" })} size="sm" type="button" variant="destructive"><IconTrash /> Logoyu kaldır</Button> : null}
            </div>
          </form>
        </div>
      </OwnerPanel>

      <OwnerPanel title="Firma geçmişi">
        <Tabs className="gap-4" onValueChange={(value) => setTab(value as DetailTab)} value={tab}>
          <TabsList aria-label="Firma geçmişi bölümleri" className="**:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
            {historyTabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label} {item.count > 0 ? <Badge variant="secondary">{item.count}</Badge> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users">
            {detail.members.length === 0 ? <OwnerEmpty text="Bu firmada kullanıcı bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader><DataTableRow><DataTableHead>Kullanıcı</DataTableHead><DataTableHead>E-posta</DataTableHead><DataTableHead>Rol</DataTableHead><DataTableHead>Durum</DataTableHead></DataTableRow></DataTableHeader>
                  <DataTableBody>
                    {detail.members.map((member) => (
                      <DataTableRow key={member.profile_id}>
                        <DataTableCell className="font-medium">{member.profile ? `${member.profile.first_name} ${member.profile.last_name}` : "Profil bulunamadı"}</DataTableCell>
                        <DataTableCell>{member.profile?.email ?? "E-posta yok"}</DataTableCell>
                        <DataTableCell>{member.role}</DataTableCell>
                        <DataTableCell><StatusBadge status={member.is_active ? "active" : "suspended"} /></DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </TabsContent>
          <TabsContent value="payments">
            {detail.payments.length === 0 ? <OwnerEmpty text="Ödeme kaydı bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader><DataTableRow><DataTableHead>Tutar</DataTableHead><DataTableHead>Sağlayıcı</DataTableHead><DataTableHead>Tarih</DataTableHead><DataTableHead>Durum</DataTableHead></DataTableRow></DataTableHeader>
                  <DataTableBody>
                    {detail.payments.map((payment) => (
                      <DataTableRow key={payment.id}>
                        <DataTableCell className="font-medium tabular-nums">{formatMoney(payment.amount_minor, payment.currency)}</DataTableCell>
                        <DataTableCell>{payment.provider}</DataTableCell>
                        <DataTableCell className="tabular-nums">{formatDate(payment.created_at)}</DataTableCell>
                        <DataTableCell><StatusBadge status={payment.status} /></DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </TabsContent>
          <TabsContent value="exports">
            {detail.exportRequests.length === 0 ? <OwnerEmpty text="Dışa aktarma talebi bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader><DataTableRow><DataTableHead>Kapsam</DataTableHead><DataTableHead>Talep tarihi</DataTableHead><DataTableHead>Durum</DataTableHead></DataTableRow></DataTableHeader>
                  <DataTableBody>
                    {detail.exportRequests.map((request) => (
                      <DataTableRow key={request.id}>
                        <DataTableCell className="font-medium">{request.scope === "organization" ? "Firma verisi" : request.scope}</DataTableCell>
                        <DataTableCell className="tabular-nums">{formatDate(request.requested_at)}</DataTableCell>
                        <DataTableCell><StatusBadge status={request.status} /></DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </TabsContent>
          <TabsContent value="logs">
            {detail.auditLogs.length === 0 ? <OwnerEmpty text="İşlem kaydı bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader><DataTableRow><DataTableHead>İşlem</DataTableHead><DataTableHead>Kayıt türü</DataTableHead><DataTableHead>Tarih</DataTableHead><DataTableHead>Yapan</DataTableHead></DataTableRow></DataTableHeader>
                  <DataTableBody>
                    {detail.auditLogs.map((audit) => (
                      <DataTableRow key={audit.id}>
                        <DataTableCell className="font-medium">{audit.action}</DataTableCell>
                        <DataTableCell><Badge className="px-1.5 text-muted-foreground" variant="outline">{audit.entity_table}</Badge></DataTableCell>
                        <DataTableCell className="tabular-nums">{formatDate(audit.created_at)}</DataTableCell>
                        <DataTableCell className="font-mono text-xs text-muted-foreground">{audit.actor_id ? audit.actor_id.slice(0, 8) : "sistem"}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </TabsContent>
        </Tabs>
      </OwnerPanel>
      <ConfirmDialog
        confirmDisabled={pendingConfirmation?.kind === "delete-organization" && deletionConfirmation.trim() !== organization.slug}
        confirmLabel={pendingConfirmation?.kind === "delete-organization" ? "Kalıcı olarak sil" : "Onayla"}
        description={<>{pendingConfirmation?.message}{pendingConfirmation?.kind === "delete-organization" ? (
          <label className="mt-4 flex flex-col gap-2 text-foreground">
            <span>Onay için firma kodunu yazın: <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{organization.slug}</code></span>
            <Input autoComplete="off" onChange={(event) => setDeletionConfirmation(event.target.value)} spellCheck={false} value={deletionConfirmation} />
          </label>
        ) : null}</>}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
        open={Boolean(pendingConfirmation)}
        title={pendingConfirmation?.kind === "delete-organization" ? "Firma ve hesaplarını kalıcı olarak sil" : "İşlem onayı"}
      />
    </OwnerPage>
  );
}
