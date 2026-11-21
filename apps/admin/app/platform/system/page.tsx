"use client";

import { IconRefresh } from "@tabler/icons-react";
import { Alert, StatusBadge as BaseStatusBadge } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { usePlatformDashboard } from "../_components/platform-client";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  formatDate,
  OwnerEmpty,
  OwnerLoading,
  OwnerPage,
  OwnerPageHeader,
  OwnerPanel,
  OwnerStatCard,
  OwnerStatGrid
} from "../_components/platform-ui";

function HealthBadge({ healthy }: { healthy: boolean }) {
  return <BaseStatusBadge label={healthy ? "Sağlıklı" : "Kontrol gerekli"} tone={healthy ? "success" : "warning"} />;
}

const safeguards = [
  { title: "Owner yetkisi", text: "Bu alan normal firma yöneticilerinden ayrı platform yetkisiyle korunur." },
  { title: "Sunucu tarafı yetki sınırı", text: "Veritabanı servis rolü ve oturum belirteçleri tarayıcı koduna gönderilmez." },
  { title: "İşlem kaydı", text: "Kritik firma, abonelik ve paket hareketleri denetim izine yazılır." }
];

export default function PlatformSystemPage() {
  const { data, error, loading, reload } = usePlatformDashboard();
  const metrics = data.metrics;

  return (
    <OwnerPage>
      <OwnerPageHeader
        actions={<Button onClick={() => void reload()} size="sm" type="button" variant="outline"><IconRefresh /> Durumu yenile</Button>}
        description="Platformun veri erişimi, ödeme olayları ve operasyonel kontrolleri için sade bir durum merkezi."
        eyebrow="Operasyon"
        title="Sistem Durumu"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <OwnerLoading /> : (
        <>
          <OwnerStatGrid label="Servis durumları">
            <OwnerStatCard
              textValue
              action={<HealthBadge healthy />}
              detail="Platform verileri başarıyla okunuyor."
              label="Veri servisi"
              value="Bağlantı çalışıyor"
            />
            <OwnerStatCard
              textValue
              action={<HealthBadge healthy={metrics.payment_error_count === 0} />}
              detail="İmzalı webhook olaylarının son durumu."
              label="Ödeme işleyici"
              value={metrics.payment_error_count > 0 ? `${metrics.payment_error_count} hata bulundu` : "Olaylar sağlıklı"}
            />
            <OwnerStatCard
              textValue
              action={<HealthBadge healthy={Boolean(metrics.last_successful_backup_at)} />}
              detail="Son başarılı yedekleme işaretçisi."
              label="Yedekleme"
              value={metrics.last_successful_backup_at ? formatDate(metrics.last_successful_backup_at) : "Kayıt bağlı değil"}
            />
          </OwnerStatGrid>

          <div className="grid grid-cols-1 gap-4 @5xl/main:grid-cols-2">
            <OwnerPanel description="Platform yönetiminde uygulanan temel güvenlik sınırları" title="Erişim korumaları">
              <ul className="flex flex-col divide-y">
                {safeguards.map((item) => (
                  <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0" key={item.title}>
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-sm text-muted-foreground">{item.text}</span>
                  </li>
                ))}
              </ul>
            </OwnerPanel>
            <OwnerPanel description="Son ödeme olaylarının hızlı kontrolü" title="Olay akışı">
              {data.paymentEvents.length === 0 ? <OwnerEmpty text="Ödeme olayı bulunmuyor." /> : (
                <DataTablePanel>
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow>
                        <DataTableHead>Olay</DataTableHead>
                        <DataTableHead>Sağlayıcı</DataTableHead>
                        <DataTableHead>Tarih</DataTableHead>
                        <DataTableHead>Durum</DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {data.paymentEvents.slice(0, 8).map((event) => (
                        <DataTableRow key={event.id}>
                          <DataTableCell className="font-medium">{event.eventType}</DataTableCell>
                          <DataTableCell>{event.provider}</DataTableCell>
                          <DataTableCell className="tabular-nums">{formatDate(event.receivedAt)}</DataTableCell>
                          <DataTableCell>
                            <BaseStatusBadge
                              label={event.hasError ? "Hata" : event.signatureVerified ? "Doğrulandı" : "Bekliyor"}
                              tone={event.hasError ? "danger" : event.signatureVerified ? "success" : "pending"}
                            />
                          </DataTableCell>
                        </DataTableRow>
                      ))}
                    </DataTableBody>
                  </DataTable>
                </DataTablePanel>
              )}
            </OwnerPanel>
          </div>
        </>
      )}
    </OwnerPage>
  );
}
