"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/browser-client";
import {
  Alert,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  EmptyState,
  LoadingState,
  StatusBadge
} from "./ui";

type PaymentRow = { id: string; status: string; amount_minor: number; currency: string; paid_at: string | null; created_at: string };
type InvoiceRow = { id: string; invoice_number: string | null; status: string; total_minor: number; currency: string; issued_at: string | null; created_at: string };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value / 100);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (["paid", "succeeded", "success", "active"].includes(normalized)) return "success";
  if (["pending", "processing", "draft"].includes(normalized)) return "pending";
  if (["failed", "cancelled", "canceled", "void", "refunded"].includes(normalized)) return "danger";
  return "neutral";
}

export function BillingOverview() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const db = getBrowserClient();
      if (!db) {
        setMessage("Faturalandırma hizmeti yapılandırılmamış.");
        setLoading(false);
        return;
      }
      const { data: userData } = await db.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await db.from("profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();
      if (!profile?.organization_id) {
        setMessage("Organizasyon üyeliği bulunamadı.");
        setLoading(false);
        return;
      }
      const [paymentResult, invoiceResult] = await Promise.all([
        db.from("payments").select("id,status,amount_minor,currency,paid_at,created_at").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100),
        db.from("invoices").select("id,invoice_number,status,total_minor,currency,issued_at,created_at").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100)
      ]);
      if (paymentResult.error || invoiceResult.error) setMessage("Faturalandırma kayıtları alınamadı.");
      else {
        setPayments((paymentResult.data ?? []) as PaymentRow[]);
        setInvoices((invoiceResult.data ?? []) as InvoiceRow[]);
      }
      setLoading(false);
    }
    load().catch(() => {
      setMessage("Faturalandırma kayıtları alınamadı.");
      setLoading(false);
    });
  }, [router]);

  if (loading) return <LoadingState label="Faturalandırma kayıtları yükleniyor..." />;
  if (message) return <Alert tone="error">{message}</Alert>;

  return (
    <div className="billing-sections">
      <section>
        <h2>Ödemeler</h2>
        {payments.length === 0 ? <EmptyState>Henüz ödeme kaydı bulunmuyor.</EmptyState> : (
          <DataTablePanel>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Durum</DataTableHead>
                  <DataTableHead>Tutar</DataTableHead>
                  <DataTableHead>Tarih</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {payments.map((payment) => (
                  <DataTableRow key={payment.id}>
                    <DataTableCell>
                      <StatusBadge label={payment.status} tone={statusTone(payment.status)} />
                    </DataTableCell>
                    <DataTableCell>{money(payment.amount_minor, payment.currency)}</DataTableCell>
                    <DataTableCell>{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTablePanel>
        )}
      </section>
      <section>
        <h2>Faturalar</h2>
        {invoices.length === 0 ? <EmptyState>Henüz fatura kaydı bulunmuyor.</EmptyState> : (
          <DataTablePanel>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Fatura</DataTableHead>
                  <DataTableHead>Durum</DataTableHead>
                  <DataTableHead>Toplam</DataTableHead>
                  <DataTableHead>Tarih</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {invoices.map((invoice) => (
                  <DataTableRow key={invoice.id}>
                    <DataTableCell>{invoice.invoice_number ?? "-"}</DataTableCell>
                    <DataTableCell>
                      <StatusBadge label={invoice.status} tone={statusTone(invoice.status)} />
                    </DataTableCell>
                    <DataTableCell>{money(invoice.total_minor, invoice.currency)}</DataTableCell>
                    <DataTableCell>{new Date(invoice.issued_at ?? invoice.created_at).toLocaleDateString("tr-TR")}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTablePanel>
        )}
      </section>
    </div>
  );
}
