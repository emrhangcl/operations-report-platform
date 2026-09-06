"use client";

import { ChevronLeft, ChevronRight, Filter, ScrollText, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { platformRequest } from "../_components/platform-client";
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
  OwnerPageHeader,
  OwnerPanel
} from "../_components/platform-ui";

interface AuditRow {
  id: string;
  organizationId: string | null;
  organizationName: string;
  actorId: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  createdAt: string;
}

interface LogsPayload {
  logs: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
}

export default function PlatformLogsPage() {
  const [data, setData] = useState<LogsPayload>({ logs: [], page: 1, pageSize: 15, total: 0 });
  const [page, setPage] = useState(1);
  const [table, setTable] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (table) params.set("table", table);
      if (action) params.set("action", action);
      setData(await platformRequest<LogsPayload>(`/api/platform/logs?${params.toString()}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sistem kayıtları alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [action, page, table]);

  useEffect(() => { void load(); }, [load]);
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAction(actionInput.trim());
  }

  return (
    <div className="owner-page">
      <OwnerPageHeader
        description="Yönetim hareketlerini sayfalanmış, filtrelenebilir bir kayıt ekranında inceleyin. Her sayfada yalnızca 15 kayıt gösterilir."
        eyebrow="Denetim izi"
        title="Sistem Kayıtları"
      />
      {error ? <div className="owner-message error" role="alert">{error}</div> : null}
      <OwnerPanel description={`${data.total} kayıt · Sayfa ${data.page} / ${pageCount}`} title="İşlem geçmişi">
        <form className="owner-toolbar owner-log-toolbar" onSubmit={submitSearch}>
          <label className="owner-search"><Search aria-hidden size={18} /><span className="sr-only">İşlem adı ara</span><input onChange={(event) => setActionInput(event.target.value)} placeholder="İşlem adında ara" type="search" value={actionInput} /></label>
          <label className="owner-select-wrap"><Filter aria-hidden size={16} /><span className="sr-only">Kayıt türünü filtrele</span><select onChange={(event) => { setTable(event.target.value); setPage(1); }} value={table}><option value="">Tüm kayıt türleri</option><option value="organizations">Firmalar</option><option value="subscriptions">Abonelikler</option><option value="plans">Paketler</option><option value="payments">Ödemeler</option><option value="profiles">Kullanıcılar</option><option value="reports">Raporlar</option></select></label>
          <button className="owner-button owner-button-secondary" type="submit">Filtrele</button>
        </form>
        {loading ? <OwnerLoading /> : data.logs.length === 0 ? <OwnerEmpty text="Bu filtrelerde sistem kaydı bulunamadı." /> : (
          <DataTablePanel className="owner-compact-table-wrap">
            <DataTable className="owner-table owner-log-table">
              <DataTableHeader><DataTableRow><DataTableHead>İşlem</DataTableHead><DataTableHead>Firma</DataTableHead><DataTableHead>Kayıt türü</DataTableHead><DataTableHead>Yapan</DataTableHead><DataTableHead>Tarih</DataTableHead></DataTableRow></DataTableHeader>
              <DataTableBody>
                {data.logs.map((log) => (
                  <DataTableRow key={log.id}>
                    <DataTableCell><span className="owner-log-action"><ScrollText aria-hidden size={16} /><strong>{log.action}</strong></span></DataTableCell>
                    <DataTableCell>{log.organizationName}</DataTableCell>
                    <DataTableCell><span className="owner-entity-tag">{log.entityTable}</span></DataTableCell>
                    <DataTableCell>{log.actorId ? log.actorId.slice(0, 8) : "sistem"}</DataTableCell>
                    <DataTableCell>{formatDate(log.createdAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTablePanel>
        )}
        <nav aria-label="Kayıt sayfaları" className="owner-pagination">
          <button aria-label="Önceki sayfa" className="owner-icon-button" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ChevronLeft aria-hidden size={18} /></button>
          <span><strong>{data.page}</strong> / {pageCount}</span>
          <button aria-label="Sonraki sayfa" className="owner-icon-button" disabled={loading || page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button"><ChevronRight aria-hidden size={18} /></button>
        </nav>
      </OwnerPanel>
    </div>
  );
}
