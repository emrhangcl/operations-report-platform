"use client";

import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  FlexRender,
  rowPaginationFeature,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type PaginationState
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/shadcn/dropdown-menu";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { countOrganizationTabs, matchesOrganizationTab, organizationTabs, type OrganizationTab } from "./organization-tabs";
import type { OrganizationRow, Plan } from "./platform-types";
import { formatDate, statusLabel } from "./platform-ui";

// Panel API'si en yeni 200 firmayi dondurur; liste bu sinira ulastiginda kullaniciya soylenir.
const ORGANIZATION_LIST_LIMIT = 200;

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel()
});

type OrganizationTableRow = OrganizationRow & { planName: string | null };

const columnHelper = createColumnHelper<typeof features, OrganizationTableRow>();

const columnLabels: Record<string, string> = {
  plan: "Paket",
  subscription: "Abonelik",
  organizationStatus: "Firma durumu",
  createdAt: "Kayıt"
};

function subscriptionVariant(status: string | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active" || status === "lifetime") return "secondary";
  if (status === "past_due" || status === "read_only") return "destructive";
  return "outline";
}

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Firma",
    enableHiding: false,
    cell: ({ row }) => (
      <Link className="flex min-w-0 flex-col hover:underline" href={`/platform/organizations/${row.original.id}`}>
        <span className="truncate font-medium text-foreground">{row.original.name}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.slug}</span>
      </Link>
    )
  }),
  columnHelper.accessor("planName", {
    id: "plan",
    header: "Paket",
    cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">Paket yok</span>
  }),
  columnHelper.accessor((row) => row.subscription?.status ?? null, {
    id: "subscription",
    header: "Abonelik",
    cell: ({ getValue }) => {
      const status = getValue();
      return status ? (
        <Badge className="px-1.5" variant={subscriptionVariant(status)}>
          {statusLabel(status)}
        </Badge>
      ) : (
        <span className="text-muted-foreground">Abonelik yok</span>
      );
    }
  }),
  columnHelper.accessor("status", {
    id: "organizationStatus",
    header: "Firma durumu",
    cell: ({ getValue }) => {
      const status = getValue();
      if (status === "active") return <span className="text-muted-foreground">Aktif</span>;
      return (
        <Badge className="px-1.5" variant={status === "suspended" ? "destructive" : "outline"}>
          {statusLabel(status)}
        </Badge>
      );
    }
  }),
  columnHelper.accessor("created_at", {
    id: "createdAt",
    header: "Kayıt",
    cell: ({ getValue }) => <span className="tabular-nums">{formatDate(getValue(), false)}</span>
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="flex size-8 text-muted-foreground data-[state=open]:bg-muted" size="icon" variant="ghost">
            <EllipsisVertical aria-hidden />
            <span className="sr-only">{row.original.name} için işlemler</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem asChild>
            <Link href={`/platform/organizations/${row.original.id}`}>Detay</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  })
]);

// shadcn dashboard-01 "DataTable" duzeni: sekmeler + kolon menusu + sayfalama. Satir surukleme
// ve secim kutulari yok (owner panelinde toplu islem bulunmuyor).
export function OverviewOrganizationsTable({ organizations, plans }: { organizations: OrganizationRow[]; plans: Plan[] }) {
  const [tab, setTab] = useState<OrganizationTab>("all");
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const planNames = useMemo(() => new Map(plans.map((plan) => [plan.id, plan.name])), [plans]);
  const rows = useMemo<OrganizationTableRow[]>(
    () =>
      organizations.map((organization) => ({
        ...organization,
        planName: organization.subscription?.plan_id ? planNames.get(organization.subscription.plan_id) ?? null : null
      })),
    [organizations, planNames]
  );
  const counts = useMemo(() => countOrganizationTabs(organizations), [organizations]);
  const data = useMemo(() => rows.filter((row) => matchesOrganizationTab(row, tab)), [rows, tab]);

  const table = useTable({
    features,
    data,
    columns,
    state: { columnVisibility, pagination },
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination
  });

  function changeTab(value: string) {
    const next = organizationTabs.find((item) => item.id === value);
    if (!next) return;
    setTab(next.id);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  const pageCount = Math.max(1, table.getPageCount());

  return (
    <Tabs className="w-full flex-col justify-start gap-4" onValueChange={changeTab} value={tab}>
      <div className="flex items-center justify-between gap-2 px-4 lg:px-6">
        <Label className="sr-only" htmlFor="organization-tab-selector">
          Firma görünümü
        </Label>
        <Select onValueChange={changeTab} value={tab}>
          <SelectTrigger className="flex w-fit @4xl/main:hidden" id="organization-tab-selector" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizationTabs.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label} ({counts[item.id]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          {organizationTabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label} <Badge variant="secondary">{counts[item.id]}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline">
              <Columns3 aria-hidden />
              <span>Kolonlar</span>
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide() && column.id in columnLabels)
              .map((column) => (
                <DropdownMenuCheckboxItem
                  checked={column.getIsVisible()}
                  key={column.id}
                  onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  onSelect={(event) => event.preventDefault()}
                >
                  {columnLabels[column.id]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead colSpan={header.colSpan} key={header.id}>
                      {header.isPlaceholder ? null : <FlexRender header={header} />}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell className="last:w-12" key={cell.id}>
                        <FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={table.getVisibleLeafColumns().length}>
                    {organizations.length === 0 ? "Henüz kayıtlı firma bulunmuyor." : "Bu görünümde firma yok."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {organizations.length >= ORGANIZATION_LIST_LIMIT ? (
              <>
                İlk {ORGANIZATION_LIST_LIMIT} firma gösteriliyor —{" "}
                <Link className="font-medium text-foreground underline underline-offset-4" href="/platform/organizations">
                  tamamı için Firmalar sayfası
                </Link>
              </>
            ) : (
              `${data.length} firma`
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm font-medium tabular-nums">
              Sayfa {table.state.pagination.pageIndex + 1} / {pageCount}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button className="hidden size-8 lg:flex" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)} size="icon" variant="outline">
                <span className="sr-only">İlk sayfa</span>
                <ChevronsLeft aria-hidden />
              </Button>
              <Button className="size-8" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} size="icon" variant="outline">
                <span className="sr-only">Önceki sayfa</span>
                <ChevronLeft aria-hidden />
              </Button>
              <Button className="size-8" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} size="icon" variant="outline">
                <span className="sr-only">Sonraki sayfa</span>
                <ChevronRight aria-hidden />
              </Button>
              <Button className="hidden size-8 lg:flex" disabled={!table.getCanNextPage()} onClick={() => table.setPageIndex(pageCount - 1)} size="icon" variant="outline">
                <span className="sr-only">Son sayfa</span>
                <ChevronsRight aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Tabs>
  );
}
