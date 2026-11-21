"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StatusBadge as BaseStatusBadge } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
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
  OwnerPage,
  OwnerPageHeader,
  OwnerPanel,
  OwnerStatCard,
  OwnerStatGrid,
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
    <OwnerPage>
      <OwnerPageHeader
        actions={<Button onClick={() => void Promise.all([load(), dashboard.reload()])} size="sm" type="button" variant="outline"><IconRefresh /> Yenile</Button>}
        description="Tahsilatları, iadeleri ve ödeme sağlayıcısından gelen teknik olayları birbirinden ayrılmış görünümde takip edin."
        eyebrow="Finans"
        title="Ödemeler"
      />
      {error || dashboard.error ? <Alert tone="error">{error || dashboard.error}</Alert> : null}
      {loading || dashboard.loading ? <OwnerLoading /> : (
        <>
          <OwnerStatGrid label="Ödeme metrikleri">
            <OwnerStatCard detail={`${metrics.active_subscriptions} aktif abonelik`} label="Toplam tahsilat" value={formatMoney(metrics.successful_collected_minor)} />
            <OwnerStatCard detail={`${metrics.pending_payments} bekleyen ödeme`} label="Aylık düzenli gelir" value={formatMoney(metrics.mrr_minor)} />
            <OwnerStatCard detail={`${metrics.failed_renewals} başarısız yenileme`} label="Toplam iade" value={formatMoney(metrics.refunded_total_minor)} />
          </OwnerStatGrid>
          <OwnerPanel
            action={
              <>
                <Label className="sr-only" htmlFor="payment-status">Ödeme durumuna göre filtrele</Label>
                <Select onValueChange={setStatus} value={status}>
                  <SelectTrigger className="w-40" id="payment-status" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">Tüm ödemeler</SelectItem>
                    <SelectItem value="succeeded">Başarılı</SelectItem>
                    <SelectItem value="pending">Bekliyor</SelectItem>
                    <SelectItem value="failed">Başarısız</SelectItem>
                    <SelectItem value="refunded">İade</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
            description={`${filtered.length} kayıt gösteriliyor`}
            title="Tahsilat geçmişi"
          >
            {filtered.length === 0 ? <OwnerEmpty text="Bu filtrede ödeme kaydı bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Firma</DataTableHead>
                      <DataTableHead>Tutar</DataTableHead>
                      <DataTableHead>Sağlayıcı</DataTableHead>
                      <DataTableHead>Durum</DataTableHead>
                      <DataTableHead>Tarih</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {filtered.map((payment) => (
                      <DataTableRow key={payment.id}>
                        <DataTableCell className="font-medium">{payment.organization_name}</DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-col">
                            <span className="font-medium tabular-nums">{formatMoney(payment.amount_minor, payment.currency)}</span>
                            {payment.refunded_amount_minor > 0 ? (
                              <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(payment.refunded_amount_minor, payment.currency)} iade</span>
                            ) : null}
                          </div>
                        </DataTableCell>
                        <DataTableCell>{payment.provider}</DataTableCell>
                        <DataTableCell><StatusBadge status={payment.status} /></DataTableCell>
                        <DataTableCell className="tabular-nums">{formatDate(payment.paid_at ?? payment.created_at)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </OwnerPanel>
          <OwnerPanel description="Ödeme sağlayıcısından alınan son 50 teknik bildirim" title="Webhook olayları">
            {events.length === 0 ? <OwnerEmpty text="Webhook olayı bulunmuyor." /> : (
              <DataTablePanel>
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow>
                      <DataTableHead>Olay</DataTableHead>
                      <DataTableHead>Firma</DataTableHead>
                      <DataTableHead>Sağlayıcı</DataTableHead>
                      <DataTableHead>Durum</DataTableHead>
                      <DataTableHead>Tarih</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {events.slice(0, 12).map((event) => (
                      <DataTableRow key={event.id}>
                        <DataTableCell className="font-medium">{event.eventType}</DataTableCell>
                        <DataTableCell>{event.organizationName}</DataTableCell>
                        <DataTableCell>{event.provider}</DataTableCell>
                        <DataTableCell>
                          <BaseStatusBadge label={event.hasError ? "Hata" : "Başarılı"} tone={event.hasError ? "danger" : "success"} />
                        </DataTableCell>
                        <DataTableCell className="tabular-nums">{formatDate(event.receivedAt)}</DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </DataTablePanel>
            )}
          </OwnerPanel>
        </>
      )}
    </OwnerPage>
  );
}
