"use client";

import type { ReactNode } from "react";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle, CardContent } from "@/components/shadcn/card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  EmptyState,
  FirmPage,
  LoadingState,
  PageHeaderShell,
  StatusBadge as BaseStatusBadge
} from "@/components/firm-ui";

const statusLabels: Record<string, string> = {
  active: "Aktif",
  suspended: "Askıda",
  closed: "Kapatıldı",
  pending: "Ödeme bekliyor",
  past_due: "Vadesi geçti",
  grace_period: "Ek süre",
  read_only: "Salt okunur",
  canceled: "İptal edildi",
  lifetime: "Ömür boyu",
  succeeded: "Başarılı",
  failed: "Başarısız",
  refunded: "İade edildi"
};

export function formatDate(value: string | null | undefined, includeTime = true) {
  if (!value) return "Kayıt yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Kayıt yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Europe/Istanbul"
  }).format(date);
}

export function formatMoney(minor: number | null | undefined, currency = "TRY") {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "Tanımlanmadı";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function statusLabel(status: string | null | undefined) {
  return status ? statusLabels[status] ?? status : "Bilinmiyor";
}

function statusTone(status: string | null | undefined) {
  if (status === "active" || status === "succeeded" || status === "lifetime") return "success";
  if (status === "pending" || status === "grace_period" || status === "read_only") return "warning";
  if (status === "suspended" || status === "past_due" || status === "failed") return "danger";
  if (status === "closed" || status === "canceled") return "pending";
  return "neutral";
}

// dashboard-01 tablosundaki outline durum rozeti.
export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <BaseStatusBadge label={statusLabel(status)} tone={statusTone(status)} />;
}

// Owner sayfa govdesi: firma paneliyle ayni "@container/main" sarmalayici.
export function OwnerPage({ children }: { children: ReactNode }) {
  return <FirmPage>{children}</FirmPage>;
}

export function OwnerPageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return <PageHeaderShell action={actions} description={description} eyebrow={eyebrow} title={title} />;
}

// dashboard-01 "SectionCards" karti: aciklama, tabular buyuk deger ve alt bilgi.
export function OwnerStatCard({
  label,
  value,
  detail,
  action,
  textValue = false
}: {
  label: string;
  value: ReactNode;
  detail: string;
  action?: ReactNode;
  // Metin degerler (orn. "Baglanti calisiyor") buyuk boyda satir kirdigi icin text-2xl'de kalir.
  textValue?: boolean;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={textValue ? "text-2xl font-semibold tabular-nums" : "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"}>{value}</CardTitle>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardFooter className="text-sm text-muted-foreground">{detail}</CardFooter>
    </Card>
  );
}

// SectionCards izgarasi (uc kart icin; tek kart kalan satir olusmaz).
export function OwnerStatGrid({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @3xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card"
    >
      {children}
    </section>
  );
}

export function OwnerPanel({
  title,
  description,
  action,
  children,
  className
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

export function OwnerEmpty({ text }: { text: string }) {
  return <EmptyState>{text}</EmptyState>;
}

export function OwnerLoading() {
  return <LoadingState label="Veriler hazırlanıyor..." />;
}

export {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow
};
