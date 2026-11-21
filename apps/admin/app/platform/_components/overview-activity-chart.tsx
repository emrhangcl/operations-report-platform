"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DailyActivity } from "./platform-types";

const chartConfig = {
  activity: { label: "Hareket" },
  newOrganizations: { label: "Yeni firma", color: "var(--primary)" },
  payments: { label: "Ödeme", color: "var(--primary)" }
} satisfies ChartConfig;

const rangeLabels: Record<string, string> = { "90d": "Son 3 ay", "30d": "Son 30 gün", "7d": "Son 7 gün" };
const rangeDays: Record<string, number> = { "90d": 90, "30d": 30, "7d": 7 };

// Seri gunleri Istanbul takvimindeki YYYY-MM-DD; UTC gece yarisi olarak okuyup UTC'de
// bicimlemek tarayicinin saat diliminden bagimsiz ayni gunu gosterir.
const dayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
function formatDay(value: unknown) {
  return dayFormat.format(new Date(`${String(value)}T00:00:00Z`));
}

// shadcn dashboard-01 "ChartAreaInteractive" birebir: iki yigilmis alan, sagda aralik secimi.
export function OverviewActivityChart({ activity }: { activity: DailyActivity[] }) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d");
  }, [isMobile]);

  const filteredData = activity.slice(-(rangeDays[timeRange] ?? 90));
  const label = rangeLabels[timeRange] ?? rangeLabels["90d"];

  function changeRange(value: string) {
    if (value in rangeDays) setTimeRange(value);
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Ödeme ve yeni firma hareketi</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">{label} için günlük toplam</span>
          <span className="@[540px]/card:hidden">{label}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
            onValueChange={changeRange}
            type="single"
            value={timeRange}
            variant="outline"
          >
            <ToggleGroupItem value="90d">Son 3 ay</ToggleGroupItem>
            <ToggleGroupItem value="30d">Son 30 gün</ToggleGroupItem>
            <ToggleGroupItem value="7d">Son 7 gün</ToggleGroupItem>
          </ToggleGroup>
          <Select onValueChange={changeRange} value={timeRange}>
            <SelectTrigger
              aria-label="Zaman aralığı"
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
            >
              <SelectValue placeholder="Son 3 ay" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem className="rounded-lg" value="90d">
                Son 3 ay
              </SelectItem>
              <SelectItem className="rounded-lg" value="30d">
                Son 30 gün
              </SelectItem>
              <SelectItem className="rounded-lg" value="7d">
                Son 7 gün
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer className="aspect-auto h-[250px] w-full" config={chartConfig}>
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillNewOrganizations" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-newOrganizations)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-newOrganizations)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillPayments" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-payments)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-payments)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="date" minTickGap={32} tickFormatter={formatDay} tickLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={formatDay} />} />
            <Area dataKey="payments" fill="url(#fillPayments)" stackId="a" stroke="var(--color-payments)" type="natural" />
            <Area
              dataKey="newOrganizations"
              fill="url(#fillNewOrganizations)"
              stackId="a"
              stroke="var(--color-newOrganizations)"
              type="natural"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
