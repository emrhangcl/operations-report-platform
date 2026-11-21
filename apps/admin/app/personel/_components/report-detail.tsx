"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { IconChevronLeft, IconDeviceFloppy, IconDownload, IconMaximize, IconPhoto, IconShare, IconX } from "@tabler/icons-react";
import { reportReturnCloseoutSchema } from "@operations/validation";
import { CustomerSignatureCard } from "@/components/customer-signature";
import { Alert, Button, EmptyState, FormActions, FormField, IconButton, LoadingState, PageHeaderShell } from "@/components/firm-ui";
import { Button as ShadcnButton } from "@/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { downloadOrShareReportPdf } from "@/lib/report-pdf-client";
import {
  arrayText,
  boolText,
  fallbackText,
  formatDateDisplay,
  formatDateTimeDisplay,
  fromDatetimeLocal,
  getPersonnelClient,
  reportBeltCodesText,
  reportProductCodesText,
  reportProductMeasurementsText,
  reportWorkItemsText,
  stringValue,
  text,
  toDatetimeLocal,
  type ReportDetail
} from "./report-utils";

type ReportPhoto = NonNullable<ReportDetail["report_photos"]>[number];
type ActivePhoto = ReportPhoto & { signedUrl: string; index: number };

export function ReportDetailView({ reportId, readOnly, onBack }: { reportId: string; readOnly: boolean; onBack: () => void }) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [activePhoto, setActivePhoto] = useState<ActivePhoto | null>(null);
  const [pdfLoading, setPdfLoading] = useState<"download" | "share" | null>(null);
  const [closeoutSaving, setCloseoutSaving] = useState(false);
  const [returnAt, setReturnAt] = useState("");
  const [returnKm, setReturnKm] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("error");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const db = getPersonnelClient();

      const { data, error } = await db
        .from("reports")
        .select("*, report_personnel(name_snapshot), report_photos(id,category,caption,storage_path,created_at)")
        .eq("id", reportId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setMessage("Rapor detayı alınamadı veya rapor silinmiş olabilir.");
        setReport(null);
        return;
      }

      const nextReport = data as ReportDetail;
      setReport(nextReport);
      setReturnAt(stringValue(nextReport.factory_return_at));
      setReturnKm(stringValue(nextReport.vehicle_end_km));

      const signedEntries = await Promise.all(
        (nextReport.report_photos ?? [])
          .filter((photo) => photo.storage_path)
          .map(async (photo) => {
            const path = String(photo.storage_path);
            const signed = await db.storage.from("report-photos").createSignedUrl(path, 60 * 30);
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
  }, [reportId]);

  async function handlePdf(mode: "download" | "share") {
    if (!report) return;

    setMessage("");
    setMessageTone("error");
    setPdfLoading(mode);
    try {
      const result = await downloadOrShareReportPdf({
        mode,
        reportId,
        reportNumber: report.report_number,
        scope: "personnel"
      });

      if (!result.ok) {
        setMessage(result.message);
      }
    } finally {
      setPdfLoading(null);
    }
  }

  async function saveReturnCloseout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!report || closeoutSaving || readOnly) return;

    const parsed = reportReturnCloseoutSchema.safeParse({
      customer_departure_at: stringValue(report.customer_departure_at),
      factory_return_at: returnAt,
      vehicle_plate: stringValue(report.vehicle_plate),
      vehicle_start_km: stringValue(report.vehicle_start_km),
      vehicle_end_km: returnKm
    });
    if (!parsed.success) {
      setMessageTone("error");
      setMessage(parsed.error.issues[0]?.message ?? "Dönüş bilgilerini kontrol edin.");
      return;
    }

    const db = getPersonnelClient();

    setCloseoutSaving(true);
    setMessage("");
    try {
      const result = await db
        .from("reports")
        .update({
          factory_return_at: parsed.data.factory_return_at,
          vehicle_end_km: parsed.data.vehicle_end_km || null
        })
        .eq("id", report.id)
        .eq("status", "SUBMITTED")
        .not("customer_signature", "is", null)
        .select("factory_return_at,vehicle_end_km,updated_at")
        .maybeSingle();

      if (result.error || !result.data) throw new Error(result.error?.message || "Dönüş bilgileri kaydedilemedi.");

      setReport((current) => current ? { ...current, ...result.data } : current);
      setReturnAt(stringValue(result.data.factory_return_at));
      setReturnKm(stringValue(result.data.vehicle_end_km));
      setMessageTone("info");
      setMessage("Dönüş kapanışı kaydedildi. Güncel bilgiler PDF ve rapor dokümanlarında görünecek.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Dönüş bilgileri kaydedilemedi.");
    } finally {
      setCloseoutSaving(false);
    }
  }

  return (
    <>
      <div>
        <Button icon={<IconChevronLeft aria-hidden />} onClick={onBack} variant="secondary">
          Geri
        </Button>
      </div>
      <PageHeaderShell
        action={report ? (
          <FormActions>
            <Button disabled={pdfLoading !== null} icon={<IconDownload aria-hidden />} onClick={() => handlePdf("download")} variant="secondary">
              {pdfLoading === "download" ? "Hazırlanıyor" : "PDF İndir"}
            </Button>
            <Button disabled={pdfLoading !== null} icon={<IconShare aria-hidden />} onClick={() => handlePdf("share")}>
              {pdfLoading === "share" ? "Hazırlanıyor" : "Paylaş"}
            </Button>
          </FormActions>
        ) : null}
        description={report ? `${text(report.company_name_snapshot)} · ${formatDateDisplay(report.report_date) || "-"}` : "Detaylar ve fotoğraf bağlantıları hazırlanıyor."}
        title={report?.report_number ?? "Rapor Detayı"}
      />
      {message ? <Alert tone={messageTone === "error" ? "error" : "success"}>{message}</Alert> : null}
      {!report ? <LoadingState label="Rapor yükleniyor." /> : null}
      {report ? (
        <div className="grid gap-4 @3xl/main:grid-cols-2">
          <div className="@3xl/main:col-span-2">
            <CustomerSignatureCard signature={report.customer_signature} signedAt={typeof report.customer_signed_at === "string" ? report.customer_signed_at : null} />
          </div>
          <Card className="@3xl/main:col-span-2">
            <CardHeader>
              <CardTitle>Dönüş kapanışı</CardTitle>
              <CardDescription>Müşteri imzası iş ve teslim kaydını korur. Eve veya ofise ulaştığınızda aşağıdaki dönüş bilgilerini tamamlayabilirsiniz.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" method="post" onSubmit={saveReturnCloseout}>
                <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2" disabled={closeoutSaving || readOnly}>
                  <FormField label="Eve / Ofise Giriş Tarih Saati">
                    <input onChange={(event) => setReturnAt(fromDatetimeLocal(event.target.value))} type="datetime-local" value={toDatetimeLocal(returnAt)} />
                  </FormField>
                  {stringValue(report.vehicle_plate) || stringValue(report.vehicle_start_km) ? (
                    <FormField label="Dönüş Araç Kilometresi">
                      <input inputMode="numeric" onChange={(event) => setReturnKm(event.target.value)} value={returnKm} />
                    </FormField>
                  ) : (
                    <div className="grid content-start gap-2 text-sm">
                      <span className="font-medium">Araç kilometresi</span>
                      <span className="text-muted-foreground">Bu raporda araç kullanımı kaydedilmemiş.</span>
                    </div>
                  )}
                </fieldset>
                <FormActions>
                  <Button disabled={closeoutSaving || readOnly} icon={<IconDeviceFloppy aria-hidden />} type="submit">
                    {closeoutSaving ? "Kaydediliyor" : "Dönüş bilgilerini kaydet"}
                  </Button>
                </FormActions>
              </form>
            </CardContent>
          </Card>
          <Section
            wide
            title="Genel Bilgiler"
            rows={[
              ["Rapor No", report.report_number ?? "Taslak"],
              ["Tarih", formatDateDisplay(report.report_date)],
              ["Firma", text(report.company_name_snapshot)],
              ["Yetkili Kişi", text(report.company_contact_name)],
              ["Yetkili Telefon", text(report.company_contact_phone)],
              ["Hat Adı", text(report.line_name)],
              ["Bant Kodu", reportBeltCodesText(report)],
              ["İş Kalemleri", reportWorkItemsText(report)],
              ["Giden Personel", report.report_personnel?.map((item) => item.name_snapshot).filter(Boolean).join(", ") || "-"],
              ["Araç Plakası", text(report.vehicle_plate)],
              ["Araç Alış KM", text(report.vehicle_start_km)],
              ["Dönüş Araç KM", text(report.vehicle_end_km)],
              ["Kullanılan Makine ve Ekipman", text(report.used_equipment)]
            ]}
          />
          <Section
            title="Zaman Bilgileri"
            rows={[
              ["Atölyeden Çıkış", formatDateTimeDisplay(report.workshop_departure_at)],
              ["Müşteriye Varış", formatDateTimeDisplay(report.customer_arrival_at)],
              ["Müşteriden Çıkış", formatDateTimeDisplay(report.customer_departure_at)],
              ["Eve / Ofise Giriş", formatDateTimeDisplay(report.factory_return_at)]
            ]}
          />
          <Section
            title="Ürün ve İşlem"
            rows={[
              ["Ürün Kodları", reportProductCodesText(report)],
              ["Ürün Ölçüleri", reportProductMeasurementsText(report)],
              ["Ürün Türü", arrayText(report.product_types)],
              ["Yapılan İşlem", arrayText(report.process_actions)],
              ["Açıklama", text(report.process_description)]
            ]}
          />
          <Section
            title="Pres ve Teknik"
            rows={[
              ["Test Parçası", text(report.has_test_piece)],
              ["Test Durumu", text(report.test_status)],
              ["Gözlemci", fallbackText(text(report.observer_name_snapshot), text(report.observer_external_name))],
              ["Pres Başlama", text(report.press_start_time)],
              ["Pres Bitiş", text(report.press_end_time)],
              ["Enerji Kesintisi", text(report.power_outage)],
              ["Basınç Düşmesi", text(report.pressure_drop)],
              ["Isı Dengesi", text(report.heat_balance_ok)],
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
          <PhotoSection
            photos={report.report_photos ?? []}
            photoUrls={photoUrls}
            onOpen={(photo, signedUrl, index) => setActivePhoto({ ...photo, signedUrl, index })}
          />
        </div>
      ) : null}
      {activePhoto ? <PhotoLightbox photo={activePhoto} onClose={() => setActivePhoto(null)} /> : null}
    </>
  );
}

// app/reports/[id] "Section" ile ayni: shadcn Card + dl izgarasi.
function Section({ title, rows, wide = false }: { title: string; rows: Array<[string, string]>; wide?: boolean }) {
  return (
    <Card className={wide ? "@3xl/main:col-span-2" : undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <dl className="grid gap-3 px-6 text-sm">
        {rows.map(([label, value]) => (
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4" key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words whitespace-pre-wrap">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// app/reports/[id] "PhotoSection" ile ayni.
function PhotoSection({
  photos,
  photoUrls,
  onOpen
}: {
  photos: ReportPhoto[];
  photoUrls: Record<string, string>;
  onOpen: (photo: ReportPhoto, signedUrl: string, index: number) => void;
}) {
  return (
    <Card className="@3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Fotoğraflar</CardTitle>
      </CardHeader>
      <div className="px-6">
        {photos.length === 0 ? (
          <EmptyState className="rounded-lg border border-dashed py-8">Fotoğraf eklenmemiş.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-4 @3xl/main:grid-cols-4">
            {photos.map((photo, index) => {
              const path = photo.storage_path ?? "";
              const signedUrl = photoUrls[path];

              return (
                <button
                  className="group grid gap-2 text-left disabled:cursor-not-allowed"
                  disabled={!signedUrl}
                  key={photo.id ?? path}
                  onClick={() => signedUrl && onOpen(photo, signedUrl, index)}
                  type="button"
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                    {signedUrl ? (
                      <>
                        <Image
                          alt={photo.caption || "Rapor fotoğrafı"}
                          className="size-full object-cover"
                          height={180}
                          sizes="(max-width: 980px) 50vw, 220px"
                          src={signedUrl}
                          unoptimized
                          width={240}
                        />
                        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <IconMaximize aria-hidden className="size-3.5" />
                          Aç
                        </span>
                      </>
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <IconPhoto aria-hidden className="size-6" />
                      </span>
                    )}
                  </span>
                  <span className="truncate text-sm">{photo.caption || "Açıklama yok"}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}

// app/reports/[id] "PhotoLightbox" ile ayni.
function PhotoLightbox({ photo, onClose }: { photo: ActivePhoto; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    panelRef.current?.querySelector<HTMLElement>("[aria-label='Fotoğrafı kapat']")?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, []);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    ) ?? []);
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose} role="presentation">
      <div
        aria-label={`Rapor fotoğrafı ${photo.index + 1}`}
        aria-modal="true"
        className="flex max-h-full w-full max-w-5xl flex-col gap-4 rounded-lg border bg-background p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
        ref={panelRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid min-w-0 gap-1 text-sm">
            <strong className="font-semibold break-words">{photo.caption || `Fotoğraf ${photo.index + 1}`}</strong>
            <span className="text-muted-foreground">{[photo.category, formatDateTimeDisplay(photo.created_at)].filter((value) => value && value !== "-").join(" · ") || "Rapor fotoğrafı"}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShadcnButton asChild size="sm" variant="outline">
              <a href={photo.signedUrl} rel="noreferrer" target="_blank">
                Yeni Sekmede Aç
              </a>
            </ShadcnButton>
            <IconButton aria-label="Fotoğrafı kapat" icon={<IconX aria-hidden />} onClick={onClose} variant="subtle" />
          </div>
        </div>
        <div className="relative h-[70vh] w-full overflow-hidden rounded-md bg-muted">
          <Image
            alt={photo.caption || `Rapor fotoğrafı ${photo.index + 1}`}
            className="object-contain"
            fill
            sizes="92vw"
            src={photo.signedUrl}
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
