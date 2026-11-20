"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import type { DailyActivity } from "./platform-types";
import { formatMoney } from "./platform-ui";

type Series = "collectedMinor" | "newOrganizations";
type Range = "90" | "30" | "7";

const chartConfig = {
  collectedMinor: { label: "Tahsilat", color: "var(--chart-1)" },
  newOrganizations: { label: "Yeni firma", color: "var(--chart-2)" }
} satisfies ChartConfig;

const ranges: Array<{ value: Range; label: string }> = [
  { value: "90", label: "Son 3 ay" },
  { value: "30", label: "Son 30 gün" },
  { value: "7", label: "Son 7 gün" }
];

const countFormat = new Intl.NumberFormat("tr-TR");
const dayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDayFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Seri gunleri zaten Istanbul takvimindeki YYYY-MM-DD; UTC gece yarisi olarak okuyup UTC'de
// bicimlemek tarayicinin saat diliminden bagimsiz ayni gunu gosterir.
function formatDay(value: string, format: Intl.DateTimeFormat) {
  return format.format(new Date(`${value}T00:00:00Z`));
}

function formatValue(series: Series, value: number) {
  return series === "collectedMinor" ? formatMoney(value) : countFormat.format(value);
}

// shadcn dashboard-01 "ChartAreaInteractive" + "Bar Chart - Interactive" baslik kutulari.
export function OverviewActivityChart({ activity }: { activity: DailyActivity[] }) {
  const [series, setSeries] = useState<Series>("collectedMinor");
  const [range, setRange] = useState<Range>("90");

  const data = useMemo(() => activity.slice(-Number(range)), [activity, range]);
  const totals = useMemo(
    () => ({
      collectedMinor: data.reduce((sum, day) => sum + day.collectedMinor, 0),
      newOrganizations: data.reduce((sum, day) => sum + day.newOrganizations, 0)
    }),
    [data]
  );
  const isEmpty = data.every((day) => day[series] === 0);
  const rangeLabel = ranges.find((item) => item.value === range)?.label ?? "";

  function changeRange(value: string) {
    if (value === "90" || value === "30" || value === "7") setRange(value);
  }

  return (
    <Card className="@container/card py-0">
      <CardHeader className="flex flex-col items-stretch gap-0 border-b p-0! @[767px]/card:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-3 px-6 pt-4 pb-3 @[767px]/card:py-4!">
          <div className="flex flex-col gap-1">
            <CardTitle>Tahsilat ve yeni firmalar</CardTitle>
            <CardDescription>{rangeLabel} için günlük toplamlar</CardDescription>
          </div>
          <ToggleGroup
            className="hidden w-fit *:data-[slot=toggle-group-item]:px-3! @[767px]/card:flex"
            onValueChange={changeRange}
            size="sm"
            type="single"
            value={range}
            variant="outline"
          >
            {ranges.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select onValueChange={changeRange} value={range}>
            <SelectTrigger aria-label="Zaman aralığı" className="flex w-40 @[767px]/card:hidden" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {ranges.map((item) => (
                <SelectItem className="rounded-lg" key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex" role="group" aria-label="Gösterilen seri">
          {(Object.keys(chartConfig) as Series[]).map((key) => (
            <button
              aria-pressed={series === key}
              className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors even:border-l hover:bg-muted/30 data-[active=true]:bg-muted/50 @[767px]/card:border-t-0 @[767px]/card:border-l @[767px]/card:px-8 @[767px]/card:py-6"
              data-active={series === key}
              key={key}
              onClick={() => setSeries(key)}
              type="button"
            >
              <span className="text-xs text-muted-foreground">{chartConfig[key].label}</span>
              <span className="text-lg leading-none font-bold tabular-nums @[767px]/card:text-2xl">
                {formatValue(key, totals[key])}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 pb-6 sm:px-6 sm:pt-6">
        {isEmpty ? (
          <div className="flex h-[250px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center">
            <p className="text-sm font-medium">Henüz tahsilat veya yeni kayıt yok</p>
            <p className="text-sm text-muted-foreground">
              {rangeLabel} içinde {chartConfig[series].label.toLocaleLowerCase("tr-TR")} kaydı bulunmuyor.
            </p>
          </div>
        ) : (
          <ChartContainer className="aspect-auto h-[250px] w-full" config={chartConfig}>
            <AreaChart data={data} margin={{ left: 12, right: 12 }}>
              <defs>
                <linearGradient id={`fill-${series}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${series})`} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={`var(--color-${series})`} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={32}
                tickFormatter={(value: string) => formatDay(value, dayFormat)}
                tickLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">{chartConfig[series].label}</span>
                        <span className="font-mono font-medium tabular-nums">{formatValue(series, Number(value))}</span>
                      </span>
                    )}
                    indicator="dot"
                    labelFormatter={(value) => formatDay(String(value), fullDayFormat)}
                  />
                }
                cursor={false}
              />
              <Area
                dataKey={series}
                fill={`url(#fill-${series})`}
                stroke={`var(--color-${series})`}
                type="monotone"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
