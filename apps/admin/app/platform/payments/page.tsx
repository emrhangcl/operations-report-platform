"use client";

import { AlertTriangle, CheckCircle2, CircleDollarSign, CreditCard, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { platformRequest, usePlatformDashboard } from "../_components/platform-client";
import type { PaymentEvent } from "../_components/platform-types";
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
  OwnerMetric,
  OwnerPageHeader,
  OwnerPanel,
  StatusBadge
} from "../_components/platform-ui";

interface PaymentRow {
  id: string;
  organization_id: string;
  organization_name: string;
  provider: string;
  status: string;
  amount_minor: number;
  refunded_amount_minor: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}

type EventRow = PaymentEvent & { organizationName: string };

export default function PlatformPaymentsPage() {
  const dashboard = usePlatformDashboard();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await platformRequest<{ payments: PaymentRow[]; events: EventRow[] }>("/api/platform/payments");
      setPayments(result.payments);
      setEvents(result.events);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ödemeler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => status === "all" ? payments : payments.filter((payment) => payment.status === status), [payments, status]);
  const metrics = dashboard.data.metrics;

  return (
    <div className="owner-page">
      <OwnerPageHeader
        actions={<button className="owner-button owner-button-secondary" onClick={() => void Promise.all([load(), dashboard.reload()])} type="button"><RefreshCw aria-hidden size={17} /> Yenile</button>}
        description="Tahsilatları, iadeleri ve ödeme sağlayıcısından gelen teknik olayları birbirinden ayrılmış görünümde takip edin."
        eyebrow="Finans"
        title="Ödemeler"
      />
      {error || dashboard.error ? <div className="owner-message error" role="alert">{error || dashboard.error}</div> : null}
      {loading || dashboard.loading ? <OwnerLoading /> : (
        <>
          <section aria-label="Ödeme metrikleri" className="owner-metric-grid owner-metric-grid-three">
            <OwnerMetric detail={`${metrics.active_subscriptions} aktif abonelik`} icon={<CircleDollarSign aria-hidden size={18} />} label="Toplam tahsilat" tone="green" value={formatMoney(metrics.successful_collected_minor)} />
            <OwnerMetric detail={`${metrics.pending_payments} bekleyen ödeme`} icon={<CreditCard aria-hidden size={18} />} label="Aylık düzenli gelir" tone="blue" value={formatMoney(metrics.mrr_minor)} />
            <OwnerMetric detail={`${metrics.failed_renewals} başarısız yenileme`} icon={<RotateCcw aria-hidden size={18} />} label="Toplam iade" tone="orange" value={formatMoney(metrics.refunded_total_minor)} />
          </section>
          <OwnerPanel
            action={<label className="owner-select-wrap"><span className="sr-only">Ödeme durumuna göre filtrele</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option value="all">Tüm ödemeler</option><option value="succeeded">Başarılı</option><option value="pending">Bekliyor</option><option value="failed">Başarısız</option><option value="refunded">İade</option></select></label>}
            description={`${filtered.length} kayıt gösteriliyor`}
            title="Tahsilat geçmişi"
          >
            {filtered.length === 0 ? <OwnerEmpty text="Bu filtrede ödeme kaydı bulunmuyor." /> : (
              <DataTablePanel className="owner-compact-table-wrap">
                <DataTable className="owner-table owner-table-spacious">
                  <DataTableHeader><DataTableRow><DataTableHead>Firma</DataTableHead><DataTableHead>Tutar</DataTableHead><DataTableHead>Sağlayıcı</DataTableHead><DataTableHead>Durum</DataTableHead><DataTableHead>Tarih</DataTableHead></DataTableRow></DataTableHeader>
                  <DataTableBody>
                    {filtered.map((payment) => (
                      <DataTableRow key={payment.id}>
                        <DataTableCell><strong>{payment.organization_name}</strong></DataTableCell>
                        <DataTableCell><strong>{formatMoney(payment.amount_minor, payment.currency)}</strong>{payment.refunded_amount_minor > 0 ? <small className="owner-cell-note">{formatMoney(payment.refunded_amount_minor, payment.currency)} iade</small> : null}</DataTableCell>
                        <DataTableCell>{payment.provider}</DataTableCell>
                        <DataTableCell><StatusBadge status={payment.status} /></DataTableCell>
                        <DataTableCell>{formatDate(payment.paid_at ?? payment.created_at)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </OwnerPanel>
          <OwnerPanel description="Ödeme sağlayıcısından alınan son 50 teknik bildirim" title="Webhook olayları">
            {events.length === 0 ? <OwnerEmpty text="Webhook olayı bulunmuyor." /> : <div className="owner-event-grid">{events.slice(0, 12).map((event) => <article className={event.hasError ? "danger" : ""} key={event.id}>{event.hasError ? <AlertTriangle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}<div><strong>{event.eventType}</strong><span>{event.organizationName} · {event.provider}</span></div><small>{formatDate(event.receivedAt)}</small></article>)}</div>}
          </OwnerPanel>
        </>
      )}
    </div>
  );
}
