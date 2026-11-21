"use client";

import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
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
  OwnerPage,
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

// Radix Select bos deger kabul etmedigi icin "tumu" secenegi bu anahtarla temsil edilir.
const ALL_TABLES = "all";

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
    <OwnerPage>
      <OwnerPageHeader
        description="Yönetim hareketlerini sayfalanmış, filtrelenebilir bir kayıt ekranında inceleyin. Her sayfada yalnızca 15 kayıt gösterilir."
        eyebrow="Denetim izi"
        title="Sistem Kayıtları"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <OwnerPanel description={`${data.total} kayıt · Sayfa ${data.page} / ${pageCount}`} title="İşlem geçmişi">
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={submitSearch}>
          <Label className="sr-only" htmlFor="log-action-search">İşlem adı ara</Label>
          <Input
            className="sm:max-w-sm"
            id="log-action-search"
            onChange={(event) => setActionInput(event.target.value)}
            placeholder="İşlem adında ara"
            type="search"
            value={actionInput}
          />
          <Label className="sr-only" htmlFor="log-table-filter">Kayıt türünü filtrele</Label>
          <Select
            onValueChange={(value) => { setTable(value === ALL_TABLES ? "" : value); setPage(1); }}
            value={table || ALL_TABLES}
          >
            <SelectTrigger className="w-full sm:w-48" id="log-table-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TABLES}>Tüm kayıt türleri</SelectItem>
              <SelectItem value="organizations">Firmalar</SelectItem>
              <SelectItem value="subscriptions">Abonelikler</SelectItem>
              <SelectItem value="plans">Paketler</SelectItem>
              <SelectItem value="payments">Ödemeler</SelectItem>
              <SelectItem value="profiles">Kullanıcılar</SelectItem>
              <SelectItem value="reports">Raporlar</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">Filtrele</Button>
        </form>
        {loading ? <OwnerLoading /> : data.logs.length === 0 ? <OwnerEmpty text="Bu filtrelerde sistem kaydı bulunamadı." /> : (
          <DataTablePanel>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>İşlem</DataTableHead>
                  <DataTableHead>Firma</DataTableHead>
                  <DataTableHead>Kayıt türü</DataTableHead>
                  <DataTableHead>Yapan</DataTableHead>
                  <DataTableHead>Tarih</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {data.logs.map((log) => (
                  <DataTableRow key={log.id}>
                    <DataTableCell className="font-medium">{log.action}</DataTableCell>
                    <DataTableCell>{log.organizationName}</DataTableCell>
                    <DataTableCell>
                      <Badge className="px-1.5 text-muted-foreground" variant="outline">{log.entityTable}</Badge>
                    </DataTableCell>
                    <DataTableCell className="font-mono text-xs text-muted-foreground">{log.actorId ? log.actorId.slice(0, 8) : "sistem"}</DataTableCell>
                    <DataTableCell className="tabular-nums">{formatDate(log.createdAt)}</DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </DataTablePanel>
        )}
        <nav aria-label="Kayıt sayfaları" className="flex items-center justify-end gap-2">
          <div className="mr-2 text-sm font-medium">Sayfa {data.page} / {pageCount}</div>
          <Button
            aria-label="Önceki sayfa"
            className="size-8"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            size="icon"
            type="button"
            variant="outline"
          >
            <IconChevronLeft />
          </Button>
          <Button
            aria-label="Sonraki sayfa"
            className="size-8"
            disabled={loading || page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <IconChevronRight />
          </Button>
        </nav>
      </OwnerPanel>
    </OwnerPage>
  );
}
