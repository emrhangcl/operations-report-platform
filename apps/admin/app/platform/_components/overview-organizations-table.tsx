"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircleCheckFilled,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconListDetails,
  IconLoader
} from "@tabler/icons-react";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type Row
} from "@tanstack/react-table";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from "@/components/shadcn/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/shadcn/dropdown-menu";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { countOrganizationTabs, matchesOrganizationTab, organizationTabs, type OrganizationTab } from "./organization-tabs";
import type { OrganizationRow, Plan } from "./platform-types";
import { formatDate, statusLabel } from "./platform-ui";

// Panel API'si en yeni 200 firmayi dondurur; liste bu sinira ulastiginda kullaniciya soylenir.
const ORGANIZATION_LIST_LIMIT = 200;

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  paginatedRowModel: createPaginatedRowModel()
});

type OrganizationTableRow = OrganizationRow & { planName: string | null };

const columnHelper = createColumnHelper<typeof features, OrganizationTableRow>();

const columnLabels: Record<string, string> = {
  plan: "Paket",
  subscription: "Abonelik",
  periodEnd: "Dönem bitişi",
  interval: "Fatura",
  organizationStatus: "Firma durumu"
};

function intervalLabel(row: OrganizationTableRow) {
  if (!row.subscription) return "—";
  if (row.subscription.status === "lifetime") return "Ömür boyu";
  return row.subscription.billing_interval === "yearly" ? "Yıllık" : "Aylık";
}

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id });
  return (
    <Button {...attributes} {...listeners} className="size-7 text-muted-foreground hover:bg-transparent" size="icon" variant="ghost">
      <IconGripVertical className="size-3 text-muted-foreground" />
      <span className="sr-only">Sürükleyerek sırala</span>
    </Button>
  );
}

const columns = columnHelper.columns([
  columnHelper.display({
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          aria-label="Tümünü seç"
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox aria-label="Satırı seç" checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} />
      </div>
    ),
    enableHiding: false
  }),
  columnHelper.accessor("name", {
    header: "Firma",
    cell: ({ row }) => <TableCellViewer item={row.original} />,
    enableHiding: false
  }),
  columnHelper.accessor("planName", {
    id: "plan",
    header: "Paket",
    cell: ({ row }) => (
      <div className="w-32">
        <Badge className="px-1.5 text-muted-foreground" variant="outline">
          {row.original.planName ?? "Paket yok"}
        </Badge>
      </div>
    )
  }),
  columnHelper.accessor((row) => row.subscription?.status ?? null, {
    id: "subscription",
    header: "Abonelik",
    cell: ({ row }) => {
      const status = row.original.subscription?.status;
      return (
        <Badge className="px-1.5 text-muted-foreground" variant="outline">
          {status === "active" || status === "lifetime" ? (
            <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" />
          ) : (
            <IconLoader />
          )}
          {status ? statusLabel(status) : "Abonelik yok"}
        </Badge>
      );
    }
  }),
  columnHelper.accessor((row) => row.subscription?.current_period_ends_at ?? null, {
    id: "periodEnd",
    header: () => <div className="w-full text-right">Dönem bitişi</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {row.original.subscription?.current_period_ends_at ? formatDate(row.original.subscription.current_period_ends_at, false) : "—"}
      </div>
    )
  }),
  columnHelper.accessor((row) => intervalLabel(row), {
    id: "interval",
    header: () => <div className="w-full text-right">Fatura</div>,
    cell: ({ row }) => <div className="text-right">{intervalLabel(row.original)}</div>
  }),
  columnHelper.accessor("status", {
    id: "organizationStatus",
    header: "Firma durumu",
    cell: ({ row }) => statusLabel(row.original.status)
  }),
  columnHelper.display({
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="flex size-8 text-muted-foreground data-[state=open]:bg-muted" size="icon" variant="ghost">
            <IconDotsVertical />
            <span className="sr-only">Menüyü aç</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem asChild>
            <Link href={`/platform/organizations/${row.original.id}`}>Detayı aç</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`/platform/organizations/${row.original.id}`} rel="noopener" target="_blank">
              Yeni sekmede aç
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  })
]);

