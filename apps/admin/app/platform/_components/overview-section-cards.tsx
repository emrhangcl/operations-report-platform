"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";
import { periodChange } from "@/lib/platform-activity";
import type { DailyActivity, PlatformMetrics } from "./platform-types";
import { formatMoney } from "./platform-ui";

const percentFormat = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });

function TrendBadge({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  const Icon = percent < 0 ? TrendingDown : TrendingUp;
  return (
    <CardAction>
      <Badge variant="outline">
        <Icon aria-hidden />
        {percentFormat.format(percent / 100)}
      </Badge>
    </CardAction>
  );
}

function SectionCard({
  label,
  value,
  percent = null,
  footer,
  detail
}: {
  label: string;
  value: string;
  percent?: number | null;
  footer: string;
  detail: string;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        <TrendBadge percent={percent} />
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 font-medium">{footer}</div>
        <div className="text-muted-foreground">{detail}</div>
      </CardFooter>
    </Card>
  );
}

const countFormat = new Intl.NumberFormat("tr-TR");

// shadcn dashboard-01 "SectionCards": dort KPI karti. Trend rozeti yalnizca onceki 30 gunle
// karsilastirma yapilabildiginde gorunur.
export function OverviewSectionCards({ metrics, activity }: { metrics: PlatformMetrics; activity: DailyActivity[] }) {
  const collected = periodChange(activity, "collectedMinor", 30);
  const organizations = periodChange(activity, "newOrganizations", 30);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <SectionCard
        detail={`${countFormat.format(metrics.active_subscriptions)} aktif abonelik`}
        footer="Aboneliklerden aylık gelir"
        label="Aylık düzenli gelir"
        value={formatMoney(metrics.mrr_minor)}
      />
      <SectionCard
        detail="İadeler düşülmüş başarılı ödemeler"
        footer={`Son 30 gün: ${formatMoney(collected.current)}`}
        label="Toplam tahsilat"
        percent={collected.percent}
        value={formatMoney(metrics.successful_collected_minor)}
      />
      <SectionCard
        detail="Tüm durumlardaki firmalar"
        footer={`Son 30 günde +${countFormat.format(metrics.new_organizations_30d)}`}
        label="Kayıtlı firma"
        percent={organizations.percent}
        value={countFormat.format(metrics.total_organizations)}
      />
      <SectionCard
        detail={`${countFormat.format(metrics.pending_payments)} ödeme bekliyor`}
        footer="Aktif hesabı olan kullanıcılar"
        label="Aktif kullanıcı"
        value={countFormat.format(metrics.active_users)}
      />
    </div>
  );
}
