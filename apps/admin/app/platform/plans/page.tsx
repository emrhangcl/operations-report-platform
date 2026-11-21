"use client";

import { IconDotsVertical, IconPlus } from "@tabler/icons-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Alert, ConfirmDialog, StatusBadge as BaseStatusBadge } from "@/components/firm-ui";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/shadcn/dropdown-menu";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/shadcn/field";
import { Input } from "@/components/shadcn/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Textarea } from "@/components/shadcn/textarea";
import { platformRequest } from "../_components/platform-client";
import type { Plan } from "../_components/platform-types";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTablePanel,
  DataTableRow,
  formatMoney,
  OwnerEmpty,
  OwnerLoading,
  OwnerPage,
  OwnerPageHeader,
  OwnerPanel
} from "../_components/platform-ui";

type ManagedPlan = Plan & { created_at?: string; updated_at?: string };
type PlanForm = {
  code: string;
  name: string;
  description: string;
  currency: "TRY" | "USD" | "EUR";
  monthlyPrice: string;
  yearlyPrice: string;
  isActive: boolean;
  isPublic: boolean;
};

const emptyForm: PlanForm = {
  code: "",
  name: "",
  description: "",
  currency: "TRY",
  monthlyPrice: "",
  yearlyPrice: "",
  isActive: true,
  isPublic: true
};

function toPriceInput(minor: number | null) {
  return minor === null ? "" : String(minor / 100);
}

