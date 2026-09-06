"use client";

import { ArrowRight, Building2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
    <div className="owner-page">
      <OwnerPageHeader
        description="Firma hesaplarını, aboneliklerini ve erişim durumlarını tek listeden izleyin. Bir firmanın ayrıntısına girerek paket veya erişim işlemlerini yönetin."
        eyebrow="Müşteri yönetimi"
        title="Firmalar"
      />
      {error ? <div className="owner-message error" role="alert">{error}</div> : null}
      {loading ? <OwnerLoading /> : (
        <OwnerPanel description={`${filtered.length} / ${data.organizations.length} firma gösteriliyor`} title="Firma dizini">
          <div className="owner-toolbar">
            <label className="owner-search">
              <Search aria-hidden size={18} />
              <span className="sr-only">Firma ara</span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Firma adı, kısa ad veya e-posta ara" type="search" value={query} />
            </label>
            <label className="owner-select-wrap">
              <span className="sr-only">Duruma göre filtrele</span>
              <select onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="all">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="suspended">Askıda</option>
                <option value="closed">Kapatıldı</option>
              </select>
            </label>
          </div>

          {filtered.length === 0 ? <OwnerEmpty text="Arama ölçütlerine uyan firma bulunamadı." /> : (
            <DataTablePanel className="owner-compact-table-wrap">
              <DataTable className="owner-table owner-table-spacious">
                <DataTableHeader><DataTableRow><DataTableHead>Firma</DataTableHead><DataTableHead>Erişim</DataTableHead><DataTableHead>Paket</DataTableHead><DataTableHead>Abonelik</DataTableHead><DataTableHead>Oluşturulma</DataTableHead><DataTableHead><span className="sr-only">Detay</span></DataTableHead></DataTableRow></DataTableHeader>
                <DataTableBody>
                  {filtered.map((organization) => (
                    <DataTableRow key={organization.id}>
                      <DataTableCell>
                        <Link className="owner-table-link" href={`/platform/organizations/${organization.id}`}>
                          <span className="owner-company-mark"><Building2 aria-hidden size={18} /></span>
                          <span><strong>{organization.name}</strong><small>{organization.billing_email ?? organization.slug}</small></span>
                        </Link>
                      </DataTableCell>
                      <DataTableCell><StatusBadge status={organization.status} /></DataTableCell>
                      <DataTableCell>{organization.subscription?.plan_id ? planNames.get(organization.subscription.plan_id) ?? "Tanımsız paket" : "Paket yok"}</DataTableCell>
                      <DataTableCell><StatusBadge status={organization.subscription?.status} /></DataTableCell>
                      <DataTableCell>{formatDate(organization.created_at, false)}</DataTableCell>
                      <DataTableCell><Link aria-label={`${organization.name} detayını aç`} className="owner-icon-link" href={`/platform/organizations/${organization.id}`}><ArrowRight aria-hidden size={18} /></Link></DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTablePanel>
          )}
        </OwnerPanel>
      )}
    </div>
  );
}
