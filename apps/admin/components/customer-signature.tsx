"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, Eraser, Send, Undo2 } from "lucide-react";
import { CUSTOMER_SIGNATURE_CONSENT, customerSignatureSchema, type CustomerSignature } from "@operations/validation";
import { Alert, Button, FormField } from "@/components/firm-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Field, FieldLabel } from "@/components/shadcn/field";

type Point = [number, number];

export function SignaturePhotoPreview({ file, url, caption }: { file?: File; url?: string; caption: string }) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setLocalUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const src = url || localUrl;
  return (
    <figure className="m-0 grid gap-2">
      {src ? (
        <Image
          alt={caption || "Rapor fotoğrafı"}
          className="h-auto max-h-64 w-full rounded-lg border bg-muted object-contain"
          height={360}
          src={src}
          unoptimized
          width={640}
        />
      ) : null}
      <figcaption className="text-sm break-words text-muted-foreground">{caption || "Rapor fotoğrafı"}</figcaption>
    </figure>
  );
}

function SignatureDrawing({ strokes }: { strokes: Point[][] }) {
  return <>{strokes.map((stroke, i) => <polyline key={i} points={stroke.map((point) => point.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}</>;
}

// Firma paneli (v2) icin ayni imza gorunumu: shadcn Card yapisi.
export function CustomerSignatureCard({ signature, signedAt }: { signature: unknown; signedAt?: string | null }) {
  const parsed = customerSignatureSchema.safeParse(signature);
  const date = signedAt ? new Date(signedAt) : null;
  return (
    <section aria-label="Firma yetkilisi onayı" className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-6 shadow-sm">
      <h2 className="leading-none font-semibold">Firma yetkilisi onayı</h2>
      {parsed.success ? (
        <>
          <svg
            aria-label={`${parsed.data.signer_name} tarafından atılan teslim imzası`}
            className="block h-auto w-full max-w-md rounded-lg border bg-muted/40 text-foreground"
            role="img"
            viewBox="0 0 600 240"
          >
            <SignatureDrawing strokes={parsed.data.strokes} />
          </svg>
          <div className="grid gap-1 text-sm">
            <span className="font-medium">{parsed.data.signer_name}</span>
            <span className="text-muted-foreground">{parsed.data.signer_title}</span>
            {date && !Number.isNaN(date.getTime()) ? (
              <time className="text-muted-foreground" dateTime={signedAt ?? undefined}>
                {date.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (Türkiye saati)
              </time>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{CUSTOMER_SIGNATURE_CONSENT}</p>
          <p className="text-sm text-muted-foreground">
            Eve/ofise giriş zamanı ve dönüş araç kilometresi, müşteri teslim onayından sonra personel tarafından kaydedilen kapanış bilgileridir.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Bu raporda kayıtlı dijital teslim imzası bulunmuyor.</p>
      )}
    </section>
  );
}

export function CustomerSignatureApproval({ companyName, reportDate, summary, initialName, loading, onBack, onSubmit }: {
  companyName: string; reportDate: string; summary: React.ReactNode; initialName: string; loading: boolean;
  onBack: () => void; onSubmit: (signature: CustomerSignature) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [error, setError] = useState("");
  const pointer = useRef<number | null>(null);
  const current = useRef<Point[]>([]);
  const [drawing, setDrawing] = useState<Point[]>([]);

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(Math.max(0, Math.min(600, (event.clientX - rect.left) / rect.width * 600))), Math.round(Math.max(0, Math.min(240, (event.clientY - rect.top) / rect.height * 240)))];
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    if (pointer.current !== event.pointerId) return;
    const completedStroke = current.current;
    if (!cancelled && completedStroke.length >= 2) setStrokes((previous) => [...previous, completedStroke]);
    current.current = [];
    setDrawing([]);
    pointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  async function submit() {
    const parsed = customerSignatureSchema.safeParse({ version: 1, signer_name: name, signer_title: title, consent, strokes });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "İmza bilgilerini kontrol edin."); return; }
    setError("");
    await onSubmit(parsed.data);
  }
  return (
    <section aria-labelledby="signature-heading" className="grid gap-4">
      <div>
        <Button disabled={loading} icon={<ArrowLeft aria-hidden />} onClick={onBack} variant="secondary">Rapora dön</Button>
      </div>
      <Card>
        <CardHeader>
          <CardDescription>Son adım · Teslim onayı</CardDescription>
          <CardTitle className="text-xl" id="signature-heading">Firma yetkilisinin imzası</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">Cihazı firma yetkilisine verin. Yetkili, raporu inceleyip aşağıdaki alana parmağı veya kalemiyle imzasını atabilir.</p>
          <div className="grid gap-2 rounded-lg bg-muted p-4 text-sm break-words">
            <strong className="font-medium">{companyName}</strong>
            <span>{reportDate.split("-").reverse().join(".")}</span>
            {summary}
          </div>
          <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0" disabled={loading}>
            <FormField label="Yetkilinin adı ve soyadı">
              <input autoComplete="off" maxLength={120} onChange={(event) => { setName(event.target.value); setConsent(false); }} value={name} />
            </FormField>
            <FormField label="Görevi / unvanı">
              <input autoComplete="organization-title" maxLength={120} onChange={(event) => { setTitle(event.target.value); setConsent(false); }} placeholder="Örn. Bakım sorumlusu" value={title} />
            </FormField>
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">İmza</span>
                <span className="text-muted-foreground">Parmak, kalem veya fare ile</span>
              </div>
              <div className="relative overflow-hidden rounded-lg border bg-muted/40 text-foreground">
                <svg
                  aria-describedby="signature-help"
                  aria-label="Firma yetkilisi çizim imza alanı"
                  className="block aspect-[5/2] h-auto min-h-44 w-full cursor-crosshair touch-none select-none"
                  preserveAspectRatio="none"
                  role="img"
                  viewBox="0 0 600 240"
                  onPointerDown={(event) => {
                    if (loading || pointer.current !== null || event.button !== 0) return;
                    if (strokes.length >= 40 || strokes.reduce((sum, stroke) => sum + stroke.length, 0) >= 2000) { setError("İmza alanı doldu. Temizleyip yeniden imzalayın."); return; }
                    event.preventDefault(); setConsent(false); setError(""); pointer.current = event.pointerId;
                    current.current = [point(event)]; setDrawing(current.current); event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (loading || pointer.current !== event.pointerId) return;
                    const next = point(event), last = current.current[current.current.length - 1];
                    if (!last || Math.hypot(next[0] - last[0], next[1] - last[1]) < 2) return;
                    if (current.current.length >= 500 || strokes.reduce((sum, stroke) => sum + stroke.length, current.current.length) >= 2000) { setError("İmza sınırına ulaşıldı. Gerekirse temizleyip yeniden imzalayın."); return; }
                    current.current = [...current.current, next]; setDrawing(current.current);
                  }}
                  onPointerUp={(event) => finish(event)}
                  onPointerCancel={(event) => finish(event, true)}
                  onLostPointerCapture={(event) => finish(event, true)}
                >
                  <SignatureDrawing strokes={[...strokes, drawing]} />
                </svg>
                {strokes.length === 0 && drawing.length === 0 ? (
                  <span className="pointer-events-none absolute inset-x-0 top-[45%] text-center text-sm text-muted-foreground">Buraya imza atın</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!strokes.length || loading} icon={<Undo2 aria-hidden />} onClick={() => { setStrokes((previous) => previous.slice(0, -1)); setConsent(false); }} variant="secondary">Geri al</Button>
              <Button disabled={!strokes.length || loading} icon={<Eraser aria-hidden />} onClick={() => { setStrokes([]); setConsent(false); setError(""); }} variant="subtle">Temizle</Button>
            </div>
            <p className="text-sm text-muted-foreground" id="signature-help">Çizim yapamıyorsanız raporu taslak olarak saklayıp imza alabilecek şekilde devam edin.</p>
            <Field className="items-start rounded-lg border p-4" orientation="horizontal">
              <Checkbox checked={consent} id="signature-consent" onCheckedChange={(checked) => setConsent(checked === true)} />
              <FieldLabel className="leading-normal font-normal" htmlFor="signature-consent">{CUSTOMER_SIGNATURE_CONSENT}</FieldLabel>
            </Field>
          </fieldset>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="text-sm text-muted-foreground">İmza bu raporla birlikte saklanır ve PDF belgesinde görünür. İmzalanan iş ve teslim bilgileri değiştirilemez; dönüş saati ile araç teslim kilometresi personel tarafından dönüşte tamamlanır.</p>
          <Button className="h-10 w-full" disabled={loading || drawing.length > 0} icon={<Send aria-hidden />} onClick={submit}>{loading ? "İmzalı rapor kaydediliyor…" : "Onayla ve raporu gönder"}</Button>
        </CardContent>
      </Card>
    </section>
  );
}
