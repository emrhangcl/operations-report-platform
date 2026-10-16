"use client";

import { AlertTriangle, CheckCircle2, Clock3, Database, KeyRound, LockKeyhole, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { usePlatformDashboard } from "../_components/platform-client";
import { formatDate, OwnerEmpty, OwnerLoading, OwnerPageHeader, OwnerPanel } from "../_components/platform-ui";

export default function PlatformSystemPage() {
  const { data, error, loading, reload } = usePlatformDashboard();
  const metrics = data.metrics;

  return (
    <div className="owner-page">
      <OwnerPageHeader
        actions={<button className="owner-button owner-button-secondary" onClick={() => void reload()} type="button"><RefreshCw aria-hidden size={17} /> Durumu yenile</button>}
        description="Platformun veri erişimi, ödeme olayları ve operasyonel kontrolleri için sade bir durum merkezi."
        eyebrow="Operasyon"
        title="Sistem Durumu"
      />
      {error ? <div className="owner-message error" role="alert">{error}</div> : null}
      {loading ? <OwnerLoading /> : (
        <>
          <section className="owner-system-grid">
            <article className="healthy"><span><Database aria-hidden size={20} /></span><div><small>Veri servisi</small><strong>Bağlantı çalışıyor</strong><p>Platform verileri başarıyla okunuyor.</p></div><CheckCircle2 aria-hidden size={18} /></article>
            <article className={metrics.payment_error_count > 0 ? "warning" : "healthy"}><span><Server aria-hidden size={20} /></span><div><small>Ödeme işleyici</small><strong>{metrics.payment_error_count > 0 ? `${metrics.payment_error_count} hata bulundu` : "Olaylar sağlıklı"}</strong><p>İmzalı webhook olaylarının son durumu.</p></div>{metrics.payment_error_count > 0 ? <AlertTriangle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}</article>
            <article className={metrics.last_successful_backup_at ? "healthy" : "warning"}><span><Clock3 aria-hidden size={20} /></span><div><small>Yedekleme</small><strong>{metrics.last_successful_backup_at ? formatDate(metrics.last_successful_backup_at) : "Kayıt bağlı değil"}</strong><p>Son başarılı yedekleme işaretçisi.</p></div>{metrics.last_successful_backup_at ? <CheckCircle2 aria-hidden size={18} /> : <AlertTriangle aria-hidden size={18} />}</article>
          </section>

          <div className="owner-overview-grid">
            <OwnerPanel description="Platform yönetiminde uygulanan temel güvenlik sınırları" title="Erişim korumaları">
              <div className="owner-safeguard-list">
                <div><span><KeyRound aria-hidden size={18} /></span><div><strong>Owner yetkisi</strong><p>Bu alan normal firma yöneticilerinden ayrı platform yetkisiyle korunur.</p></div></div>
                <div><span><LockKeyhole aria-hidden size={18} /></span><div><strong>Sunucu tarafı yetki sınırı</strong><p>Veritabanı servis rolü ve oturum belirteçleri tarayıcı koduna gönderilmez.</p></div></div>
                <div><span><ShieldCheck aria-hidden size={18} /></span><div><strong>İşlem kaydı</strong><p>Kritik firma, abonelik ve paket hareketleri denetim izine yazılır.</p></div></div>
              </div>
            </OwnerPanel>
            <OwnerPanel description="Son ödeme olaylarının hızlı kontrolü" title="Olay akışı">
              {data.paymentEvents.length === 0 ? <OwnerEmpty text="Ödeme olayı bulunmuyor." /> : <div className="owner-system-events">{data.paymentEvents.slice(0, 8).map((event) => <div className={event.hasError ? "danger" : ""} key={event.id}><span>{event.hasError ? <AlertTriangle aria-hidden size={17} /> : <CheckCircle2 aria-hidden size={17} />}</span><div><strong>{event.eventType}</strong><small>{event.provider} · {formatDate(event.receivedAt)}</small></div><em>{event.hasError ? "Hata" : event.signatureVerified ? "Doğrulandı" : "Bekliyor"}</em></div>)}</div>}
            </OwnerPanel>
          </div>
        </>
      )}
    </div>
  );
}
