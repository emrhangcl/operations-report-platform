"use client";

import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminShell } from "../../../components/admin-shell";
import { PageHeader } from "../../../components/page-header";
import { getBrowserSupabase } from "../../../lib/supabase-browser";

type ReportDetail = Record<string, unknown> & {
  report_number: string | null;
  report_date: string;
  company_name_snapshot: string | null;
  created_by_name_snapshot: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  report_personnel?: Array<{ name_snapshot: string | null }>;
  report_photos?: Array<{
    category: string | null;
    caption: string | null;
    storage_path: string | null;
    created_at: string;
  }>;
};

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("reports")
      .select("*, report_personnel(name_snapshot), report_photos(category,caption,storage_path,created_at)")
      .eq("id", params.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setMessage("Rapor detayı alınamadı.");
          return;
        }
        setReport(data as ReportDetail);
      });
  }, [params.id]);

  async function authHeaders() {
    const supabase = getBrowserSupabase();
    const { data } = await supabase?.auth.getSession() ?? { data: { session: null } };
    return data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : undefined;
  }

  async function deleteReport() {
    if (!confirm("Bu rapor kalıcı olarak silinsin mi?")) return;

    const headers = await authHeaders();
    if (!headers?.Authorization) {
      setMessage("Silme işlemi için oturum doğrulanamadı.");
      return;
    }

    const response = await fetch(`/api/admin/reports/${params.id}`, {
      method: "DELETE",
      headers
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { message?: string } | null;
      setMessage(body?.message ?? "Rapor silinemedi.");
      return;
    }

    router.replace("/reports");
  }

  return (
    <AdminShell>
      <PageHeader
        title={report?.report_number ?? "Rapor Detayı"}
        description="Rapor bilgileri bölüm bölüm gösterilir."
        action={report ? (
          <button className="button danger" onClick={deleteReport} type="button">
            <Trash2 aria-hidden size={18} />
            Raporu Sil
          </button>
        ) : null}
      />
      {message ? <div className="message error">{message}</div> : null}
      {!report ? (
        <div className="empty">Rapor yükleniyor.</div>
      ) : (
        <div className="detail-sections">
          <Section
            title="Genel Bilgiler"
            rows={[
              ["Rapor No", report.report_number ?? "Taslak"],
              ["Tarih", dateOnly(report.report_date)],
              ["Firma", text(report.company_name_snapshot)],
              ["Yetkili Kişi", text(report.company_contact_name)],
              ["Yetkili Telefon", text(report.company_contact_phone)],
              ["Hat Adı", text(report.line_name)],
              ["Makina Marka Model", text(report.machine_brand_model)],
              ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"]
            ]}
          />
          <Section
            title="Zaman Bilgileri"
            rows={[
              ["Atölyeden Çıkış", dateTime(report.workshop_departure_at)],
              ["Müşteriye Varış", dateTime(report.customer_arrival_at)],
              ["Müşteriden Çıkış", dateTime(report.customer_departure_at)],
              ["Fabrikaya Dönüş", dateTime(report.factory_return_at)]
            ]}
          />
          <Section
            title="Ürün Bilgileri"
            rows={[
              ["Ürün Kodu", text(report.product_code)],
              ["Ölçü", text(report.product_measure)],
              ["En", text(report.product_width)],
              ["Boy", text(report.product_length)],
              ["Miktar", text(report.product_quantity)],
              ["Ürün Item / Coil Kodu", text(report.product_item_coil_code)],
              ["Ürün Türü", arrayText(report.product_types)]
            ]}
          />
          <Section
            title="Yapılan İşlemler"
            rows={[
              ["İşlemler", arrayText(report.process_actions)],
              ["Kenar Kesim", text(report.edge_cut_method)],
              ["Açıklama", text(report.process_description)],
              ["Mekanik Bağlantı", text(report.mechanical_connection)],
              ["Profil", text(report.profile_material)],
              ["Değiştirme Sebebi", arrayText(report.replacement_reasons)]
            ]}
          />
          <Section
            title="Pres ve Test"
            rows={[
              ["Test Parçası", text(report.has_test_piece)],
              ["Test Durumu", text(report.test_status)],
              ["Gözlemci", text(report.observer_name_snapshot) || text(report.observer_external_name)],
              ["Pres Başlama", text(report.press_start_time)],
              ["Pres Bitiş", text(report.press_end_time)],
              ["Enerji Kesintisi", text(report.power_outage)],
              ["Basınç Düşmesi", text(report.pressure_drop)],
              ["Isı Dengesi", text(report.heat_balance_ok)]
            ]}
          />
          <Section
            title="Teknik Detaylar"
            rows={[
              ["Faturalandırma", text(report.billing_status)],
              ["Teknik Detaylar", text(report.technical_details)]
            ]}
          />
          <Section
            title="Gerdirme"
            rows={[
              ["Gerdirme Yapıldı mı?", text(report.tensioning_done)],
              ["Müşteri Sonra Yapacak", boolText(report.customer_will_tension)],
              ["Müşteri Otomatik Sistemde Yaptı", boolText(report.customer_tensioned_auto)],
              ["Uygulanan Basınç", [text(report.pressure_value), text(report.pressure_unit)].filter((value) => value !== "-").join(" ") || "-"],
              ["Ön Gerdirme %", text(report.pre_tension_percent)],
              ["Hat Çalışır Teslim Edildi", boolText(report.line_delivered_running)]
            ]}
          />
          <Section
            title="Fotoğraflar"
            rows={(report.report_photos ?? []).length === 0
              ? [["Fotoğraf", "Fotoğraf eklenmemiş."]]
              : (report.report_photos ?? []).map((photo) => [
                  photo.category ?? "-",
                  [photo.caption, photo.storage_path].filter(Boolean).join(" - ")
                ])}
          />
          <Section
            title="Sistem Bilgileri"
            rows={[
              ["Raporu oluşturan", text(report.created_by_name_snapshot)],
              ["Oluşturulma zamanı", dateTime(report.created_at)],
              ["Gönderilme zamanı", dateTime(report.submitted_at)],
              ["Son düzenleme zamanı", dateTime(report.updated_at)],
              ["Durum", report.status === "SUBMITTED" ? "Gönderildi" : "Taslak"]
            ]}
          />
        </div>
      )}
    </AdminShell>
  );
}

function Section({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="card detail-section">
      <h2>{title}</h2>
      <dl className="kv">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  return "-";
}

function arrayText(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") || "-" : "-";
}

function boolText(value: unknown) {
  if (typeof value !== "boolean") return "-";
  return value ? "Evet" : "Hayır";
}

function dateOnly(value: unknown) {
  return typeof value === "string" ? new Date(value).toLocaleDateString("tr-TR") : "-";
}

function dateTime(value: unknown) {
  return typeof value === "string" && value
    ? new Date(value).toLocaleString("tr-TR")
    : "-";
}
