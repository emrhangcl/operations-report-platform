import type { ReactNode } from "react";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  EmptyState,
  LoadingState,
  StatusBadge as BaseStatusBadge
} from "../../../components/ui";

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

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <BaseStatusBadge
      className={`owner-status owner-status-${status ?? "unknown"}`}
      label={statusLabel(status)}
      tone={statusTone(status)}
    />
  );
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
  return (
    <header className="owner-page-header owner-enter">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="owner-page-actions">{actions}</div> : null}
    </header>
  );
}

export function OwnerMetric({
  icon,
  label,
  value,
  detail,
  tone = "blue"
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail: string;
  tone?: "blue" | "green" | "orange" | "violet";
}) {
  return (
    <article className={`owner-metric owner-enter owner-tone-${tone}`}>
      <div className="owner-metric-top"><span>{icon}</span><small>{label}</small></div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function OwnerPanel({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`owner-panel owner-enter ${className}`}>
      <div className="owner-panel-heading">
        <div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OwnerEmpty({ text }: { text: string }) {
  return <EmptyState className="owner-empty">{text}</EmptyState>;
}

export function OwnerLoading() {
  return <LoadingState className="owner-loading" label="Veriler hazırlanıyor..." />;
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
