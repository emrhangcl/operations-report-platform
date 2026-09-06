"use client";

import { Check, Edit3, Eye, EyeOff, PackageOpen, Plus, Trash2, X } from "lucide-react";
import { FormEvent, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "../../../components/ui";
import { platformRequest } from "../_components/platform-client";
import type { Plan } from "../_components/platform-types";
import { formatMoney, OwnerEmpty, OwnerLoading, OwnerPageHeader, OwnerPanel } from "../_components/platform-ui";

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
  const editorRef = useRef<HTMLFormElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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
  useEffect(() => {
    if (!editorOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimer = window.setTimeout(() => nameInputRef.current?.focus(), 40);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [editorOpen]);

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

  function closeEditor() {
    if (busy) return;
    setEditorOpen(false);
    setEditingId(null);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEditor();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = Array.from(editorRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
    ) ?? []).filter((element) => !element.hasAttribute("disabled"));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
    <div className="owner-page">
      <OwnerPageHeader
        actions={<button className="owner-button" onClick={openNew} type="button"><Plus aria-hidden size={18} /> Yeni paket</button>}
        description="Satışa sunulacak paketleri, aylık ve yıllık fiyatlarını yönetin. Burada yayınlanan paketler fiyatlandırma sayfasında otomatik görünür."
        eyebrow="Gelir yönetimi"
        title="Paketler ve Fiyatlar"
      />
      {notice ? <div className="owner-message success" role="status">{notice}</div> : null}
      {error && !editorOpen ? <div className="owner-message error" role="alert">{error}</div> : null}
      {loading ? <OwnerLoading /> : (
        <OwnerPanel description={`${plans.filter((plan) => plan.is_active).length} aktif, ${plans.filter((plan) => plan.is_public && plan.is_active).length} yayında`} title="Paket kataloğu">
          {plans.length === 0 ? <OwnerEmpty text="Henüz paket oluşturulmadı. İlk paketi ekleyerek başlayın." /> : (
            <div className="owner-plan-grid">
              {plans.map((plan) => (
                <article className={!plan.is_active ? "archived" : ""} key={plan.id}>
                  <div className="owner-plan-card-top">
                    <span className="owner-plan-icon"><PackageOpen aria-hidden size={20} /></span>
                    <div><small>{plan.code}</small><h2>{plan.name}</h2></div>
                    <span className={plan.is_active ? "owner-plan-state active" : "owner-plan-state"}>{plan.is_active ? "Aktif" : "Arşiv"}</span>
                  </div>
                  <p>{plan.description || "Paket açıklaması eklenmedi."}</p>
                  <div className="owner-plan-prices">
                    <div><span>Aylık</span><strong>{formatMoney(plan.monthly_price_minor, plan.currency)}</strong></div>
                    <div><span>Yıllık</span><strong>{formatMoney(plan.yearly_price_minor, plan.currency)}</strong></div>
                  </div>
                  <div className="owner-plan-visibility">{plan.is_public && plan.is_active ? <><Eye aria-hidden size={16} /> Web sitesinde yayında</> : <><EyeOff aria-hidden size={16} /> Yalnız yönetimde görünür</>}</div>
                  <div className="owner-plan-actions">
                    <button className="owner-button owner-button-secondary" disabled={busy} onClick={() => openEdit(plan)} type="button"><Edit3 aria-hidden size={16} /> Düzenle</button>
                    <button aria-label={`${plan.name} paketini kaldır`} className="owner-icon-button danger" disabled={busy} onClick={() => setPendingRemoval(plan)} title="Paketi kaldır" type="button"><Trash2 aria-hidden size={17} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </OwnerPanel>
      )}

      {editorOpen ? (
        <div aria-modal="true" className="owner-modal" onMouseDown={(event) => { if (event.currentTarget === event.target) closeEditor(); }} role="dialog">
          <form className="owner-modal-card" onKeyDown={handleEditorKeyDown} onSubmit={submit} ref={editorRef}>
            <div className="owner-modal-heading"><div><span>{editingId ? "Paket düzenle" : "Yeni paket"}</span><h2>{editingId ? form.name : "Paket bilgileri"}</h2></div><button aria-label="Pencereyi kapat" className="owner-icon-button" disabled={busy} onClick={closeEditor} type="button"><X aria-hidden size={19} /></button></div>
            {error ? <div className="owner-message error" role="alert">{error}</div> : null}
            <div className="owner-form-grid">
              <label><span>Paket adı *</span><input ref={nameInputRef} required maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} /></label>
              <label><span>Paket kodu *</span><input required maxLength={60} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} pattern="[a-z0-9_]+" placeholder="ornek_paket" value={form.code} /></label>
              <label className="owner-form-full"><span>Açıklama</span><textarea maxLength={500} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} value={form.description} /></label>
              <label><span>Aylık fiyat</span><div className="owner-price-input"><input inputMode="decimal" min="0" onChange={(event) => setForm((current) => ({ ...current, monthlyPrice: event.target.value }))} step="0.01" type="number" value={form.monthlyPrice} /><small>{form.currency}</small></div></label>
              <label><span>Yıllık fiyat</span><div className="owner-price-input"><input inputMode="decimal" min="0" onChange={(event) => setForm((current) => ({ ...current, yearlyPrice: event.target.value }))} step="0.01" type="number" value={form.yearlyPrice} /><small>{form.currency}</small></div></label>
              <label><span>Para birimi</span><select onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as PlanForm["currency"] }))} value={form.currency}><option value="TRY">TRY · Türk Lirası</option><option value="USD">USD · ABD Doları</option><option value="EUR">EUR · Euro</option></select></label>
            </div>
            <div className="owner-toggle-list">
              <label><input checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked, isPublic: event.target.checked ? current.isPublic : false }))} type="checkbox" /><span><strong>Aktif paket</strong><small>Yeni aboneliklerde seçilebilir.</small></span><i><Check aria-hidden size={14} /></i></label>
              <label><input checked={form.isPublic} disabled={!form.isActive} onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))} type="checkbox" /><span><strong>Web sitesinde yayınla</strong><small>Fiyatlandırma sayfasında müşterilere gösterilir.</small></span><i><Check aria-hidden size={14} /></i></label>
            </div>
            <div className="owner-modal-actions"><button className="owner-button owner-button-secondary" disabled={busy} onClick={closeEditor} type="button">Vazgeç</button><button className="owner-button" disabled={busy} type="submit">{busy ? "Kaydediliyor..." : editingId ? "Değişiklikleri kaydet" : "Paketi oluştur"}</button></div>
          </form>
        </div>
      ) : null}
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
    </div>
  );
}