function toMinor(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : Number.NaN;
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<ManagedPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<ManagedPlan | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadPlans = useCallback(async () => {
    setError("");
    try {
      const result = await platformRequest<{ plans: ManagedPlan[] }>("/api/platform/plans");
      setPlans(result.plans);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Paketler alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setEditorOpen(true);
  }

  function openEdit(plan: ManagedPlan) {
    setEditingId(plan.id);
    setForm({
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      currency: plan.currency as PlanForm["currency"],
      monthlyPrice: toPriceInput(plan.monthly_price_minor),
      yearlyPrice: toPriceInput(plan.yearly_price_minor),
      isActive: plan.is_active,
      isPublic: plan.is_public
    });
    setError("");
    setEditorOpen(true);
  }

  // Kayit surerken pencere kapatilamaz (Escape, disari tiklama ve Vazgec dahil).
  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditingId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyPriceMinor = toMinor(form.monthlyPrice);
    const yearlyPriceMinor = toMinor(form.yearlyPrice);
    if (Number.isNaN(monthlyPriceMinor) || Number.isNaN(yearlyPriceMinor)) {
      setError("Fiyatlar sıfır veya daha büyük bir sayı olmalıdır.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await platformRequest(editingId ? `/api/platform/plans/${editingId}` : "/api/platform/plans", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          code: form.code.trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, "_"),
          name: form.name.trim(),
          description: form.description.trim() || null,
          currency: form.currency,
          monthlyPriceMinor,
          yearlyPriceMinor,
          isActive: form.isActive,
          isPublic: form.isActive ? form.isPublic : false
        })
      });
      setNotice(editingId ? "Paket ve fiyatları güncellendi." : "Yeni paket oluşturuldu.");
      setEditorOpen(false);
      await loadPlans();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Paket kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function removePlan(plan: ManagedPlan) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await platformRequest<{ archived: boolean }>(`/api/platform/plans/${plan.id}`, { method: "DELETE" });
      setNotice(result.archived ? "Paket kullanım geçmişi nedeniyle arşivlendi ve satıştan kaldırıldı." : "Paket silindi.");
      await loadPlans();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Paket kaldırılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OwnerPage>
      <OwnerPageHeader
        actions={<Button onClick={openNew} size="sm" type="button"><IconPlus /> Yeni paket</Button>}
        description="Satışa sunulacak paketleri, aylık ve yıllık fiyatlarını yönetin. Burada yayınlanan paketler fiyatlandırma sayfasında otomatik görünür."
        eyebrow="Gelir yönetimi"
        title="Paketler ve Fiyatlar"
      />
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error && !editorOpen ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <OwnerLoading /> : (
        <OwnerPanel description={`${plans.filter((plan) => plan.is_active).length} aktif, ${plans.filter((plan) => plan.is_public && plan.is_active).length} yayında`} title="Paket kataloğu">
          {plans.length === 0 ? <OwnerEmpty text="Henüz paket oluşturulmadı. İlk paketi ekleyerek başlayın." /> : (
            <DataTablePanel>
              <DataTable>
                <DataTableHeader>
                  <DataTableRow>
                    <DataTableHead>Paket</DataTableHead>
                    <DataTableHead>Açıklama</DataTableHead>
                    <DataTableHead className="text-right">Aylık</DataTableHead>
                    <DataTableHead className="text-right">Yıllık</DataTableHead>
                    <DataTableHead>Durum</DataTableHead>
                    <DataTableHead>Görünürlük</DataTableHead>
                    <DataTableHead><span className="sr-only">İşlemler</span></DataTableHead>
                  </DataTableRow>
                </DataTableHeader>
                <DataTableBody>
                  {plans.map((plan) => (
                    <DataTableRow key={plan.id}>
                      <DataTableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{plan.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{plan.code}</span>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="max-w-xs whitespace-normal text-muted-foreground">
                        {plan.description || "Paket açıklaması eklenmedi."}
                      </DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{formatMoney(plan.monthly_price_minor, plan.currency)}</DataTableCell>
                      <DataTableCell className="text-right tabular-nums">{formatMoney(plan.yearly_price_minor, plan.currency)}</DataTableCell>
                      <DataTableCell>
                        <BaseStatusBadge label={plan.is_active ? "Aktif" : "Arşiv"} tone={plan.is_active ? "success" : "neutral"} />
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        {plan.is_public && plan.is_active ? "Web sitesinde yayında" : "Yalnız yönetimde görünür"}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-label={`${plan.name} paketi işlemleri`}
                              className="size-8 text-muted-foreground data-[state=open]:bg-muted"
                              disabled={busy}
                              size="icon"
                              variant="ghost"
                            >
                              <IconDotsVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onSelect={() => openEdit(plan)}>Düzenle</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setPendingRemoval(plan)} variant="destructive">
                              Paketi kaldır
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </DataTablePanel>
          )}
        </OwnerPanel>
      )}

      <Sheet onOpenChange={(open) => { if (!open) closeEditor(); }} open={editorOpen}>
        <SheetContent
          className="w-full sm:max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            nameInputRef.current?.focus();
          }}
        >
          <form className="flex h-full flex-col" onSubmit={submit}>
            <SheetHeader>
              <SheetTitle>{editingId ? form.name || "Paket düzenle" : "Paket bilgileri"}</SheetTitle>
              <SheetDescription>{editingId ? "Paket düzenle" : "Yeni paket"}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              {error ? <Alert tone="error">{error}</Alert> : null}
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="plan-name">Paket adı *</FieldLabel>
                  <Input
                    id="plan-name"
                    maxLength={120}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    ref={nameInputRef}
                    required
                    value={form.name}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-code">Paket kodu *</FieldLabel>
                  <Input
                    id="plan-code"
                    maxLength={60}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    pattern="[a-z0-9_]+"
                    placeholder="ornek_paket"
                    required
                    value={form.code}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-description">Açıklama</FieldLabel>
                  <Textarea
                    id="plan-description"
                    maxLength={500}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    value={form.description}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="plan-monthly">Aylık fiyat ({form.currency})</FieldLabel>
                    <Input
                      id="plan-monthly"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setForm((current) => ({ ...current, monthlyPrice: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={form.monthlyPrice}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="plan-yearly">Yıllık fiyat ({form.currency})</FieldLabel>
                    <Input
                      id="plan-yearly"
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setForm((current) => ({ ...current, yearlyPrice: event.target.value }))}
                      step="0.01"
                      type="number"
                      value={form.yearlyPrice}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="plan-currency">Para birimi</FieldLabel>
                  <Select
                    onValueChange={(value) => setForm((current) => ({ ...current, currency: value as PlanForm["currency"] }))}
                    value={form.currency}
                  >
                    <SelectTrigger className="w-full" id="plan-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY · Türk Lirası</SelectItem>
                      <SelectItem value="USD">USD · ABD Doları</SelectItem>
                      <SelectItem value="EUR">EUR · Euro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    checked={form.isActive}
                    id="plan-active"
                    onCheckedChange={(value) => {
                      const checked = value === true;
                      setForm((current) => ({ ...current, isActive: checked, isPublic: checked ? current.isPublic : false }));
                    }}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="plan-active">Aktif paket</FieldLabel>
                    <FieldDescription>Yeni aboneliklerde seçilebilir.</FieldDescription>
                  </FieldContent>
                </Field>
                <Field data-disabled={!form.isActive} orientation="horizontal">
                  <Checkbox
                    checked={form.isPublic}
                    disabled={!form.isActive}
                    id="plan-public"
                    onCheckedChange={(value) => setForm((current) => ({ ...current, isPublic: value === true }))}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor="plan-public">Web sitesinde yayınla</FieldLabel>
                    <FieldDescription>Fiyatlandırma sayfasında müşterilere gösterilir.</FieldDescription>
                  </FieldContent>
                </Field>
              </FieldGroup>
            </div>
            <SheetFooter>
              <Button disabled={busy} type="submit">
                {busy ? "Kaydediliyor..." : editingId ? "Değişiklikleri kaydet" : "Paketi oluştur"}
              </Button>
              <Button disabled={busy} onClick={closeEditor} type="button" variant="outline">Vazgeç</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        confirmLabel="Kaldır"
        description={pendingRemoval ? `${pendingRemoval.name} paketi kaldırılsın mı? Kullanılmış paketler geçmiş kayıtları korumak için arşivlenir.` : undefined}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (!pendingRemoval) return;
          const plan = pendingRemoval;
          setPendingRemoval(null);
          void removePlan(plan);
        }}
        open={Boolean(pendingRemoval)}
        title="Paket kaldırma onayı"
      />
    </OwnerPage>
  );
}
