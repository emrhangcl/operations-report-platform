"use client";

import * as React from "react";
import Link from "next/link";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheckFilled,
  IconListDetails,
  IconLoader
} from "@tabler/icons-react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import type { ReportListItem } from "@operations/types";
import { Alert } from "@/components/firm-ui";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/shadcn/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { getBrowserClient } from "@/lib/browser-client";

interface DashboardData {
  totalReports: number;
  monthlyReports: number;
  drafts: number;
  activeAssignments: number;
  personnel: number;
  companies: number;
  activity: Array<{ date: string; reports: number; assignments: number }>;
  recentReports: ReportListItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const countFormat = new Intl.NumberFormat("tr-TR");
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function dayKey(value: Date) {
  return dayKeyFormat.format(value);
}
function formatDay(value: unknown) {
  return dayLabelFormat.format(new Date(`${String(value)}T00:00:00Z`));
}

function buildActivity(reports: Array<{ report_date: string }>, assignments: Array<{ created_at: string }>, now: Date) {
  const series: DashboardData["activity"] = [];
  const byDate = new Map<string, DashboardData["activity"][number]>();
  for (let offset = 89; offset >= 0; offset -= 1) {
    const date = dayKey(new Date(now.getTime() - offset * DAY_MS));
    if (byDate.has(date)) continue;
    const day = { date, reports: 0, assignments: 0 };
    byDate.set(date, day);
    series.push(day);
  }
  for (const report of reports) {
    const day = byDate.get(report.report_date.slice(0, 10));
    if (day) day.reports += 1;
  }
  for (const assignment of assignments) {
    const day = byDate.get(dayKey(new Date(assignment.created_at)));
    if (day) day.assignments += 1;
  }
  return series;
}

async function loadDashboard(): Promise<DashboardData> {
  const db = getBrowserClient();
  if (!db) throw new Error("Bağlantı kurulamadı.");
  const now = new Date();
  const firstOfMonth = `${dayKey(now).slice(0, 8)}01`;
  const since = dayKey(new Date(now.getTime() - 89 * DAY_MS));
  const [totalReports, monthlyReports, drafts, activeAssignments, personnel, companies, activityReports, activityAssignments, recent] =
    await Promise.all([
      db.from("reports").select("id", { count: "exact", head: true }),
      db.from("reports").select("id", { count: "exact", head: true }).gte("report_date", firstOfMonth),
      db.from("reports").select("id", { count: "exact", head: true }).eq("status", "DRAFT"),
      db.from("installation_assignments").select("id", { count: "exact", head: true }).in("status", ["ASSIGNED", "IN_PROGRESS"]),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "PERSONNEL"),
      db.from("companies").select("id", { count: "exact", head: true }),
      db.from("reports").select("report_date").gte("report_date", since).limit(1000),
      db.from("installation_assignments").select("created_at").gte("created_at", `${since}T00:00:00+03:00`).limit(1000),
      db
        .from("reports")
        .select("id, report_number, report_date, company_name_snapshot, created_by_name_snapshot, status, created_at, report_personnel(name_snapshot)")
        .order("created_at", { ascending: false })
        .limit(50)
    ]);
  const results = [totalReports, monthlyReports, drafts, activeAssignments, personnel, companies, activityReports, activityAssignments, recent];
  if (results.some((result) => result.error)) throw new Error("Panel bilgileri alınamadı. Bağlantınızı kontrol edin.");
  return {
    totalReports: totalReports.count ?? 0,
    monthlyReports: monthlyReports.count ?? 0,
    drafts: drafts.count ?? 0,
    activeAssignments: activeAssignments.count ?? 0,
    personnel: personnel.count ?? 0,
    companies: companies.count ?? 0,
    activity: buildActivity(
      (activityReports.data ?? []) as Array<{ report_date: string }>,
      (activityAssignments.data ?? []) as Array<{ created_at: string }>,
      now
    ),
    recentReports: (recent.data ?? []) as ReportListItem[]
  };
}

