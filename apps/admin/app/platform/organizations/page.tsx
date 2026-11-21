"use client";

import { IconArrowRight } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Alert } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
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
  StatusBadge
} from "../_components/platform-ui";

export default function PlatformOrganizationsPage() {
  const { data, error, loading } = usePlatformDashboard();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const planNames = useMemo(() => new Map(data.plans.map((plan) => [plan.id, plan.name])), [data.plans]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR");
    return data.organizations.filter((organization) => {
      const matchesQuery = !normalized || `${organization.name} ${organization.slug} ${organization.billing_email ?? ""}`.toLocaleLowerCase("tr-TR").includes(normalized);
      const matchesStatus = status === "all" || organization.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data.organizations, query, status]);

  return (
    <OwnerPage>
      <OwnerPageHeader
        description="Firma hesaplarını, aboneliklerini ve erişim durumlarını tek listeden izleyin. Bir firmanın ayrıntısına girerek paket veya erişim işlemlerini yönetin."
        eyebrow="Müşteri yönetimi"
        title="Firmalar"
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <OwnerLoading /> : (
        <OwnerPanel description={`${filtered.length} / ${data.organizations.length} firma gösteriliyor`} title="Firma dizini">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label className="sr-only" htmlFor="organization-search">Firma ara</Label>
            <Input
              className="sm:max-w-sm"
              id="organization-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Firma adı, kısa ad veya e-posta ara"
              type="search"
              value={query}
            />
            <Label className="sr-only" htmlFor="organization-status">Duruma göre filtrele</Label>
            <Select onValueChange={setStatus} value={status}>
              <SelectTrigger className="w-full sm:w-44" id="organization-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="suspended">Askıda</SelectItem>
                <SelectItem value="closed">Kapatıldı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? <OwnerEmpty text="Arama ölçütlerine uyan firma bulunamadı." /> : (
            <DataTablePanel>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Firma</DataTableHead>
                    <DataTableHead>Erişim</DataTableHead>
                    <DataTableHead>Paket</DataTableHead>
                    <DataTableHead>Abonelik</DataTableHead>
                    <DataTableHead>Oluşturulma</DataTableHead>
                    <DataTableHead><span className="sr-only">Detay</span></DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {filtered.map((organization) => (
                    <DataTableRow key={organization.id}>
                      <DataTableCell>
                        <Link className="flex flex-col font-medium hover:underline" href={`/platform/organizations/${organization.id}`}>
                          {organization.name}
                          <span className="text-xs font-normal text-muted-foreground">{organization.billing_email ?? organization.slug}</span>
                        </Link>
                      </DataTableCell>
                      <DataTableCell><StatusBadge status={organization.status} /></DataTableCell>
                      <DataTableCell>{organization.subscription?.plan_id ? planNames.get(organization.subscription.plan_id) ?? "Tanımsız paket" : "Paket yok"}</DataTableCell>
                      <DataTableCell><StatusBadge status={organization.subscription?.status} /></DataTableCell>
                      <DataTableCell className="tabular-nums">{formatDate(organization.created_at, false)}</DataTableCell>
                      <DataTableCell className="text-right">
                        <Button asChild className="size-8 text-muted-foreground" size="icon" variant="ghost">
                          <Link aria-label={`${organization.name} detayını aç`} href={`/platform/organizations/${organization.id}`}>
                            <IconArrowRight />
                          </Link>
                        </Button>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTablePanel>
          )}
        </OwnerPanel>
      )}
    </OwnerPage>
  );
}