function DraggableRow({ row }: { row: Row<typeof features, OrganizationTableRow> }) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({ id: row.original.id });
  return (
    <TableRow
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      data-dragging={isDragging}
      data-state={row.getIsSelected() && "selected"}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// shadcn dashboard-01 "DataTable" birebir: sekmeler, kolon menusu, surukle-sirala, secim,
// satir basina kayit secimi ve sayfalama. Sekmeler firma durumuna gore filtreler.
export function OverviewOrganizationsTable({ organizations, plans }: { organizations: OrganizationRow[]; plans: Plan[] }) {
  const [tab, setTab] = React.useState<OrganizationTab>("all");
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({});
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 });
  const sortableId = React.useId();
  const sensors = useSensors(useSensor(MouseSensor, {}), useSensor(TouchSensor, {}), useSensor(KeyboardSensor, {}));

  const planNames = React.useMemo(() => new Map(plans.map((plan) => [plan.id, plan.name])), [plans]);
  const rows = React.useMemo<OrganizationTableRow[]>(
    () =>
      organizations.map((organization) => ({
        ...organization,
        planName: organization.subscription?.plan_id ? planNames.get(organization.subscription.plan_id) ?? null : null
      })),
    [organizations, planNames]
  );
  const counts = React.useMemo(() => countOrganizationTabs(organizations), [organizations]);

  const [data, setData] = React.useState<OrganizationTableRow[]>([]);
  React.useEffect(() => {
    setData(rows.filter((row) => matchesOrganizationTab(row, tab)));
  }, [rows, tab]);

  const dataIds = React.useMemo<UniqueIdentifier[]>(() => data.map(({ id }) => id), [data]);

  const table = useTable({
    features,
    data,
    columns,
    state: { columnVisibility, rowSelection, pagination },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((current) => arrayMove(current, dataIds.indexOf(active.id), dataIds.indexOf(over.id)));
    }
  }

  function changeTab(value: string) {
    const next = organizationTabs.find((item) => item.id === value);
    if (!next) return;
    setTab(next.id);
    setRowSelection({});
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  return (
    <Tabs className="w-full flex-col justify-start gap-6" onValueChange={changeTab} value={tab}>
      <div className="flex items-center justify-between px-4 lg:px-6">
        <Label className="sr-only" htmlFor="view-selector">
          Görünüm
        </Label>
        <Select onValueChange={changeTab} value={tab}>
          <SelectTrigger className="flex w-fit @4xl/main:hidden" id="view-selector" size="sm">
            <SelectValue placeholder="Görünüm seçin" />
          </SelectTrigger>
          <SelectContent>
            {organizationTabs.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          {organizationTabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label} {item.id !== "all" && counts[item.id] > 0 ? <Badge variant="secondary">{counts[item.id]}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Kolonları düzenle</span>
                <span className="lg:hidden">Kolonlar</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.id in columnLabels && column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    checked={column.getIsVisible()}
                    key={column.id}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {columnLabels[column.id]}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild size="sm" variant="outline">
            <Link href="/platform/organizations">
              <IconListDetails />
              <span className="hidden lg:inline">Tüm firmalar</span>
            </Link>
          </Button>
        </div>
      </div>
      <TabsContent className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6" value={tab}>
        <div className="overflow-hidden rounded-lg border">
          <DndContext collisionDetection={closestCenter} id={sortableId} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd} sensors={sensors}>
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
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows.length ? (
                  <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow key={row.id} row={row} />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={columns.length}>
                      {organizations.length === 0 ? "Henüz kayıtlı firma yok." : "Sonuç yok."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {organizations.length >= ORGANIZATION_LIST_LIMIT
              ? `İlk ${ORGANIZATION_LIST_LIMIT} firma gösteriliyor. `
              : ""}
            {table.getSelectedRowModel().rows.length} / {data.length} satır seçili.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label className="text-sm font-medium" htmlFor="rows-per-page">
                Sayfa başına satır
              </Label>
              <Select onValueChange={(value) => table.setPageSize(Number(value))} value={`${table.state.pagination.pageSize}`}>
                <SelectTrigger className="w-20" id="rows-per-page" size="sm">
                  <SelectValue placeholder={table.state.pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Sayfa {table.state.pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button className="hidden h-8 w-8 p-0 lg:flex" disabled={!table.getCanPreviousPage()} onClick={() => table.setPageIndex(0)} variant="outline">
                <span className="sr-only">İlk sayfa</span>
                <IconChevronsLeft />
              </Button>
              <Button className="size-8" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()} size="icon" variant="outline">
                <span className="sr-only">Önceki sayfa</span>
                <IconChevronLeft />
              </Button>
              <Button className="size-8" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()} size="icon" variant="outline">
                <span className="sr-only">Sonraki sayfa</span>
                <IconChevronRight />
              </Button>
              <Button
                className="hidden size-8 lg:flex"
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                size="icon"
                variant="outline"
              >
                <span className="sr-only">Son sayfa</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// shadcn dashboard-01 "TableCellViewer": firma adina tiklayinca acilan cekmece.
function TableCellViewer({ item }: { item: OrganizationTableRow }) {
  const isMobile = useIsMobile();
  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button className="w-fit px-0 text-left text-foreground" variant="link">
          {item.name}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="gap-1">
          <DrawerTitle>{item.name}</DrawerTitle>
          <DrawerDescription>{item.slug}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-sm">
          <form className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <Label htmlFor={`${item.id}-name`}>Firma adı</Label>
              <Input defaultValue={item.name} id={`${item.id}-name`} readOnly />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor={`${item.id}-plan`}>Paket</Label>
                <Input defaultValue={item.planName ?? "Paket yok"} id={`${item.id}-plan`} readOnly />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor={`${item.id}-subscription`}>Abonelik</Label>
                <Input
                  defaultValue={item.subscription ? statusLabel(item.subscription.status) : "Abonelik yok"}
                  id={`${item.id}-subscription`}
                  readOnly
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3">
                <Label htmlFor={`${item.id}-period`}>Dönem bitişi</Label>
                <Input
                  defaultValue={item.subscription?.current_period_ends_at ? formatDate(item.subscription.current_period_ends_at, false) : "—"}
                  id={`${item.id}-period`}
                  readOnly
                />
              </div>
              <div className="flex flex-col gap-3">
                <Label htmlFor={`${item.id}-created`}>Kayıt</Label>
                <Input defaultValue={formatDate(item.created_at, false)} id={`${item.id}-created`} readOnly />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Label htmlFor={`${item.id}-email`}>Fatura e-postası</Label>
              <Input defaultValue={item.billing_email ?? "—"} id={`${item.id}-email`} readOnly />
            </div>
          </form>
        </div>
        <DrawerFooter>
          <Button asChild>
            <Link href={`/platform/organizations/${item.id}`}>Detay sayfasını aç</Link>
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Kapat</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