// shadcn dashboard-01 "SectionCards" yapisi.
function SectionCards({ data }: { data: DashboardData }) {
  const cards = [
    { label: "Aktif montajlar", value: data.activeAssignments, footer: "Atanmış veya sahada devam eden", detail: "Montaj atamaları" },
    { label: "Bu ayki raporlar", value: data.monthlyReports, footer: "Ayın başından bugüne", detail: "Rapor tarihine göre" },
    { label: "Bekleyen taslaklar", value: data.drafts, footer: "Tamamlanmayı bekliyor", detail: "Gönderilmemiş raporlar" },
    {
      label: "Toplam rapor",
      value: data.totalReports,
      footer: `${countFormat.format(data.personnel)} personel, ${countFormat.format(data.companies)} firma`,
      detail: "Organizasyondaki tüm raporlar"
    }
  ];
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card className="@container/card" key={card.label}>
          <CardHeader>
            <CardDescription>{card.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{countFormat.format(card.value)}</CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">{card.footer}</div>
            <div className="text-muted-foreground">{card.detail}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

const chartConfig = {
  activity: { label: "Hareket" },
  reports: { label: "Rapor", color: "var(--primary)" },
  assignments: { label: "Montaj ataması", color: "var(--primary)" }
} satisfies ChartConfig;
const rangeLabels: Record<string, string> = { "90d": "Son 3 ay", "30d": "Son 30 gün", "7d": "Son 7 gün" };
const rangeDays: Record<string, number> = { "90d": 90, "30d": 30, "7d": 7 };

// shadcn dashboard-01 "ChartAreaInteractive" yapisi.
function ActivityChart({ activity }: { activity: DashboardData["activity"] }) {
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
        <CardTitle>Rapor ve montaj hareketi</CardTitle>
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
              <SelectItem className="rounded-lg" value="90d">Son 3 ay</SelectItem>
              <SelectItem className="rounded-lg" value="30d">Son 30 gün</SelectItem>
              <SelectItem className="rounded-lg" value="7d">Son 7 gün</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer className="aspect-auto h-[250px] w-full" config={chartConfig}>
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillReports" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-reports)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-reports)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillAssignments" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="var(--color-assignments)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-assignments)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="date" minTickGap={32} tickFormatter={formatDay} tickLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" labelFormatter={formatDay} />} />
            <Area dataKey="assignments" fill="url(#fillAssignments)" stackId="a" stroke="var(--color-assignments)" type="natural" />
            <Area dataKey="reports" fill="url(#fillReports)" stackId="a" stroke="var(--color-reports)" type="natural" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 10;
const tabs = [
  { id: "all", label: "Son raporlar" },
  { id: "draft", label: "Taslaklar" },
  { id: "submitted", label: "Gönderilenler" }
] as const;
type TabId = (typeof tabs)[number]["id"];

function personnelNames(report: ReportListItem) {
  const names = report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean) ?? [];
  return names.length ? names.join(", ") : report.created_by_name_snapshot ?? "—";
}

// shadcn dashboard-01 "DataTable" yapisi: sekmeler, kenarlikli tablo, sayfalama.
function RecentReportsTable({ reports }: { reports: ReportListItem[] }) {
  const [tab, setTab] = React.useState<TabId>("all");
  const [page, setPage] = React.useState(0);
  const counts = {
    all: reports.length,
    draft: reports.filter((report) => report.status === "DRAFT").length,
    submitted: reports.filter((report) => report.status === "SUBMITTED").length
  };
  const rows = reports.filter((report) => tab === "all" || (tab === "draft" ? report.status === "DRAFT" : report.status === "SUBMITTED"));
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function changeTab(value: string) {
    const next = tabs.find((item) => item.id === value);
    if (!next) return;
    setTab(next.id);
    setPage(0);
  }

  return (
    <Tabs className="w-full flex-col justify-start gap-6" onValueChange={changeTab} value={tab}>
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Select onValueChange={changeTab} value={tab}>
          <SelectTrigger aria-label="Görünüm" className="flex w-fit @4xl/main:hidden" size="sm">
            <SelectValue placeholder="Görünüm seçin" />
          </SelectTrigger>
          <SelectContent>
            {tabs.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          {tabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label} {item.id !== "all" && counts[item.id] > 0 ? <Badge variant="secondary">{counts[item.id]}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <Button asChild size="sm" variant="outline">
          <Link href="/reports">
            <IconListDetails />
            <span className="hidden lg:inline">Tüm raporlar</span>
          </Link>
        </Button>
      </div>
      <TabsContent className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6" value={tab}>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead>Rapor no</TableHead>
                <TableHead>Firma</TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length ? (
                visible.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Button asChild className="w-fit px-0 text-left text-foreground" variant="link">
                        <Link href={`/reports/${report.id}`}>{report.report_number ?? "Numarasız taslak"}</Link>
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-56 truncate">{report.company_name_snapshot ?? "—"}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">{personnelNames(report)}</TableCell>
                    <TableCell>
                      <Badge className="px-1.5 text-muted-foreground" variant="outline">
                        {report.status === "SUBMITTED" ? (
                          <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
                        ) : (
                          <IconLoader />
                        )}
                        {report.status === "SUBMITTED" ? "Gönderildi" : "Taslak"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dateFormat.format(new Date(`${report.report_date.slice(0, 10)}T00:00:00Z`))}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center" colSpan={5}>
                    {reports.length === 0 ? "Henüz rapor yok." : "Sonuç yok."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">Son {countFormat.format(reports.length)} rapor gösteriliyor.</div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Sayfa {page + 1} / {pageCount}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button className="size-8" disabled={page === 0} onClick={() => setPage((current) => current - 1)} size="icon" variant="outline">
                <span className="sr-only">Önceki sayfa</span>
                <IconChevronLeft />
              </Button>
              <Button
                className="size-8"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((current) => current + 1)}
                size="icon"
                variant="outline"
              >
                <span className="sr-only">Sonraki sayfa</span>
                <IconChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// shadcn dashboard-01 "page.tsx" birebir: kartlar, grafik, tablo.
export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let active = true;
    loadDashboard()
      .then((next) => {
        if (active) setData(next);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Panel bilgileri alınamadı.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {error ? (
          <div className="px-4 lg:px-6">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        {data ? (
          <>
            <SectionCards data={data} />
            <div className="px-4 lg:px-6">
              <ActivityChart activity={data.activity} />
            </div>
            <RecentReportsTable reports={data.recentReports} />
          </>
        ) : error ? null : (
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
        )}
      </div>
    </div>
  );
}
