"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "../lib/supabase-browser";

type PaymentRow = { id: string; status: string; amount_minor: number; currency: string; paid_at: string | null; created_at: string };
type InvoiceRow = { id: string; invoice_number: string | null; status: string; total_minor: number; currency: string; issued_at: string | null; created_at: string };

function money(value: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(value / 100);
}

export function BillingOverview() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = getBrowserSupabase();
      if (!supabase) {
        setMessage("Faturalandırma hizmeti yapılandırılmamış.");
        setLoading(false);
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();
      if (!profile?.organization_id) {
        setMessage("Organizasyon üyeliği bulunamadı.");
        setLoading(false);
        return;
      }
      const [paymentResult, invoiceResult] = await Promise.all([
        supabase.from("payments").select("id,status,amount_minor,currency,paid_at,created_at").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100),
        supabase.from("invoices").select("id,invoice_number,status,total_minor,currency,issued_at,created_at").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }).limit(100)
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

  if (loading) return <div className="public-empty">Faturalandırma kayıtları yükleniyor...</div>;
  if (message) return <div className="message error">{message}</div>;

  return (
    <div className="billing-sections">
      <section>
        <h2>Ödemeler</h2>
        {payments.length === 0 ? <div className="public-empty">Henüz ödeme kaydı bulunmuyor.</div> : (
          <div className="table-panel"><table><thead><tr><th>Durum</th><th>Tutar</th><th>Tarih</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.status}</td><td>{money(payment.amount_minor, payment.currency)}</td><td>{new Date(payment.paid_at ?? payment.created_at).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section>
        <h2>Faturalar</h2>
        {invoices.length === 0 ? <div className="public-empty">Henüz fatura kaydı bulunmuyor.</div> : (
          <div className="table-panel"><table><thead><tr><th>Fatura</th><th>Durum</th><th>Toplam</th><th>Tarih</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td>{invoice.invoice_number ?? "-"}</td><td>{invoice.status}</td><td>{money(invoice.total_minor, invoice.currency)}</td><td>{new Date(invoice.issued_at ?? invoice.created_at).toLocaleDateString("tr-TR")}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
