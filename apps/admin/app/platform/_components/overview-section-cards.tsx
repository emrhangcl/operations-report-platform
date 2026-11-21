"use client";

import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { Badge } from "@/components/shadcn/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";
import { periodChange } from "@/lib/platform-activity";
import type { DailyActivity, PlatformMetrics } from "./platform-types";
import { formatMoney } from "./platform-ui";

const percentFormat = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const countFormat = new Intl.NumberFormat("tr-TR");

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
  const TrendIcon = percent !== null && percent < 0 ? IconTrendingDown : IconTrendingUp;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
        {percent !== null ? (
          <CardAction>
            <Badge variant="outline">
              <TrendIcon />
              {percentFormat.format(percent / 100)}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {footer} {percent !== null ? <TrendIcon className="size-4" /> : null}
        </div>
        <div className="text-muted-foreground">{detail}</div>
      </CardFooter>
    </Card>
  );
}

// shadcn dashboard-01 "SectionCards" birebir. Rozet yalnizca onceki 30 gunle karsilastirma
// yapilabildiginde gorunur (onceki donem bos ise yuzde tanimsizdir).
export function OverviewSectionCards({ metrics, activity }: { metrics: PlatformMetrics; activity: DailyActivity[] }) {
  const collected = periodChange(activity, "collectedMinor", 30);
  const organizations = periodChange(activity, "newOrganizations", 30);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <SectionCard
        detail="İadeler düşülmüş başarılı ödemeler"
        footer={`Son 30 gün: ${formatMoney(collected.current)}`}
        label="Toplam tahsilat"
        percent={collected.percent}
        value={formatMoney(metrics.successful_collected_minor)}
      />
      <SectionCard
        detail="Son 30 günde açılan firmalar"
        footer={`Toplam ${countFormat.format(metrics.total_organizations)} kayıtlı firma`}
        label="Yeni firmalar"
        percent={organizations.percent}
        value={countFormat.format(organizations.current)}
      />
      <SectionCard
        detail="Aktif hesabı olan kullanıcılar"
        footer={`${countFormat.format(metrics.active_subscriptions)} aktif abonelik`}
        label="Aktif kullanıcı"
        value={countFormat.format(metrics.active_users)}
      />
      <SectionCard
        detail="Aboneliklerden aylık gelir"
        footer={`${countFormat.format(metrics.pending_payments)} ödeme bekliyor`}
        label="Aylık düzenli gelir"
        value={formatMoney(metrics.mrr_minor)}
      />
    </div>
  );
}
