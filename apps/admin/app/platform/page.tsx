"use client";

import { Activity, ArrowUpRight, PackageOpen, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Skeleton } from "@/components/shadcn/skeleton";
import { OverviewActivityChart } from "./_components/overview-activity-chart";
import { OverviewOrganizationsTable } from "./_components/overview-organizations-table";
import { OverviewSectionCards } from "./_components/overview-section-cards";
import { usePlatformDashboard } from "./_components/platform-client";
import { formatDate } from "./_components/platform-ui";

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Panel yükleniyor" className="flex flex-col gap-4 md:gap-6" role="status">
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton className="h-[138px] rounded-xl" key={item} />
        ))}
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
      <div className="px-4 lg:px-6">
        <Skeleton className="h-[320px] rounded-xl" />
      </div>
    </div>
  );
}

const countFormat = new Intl.NumberFormat("tr-TR");

export default function PlatformOverviewPage() {
  const { data, error, loading, reload } = usePlatformDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const metrics = data.metrics;
  const organizationNames = useMemo(
    () => new Map(data.organizations.map((organization) => [organization.id, organization.name])),
    [data.organizations]
  );
  const largestPlan = Math.max(1, ...metrics.plan_distribution.map((item) => item.organization_count));
  const publicPlanCount = data.plans.filter((plan) => plan.is_active && plan.is_public).length;

  async function refresh() {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between lg:px-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-semibold tracking-tight">Genel Bakış</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Gelir, abonelik, firma ve sistem sağlığının güncel özeti.
            </p>
          </div>
          <Button disabled={refreshing || loading} onClick={refresh} size="sm" variant="outline">
            <RefreshCw aria-hidden className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
            Yenile
          </Button>
        </div>

        {error ? (
          <div className="mx-4 rounded-lg border border-destructive/50 px-4 py-3 text-sm text-destructive lg:mx-6" role="alert">
            {error}
          </div>
        ) : null}

        {loading ? (
          <OverviewSkeleton />
        ) : (
          <>
            <OverviewSectionCards activity={data.activity} metrics={metrics} />
            <div className="px-4 lg:px-6">
              <OverviewActivityChart activity={data.activity} />
            </div>
            <OverviewOrganizationsTable organizations={data.organizations} plans={data.plans} />

            <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2 @6xl/main:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Son hareketler</CardTitle>
                  <CardDescription>Son yönetim ve sistem olayları</CardDescription>
                  <CardAction>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/platform/logs">
                        Tümü <ArrowUpRight aria-hidden />
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {data.auditLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Henüz sistem kaydı bulunmuyor.</p>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {data.auditLogs.slice(0, 6).map((audit) => (
                        <li className="flex items-start gap-3" key={audit.id}>
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                            <Activity aria-hidden className="size-4" />
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">{audit.action}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {organizationNames.get(audit.organizationId ?? "") ?? "Platform"} · {formatDate(audit.createdAt)}
                            </span>
                          </div>
                          <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">{audit.entityTable}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Paket dağılımı</CardTitle>
                  <CardDescription>Aktif aboneliklerin paketlere göre dağılımı</CardDescription>
                  <CardAction>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/platform/plans">
                        Paketler <ArrowUpRight aria-hidden />
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  {metrics.plan_distribution.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Paketli firma bulunmuyor.</p>
                  ) : (
                    <ul className="flex flex-col gap-4">
                      {metrics.plan_distribution.map((item) => (
                        <li className="flex flex-col gap-2" key={item.plan_name}>
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{item.plan_name}</span>
                            <span className="font-medium tabular-nums">{countFormat.format(item.organization_count)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/70"
                              style={{ width: `${Math.max(4, (item.organization_count / largestPlan) * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="@3xl/main:col-span-2 @6xl/main:col-span-1">
                <CardHeader>
                  <CardTitle>Sistem sağlığı</CardTitle>
                  <CardDescription>Kritik platform kontrollerinin son durumu</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-4">
                    <li className="flex items-start gap-3">
                      {metrics.payment_error_count > 0 ? (
                        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
                      ) : (
                        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Ödeme olayları</span>
                        <span className={metrics.payment_error_count > 0 ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
                          {metrics.payment_error_count > 0
                            ? `${metrics.payment_error_count} işleme hatası incelenmeli.`
                            : "İşleme hatası bulunmuyor."}
                        </span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <PackageOpen aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Satışa açık paketler</span>
                        <span className="text-sm text-muted-foreground">{publicPlanCount} paket web sitesinde yayınlanıyor.</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Son yedekleme kaydı</span>
                        <span className="text-sm text-muted-foreground">{formatDate(metrics.last_successful_backup_at)}</span>
                      </div>
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full" variant="outline">
                    <Link href="/platform/system">
                      Sistem ayrıntılarını aç <ArrowUpRight aria-hidden />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
