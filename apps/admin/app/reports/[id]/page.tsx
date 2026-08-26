"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import type { ReportWorkItem } from "@tunca/types";
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
    id?: string;
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
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = getBrowserSupabase();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("reports")
        .select("*, report_personnel(name_snapshot), report_photos(id,category,caption,storage_path,created_at)")
        .eq("id", params.id)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setMessage("Rapor detayı alınamadı.");
        return;
      }

      const nextReport = data as ReportDetail;
      setReport(nextReport);

      const signedEntries = await Promise.all(
        (nextReport.report_photos ?? [])
          .filter((photo) => photo.storage_path)
          .map(async (photo) => {
            const path = String(photo.storage_path);
            const signed = await supabase.storage.from("report-photos").createSignedUrl(path, 60 * 30);
            return [path, signed.data?.signedUrl ?? ""] as const;
          })
      );

      if (!cancelled) {
        setPhotoUrls(Object.fromEntries(signedEntries.filter((entry) => entry[1])));
      }
    }

    load().catch(() => {
      if (!cancelled) setMessage("Rapor detayı alınamadı.");
    });

    return () => {
      cancelled = true;
    };
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
              ["Bant Kodu", reportBeltCodesText(report)],
              ["İş Kalemleri", reportWorkItemsText(report)],
              ["Makina Marka Model", text(report.machine_brand_model)],
              ["Araç Plakası", text(report.vehicle_plate)],
              ["Araç Alış KM", text(report.vehicle_start_km)],
              ["Araç Teslim KM", text(report.vehicle_end_km)],
              ["Kullanılan Makine ve Ekipman", text(report.used_equipment)],
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
              ["Ürün Kodları", reportProductCodesText(report)],
              ["Ürün Ölçüleri", reportProductMeasurementsText(report)],
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
          <PhotoSection photos={report.report_photos ?? []} photoUrls={photoUrls} />
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

function PhotoSection({
  photos,
  photoUrls
}: {
  photos: NonNullable<ReportDetail["report_photos"]>;
  photoUrls: Record<string, string>;
}) {
  return (
    <section className="card detail-section detail-section-wide">
      <h2>Fotoğraflar</h2>
      {photos.length === 0 ? (
        <div className="empty compact">Fotoğraf eklenmemiş.</div>
      ) : (
        <div className="report-photo-grid">
          {photos.map((photo) => {
            const path = photo.storage_path ?? "";
            const signedUrl = photoUrls[path];

            return (
              <div className="report-photo-card" key={photo.id ?? path}>
                {signedUrl ? (
                  <Image
                    alt={photo.caption || "Rapor fotoğrafı"}
                    height={220}
                    src={signedUrl}
                    unoptimized
                    width={320}
                  />
                ) : (
                  <div className="report-photo-placeholder">
                    <ImageIcon aria-hidden size={26} />
                  </div>
                )}
                <div>
                  <strong>{photo.caption || "Açıklama yok"}</strong>
                  <span>{photo.category || "Genel"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function compactWorkItems(items: ReportWorkItem[]) {
  return items
    .map((item) => ({
      line_name: item.line_name.trim(),
      belt_id: item.belt_id.trim(),
      belt_code: item.belt_code.trim(),
      belt_name: item.belt_name.trim(),
      product_width: item.product_width.trim(),
      product_length: item.product_length.trim(),
      product_quantity: item.product_quantity.trim()
    }))
    .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.product_width || item.product_length || item.product_quantity);
}

function workItemsFromValue(
  value: unknown,
  fallbackLineName: string,
  fallbackBeltId: string,
  fallbackBeltCode = "",
  fallbackBeltName = "",
  fallbackProductWidth = "",
  fallbackProductLength = "",
  fallbackProductQuantity = ""
): ReportWorkItem[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => toRecord(item))
      .map((item) => ({
        line_name: textValue(item.line_name),
        belt_id: textValue(item.belt_id),
        belt_code: textValue(item.belt_code),
        belt_name: textValue(item.belt_name),
        product_width: textValue(item.product_width),
        product_length: textValue(item.product_length),
        product_quantity: textValue(item.product_quantity)
      }))
      .filter((item) => item.line_name || item.belt_id || item.belt_code || item.belt_name || item.product_width || item.product_length || item.product_quantity);

    if (items.length > 0) return items;
  }

  return [{
    line_name: fallbackLineName,
    belt_id: fallbackBeltId,
    belt_code: fallbackBeltCode,
    belt_name: fallbackBeltName,
    product_width: fallbackProductWidth,
    product_length: fallbackProductLength,
    product_quantity: fallbackProductQuantity
  }];
}

function reportWorkItemsText(report: Record<string, unknown>) {
  const items = compactWorkItems(
    workItemsFromValue(
      report.work_items,
      textValue(report.line_name),
      textValue(report.belt_id),
      textValue(report.belt_code_snapshot),
      textValue(report.belt_name_snapshot),
      textValue(report.product_width),
      textValue(report.product_length),
      textValue(report.product_quantity)
    )
  );

  return items
    .map((item) => {
      const beltLabel = item.belt_code ? (item.belt_name ? `${item.belt_code} - ${item.belt_name}` : item.belt_code) : "";
      return [item.line_name, beltLabel].filter(Boolean).join(" / ");
    })
    .filter(Boolean)
    .join(" • ") || "-";
}

function reportBeltCodesText(report: Record<string, unknown>) {
  const items = compactWorkItems(
    workItemsFromValue(
      report.work_items,
      textValue(report.line_name),
      textValue(report.belt_id),
      textValue(report.belt_code_snapshot),
      textValue(report.belt_name_snapshot),
      textValue(report.product_width),
      textValue(report.product_length),
      textValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return Array.from(new Set(codes)).join(", ");
  }

  return text(report.belt_code_snapshot);
}

function reportProductCodesText(report: Record<string, unknown>) {
  const items = compactWorkItems(
    workItemsFromValue(
      report.work_items,
      textValue(report.line_name),
      textValue(report.belt_id),
      textValue(report.belt_code_snapshot),
      textValue(report.belt_name_snapshot),
      textValue(report.product_width),
      textValue(report.product_length),
      textValue(report.product_quantity)
    )
  );
  const codes = items.map((item) => item.belt_code).filter(Boolean);

  if (codes.length > 0) {
    return codes.join(" • ");
  }

  return text(report.product_code || report.belt_code_snapshot);
}

function reportProductMeasurementsText(report: Record<string, unknown>) {
  const items = compactWorkItems(
    workItemsFromValue(
      report.work_items,
      textValue(report.line_name),
      textValue(report.belt_id),
      textValue(report.belt_code_snapshot),
      textValue(report.belt_name_snapshot),
      textValue(report.product_width),
      textValue(report.product_length),
      textValue(report.product_quantity)
    )
  );
  const rows = items
    .map((item) => {
      const code = item.belt_code || "Ürün";
      const size = [item.product_width, item.product_length].filter(Boolean).join(" x ");
      const quantity = item.product_quantity ? `${item.product_quantity} adet` : "";
      const detail = [size, quantity].filter(Boolean).join(" / ");
      return detail ? `${code}: ${detail}` : "";
    })
    .filter(Boolean);

  return rows.join(" • ") || "-";
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
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
