"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, CheckCircle2, Eraser, PenLine, Send, Undo2 } from "lucide-react";
import { CUSTOMER_SIGNATURE_CONSENT, customerSignatureSchema, type CustomerSignature } from "@operations/validation";
import { Button } from "./ui";
import styles from "./customer-signature.module.css";

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
  return <figure style={{ margin: 0 }}>
    {src ? <Image src={src} alt={caption || "Rapor fotoğrafı"} width={640} height={360} unoptimized style={{ width: "100%", height: "auto", maxHeight: 260, objectFit: "contain", borderRadius: 8 }} /> : null}
    <figcaption>{caption || "Rapor fotoğrafı"}</figcaption>
  </figure>;
}

function SignatureDrawing({ strokes }: { strokes: Point[][] }) {
  return <>{strokes.map((stroke, i) => <polyline key={i} points={stroke.map((point) => point.join(",")).join(" ")} fill="none" stroke="#172b4d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}</>;
}

export function CustomerSignatureView({ signature, signedAt }: { signature: unknown; signedAt?: string | null }) {
  const parsed = customerSignatureSchema.safeParse(signature);
  if (!parsed.success) return <section className={styles.card}><h3>Firma yetkilisi onayı</h3><p>Bu raporda kayıtlı dijital teslim imzası bulunmuyor.</p></section>;
  const value = parsed.data;
  const date = signedAt ? new Date(signedAt) : null;
  return <section className={styles.card} aria-label="Firma yetkilisi onayı">
    <div className={styles.heading}><CheckCircle2 size={22} aria-hidden /><h3>Firma yetkilisi onayı</h3></div>
    <svg className={styles.preview} viewBox="0 0 600 240" role="img" aria-label={`${value.signer_name} tarafından atılan teslim imzası`}><SignatureDrawing strokes={value.strokes} /></svg>
    <strong>{value.signer_name}</strong><span>{value.signer_title}</span>
    {date && !Number.isNaN(date.getTime()) ? <time dateTime={signedAt!}>{date.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} (Türkiye saati)</time> : null}
    <p>{CUSTOMER_SIGNATURE_CONSENT}</p>
    <p>Eve/ofise giriş zamanı ve dönüş araç kilometresi, müşteri teslim onayından sonra personel tarafından kaydedilen kapanış bilgileridir.</p>
  </section>;
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
  return <section className={styles.approval} aria-labelledby="signature-heading">
    <Button variant="secondary" disabled={loading} icon={<ArrowLeft size={18} aria-hidden />} onClick={onBack}>Rapora dön</Button>
    <div className={styles.card}>
      <div className={styles.heading}><PenLine size={24} aria-hidden /><div><small>SON ADIM · TESLİM ONAYI</small><h2 id="signature-heading">Firma yetkilisinin imzası</h2></div></div>
      <p>Cihazı firma yetkilisine verin. Yetkili, raporu inceleyip aşağıdaki alana parmağı veya kalemiyle imzasını atabilir.</p>
      <div className={styles.summary}><strong>{companyName}</strong><span>{reportDate.split("-").reverse().join(".")}</span>{summary}</div>
      <fieldset disabled={loading} className={styles.fields}>
        <label>Yetkilinin adı ve soyadı<input autoComplete="off" maxLength={120} value={name} onChange={(event) => { setName(event.target.value); setConsent(false); }} /></label>
        <label>Görevi / unvanı<input autoComplete="organization-title" maxLength={120} placeholder="Örn. Bakım sorumlusu" value={title} onChange={(event) => { setTitle(event.target.value); setConsent(false); }} /></label>
        <div className={styles.padLabel}><strong>İmza</strong><span>Parmak, kalem veya fare ile</span></div>
        <div className={styles.pad}>
          <svg viewBox="0 0 600 240" preserveAspectRatio="none" role="img" aria-label="Firma yetkilisi çizim imza alanı" aria-describedby="signature-help"
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
            }} onPointerUp={(event) => finish(event)} onPointerCancel={(event) => finish(event, true)} onLostPointerCapture={(event) => finish(event, true)}>
            <SignatureDrawing strokes={[...strokes, drawing]} />
          </svg>
          {strokes.length === 0 && drawing.length === 0 ? <span className={styles.placeholder}>Buraya imza atın</span> : null}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={!strokes.length || loading} icon={<Undo2 size={17} aria-hidden />} onClick={() => { setStrokes((previous) => previous.slice(0, -1)); setConsent(false); }}>Geri al</Button>
          <Button variant="subtle" disabled={!strokes.length || loading} icon={<Eraser size={17} aria-hidden />} onClick={() => { setStrokes([]); setConsent(false); setError(""); }}>Temizle</Button>
        </div>
        <p id="signature-help">Çizim yapamıyorsanız raporu taslak olarak saklayıp imza alabilecek şekilde devam edin.</p>
        <label className={styles.consent}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>{CUSTOMER_SIGNATURE_CONSENT}</span></label>
      </fieldset>
      {error ? <div role="alert" className="message error">{error}</div> : null}
      <p>İmza bu raporla birlikte saklanır ve PDF belgesinde görünür. İmzalanan iş ve teslim bilgileri değiştirilemez; dönüş saati ile araç teslim kilometresi personel tarafından dönüşte tamamlanır.</p>
      <Button className={styles.submit} disabled={loading || drawing.length > 0} icon={<Send size={18} aria-hidden />} onClick={submit}>{loading ? "İmzalı rapor kaydediliyor…" : "Onayla ve raporu gönder"}</Button>
    </div>
  </section>;
}
