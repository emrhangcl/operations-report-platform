# Owner Paneli Yeniden Tasarımı (Aşama 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/platform` owner panelini shadcn/ui `dashboard-01` temelli, Neutral temalı, varsayılan koyu, gerçek veriyle çalışan modern bir arayüze taşımak; bunu yaparken Tailwind v4 + shadcn altyapısını eski sayfaları bozmadan kurmak.

**Architecture:** Tailwind v4 + shadcn `apps/admin`'e eklenir; eski altı CSS dosyası `legacy` CSS katmanına alınır, shadcn token'ları yalnızca `[data-ui="v2"]` kökünde tanımlanır. Owner alanı (`app/platform/**`) bu köke sarılır; shadcn bileşenleri `components/shadcn/` altına kurulur (eski `components/ui/` dokunulmaz). Grafik için günlük seri mevcut `/api/platform/dashboard` route'una sunucu tarafında eklenir.

**Tech Stack:** Next.js 15.5 App Router, React 19, TypeScript (strict, `exactOptionalPropertyTypes`), Tailwind CSS v4, shadcn/ui (new-york, Neutral), Recharts (shadcn chart), TanStack Table (shadcn data-table), lucide-react, Geist (`next/font/google`), Vitest (node env), pnpm.

**Spec:** `docs/superpowers/specs/2026-11-20-owner-panel-redesign-design.md`

## Global Constraints

- Yalnızca `/platform/**` görünümü değişir. `/`, `/login`, `/register`, `/app`, `/reports`, `/personel` ve diğer tüm sayfalarda **görünür bozulma olmaz** (piksel eşitliği şart değil).
- Renk teması: shadcn **Neutral**. Owner alanında renkli vurgu yok; turuncu yalnızca logoda.
- Font: **Geist** (`next/font/google`, CSP `font-src 'self'` ile uyumlu). Simgeler: **lucide-react**.
- Owner varsayılan **koyu**; geçiş düğmesi tercihi `localStorage` anahtarı `owner-theme` (`"dark"` | `"light"`) altında saklar.
- Ekranda sahte veri yok: dashboard-01 örnek `data.json`, "Acme Inc.", Quick Create, Lifecycle, Data Library, GitHub linki gibi öğeler kaldırılır. Hesaplanamayan trend rozeti gösterilmez.
- Yıkıcı işlemler satırda ghost buton/menü öğesi; dolu kırmızı yalnızca onay diyaloğunda.
- dashboard-01'in satır sürükleme (dnd-kit) özelliği alınmaz.
- Güvenlik: CSP (`next.config.mjs`) değiştirilmez; yeni veri yalnızca `requirePlatformAdmin` + `enforceRateLimit("platform-dashboard")` arkasında, sunucuda toplanmış günlük toplamlar olarak döner.
- `pnpm lint` `--max-warnings=0`; strict TS ayarları gevşetilmez (shadcn kodunda çıkan tip hataları kodda düzeltilir).
- Türkçe arayüz metni; tarih/para `tr-TR`, saat dilimi `Europe/Istanbul`.
- Commit mesajları `feat:`/`fix:`/`style:`/`chore:`/`refactor:`/`docs:` önekli, sonunda `Claude-Session: https://claude.ai/code/session_01QGCFhnDLrf3zeno2fbe1ZU` satırı.

## Review Focus

1. **Hiç veri yokken** (bugünkü durum: 0 ödeme): kartlar `₺0,00`, grafik "Henüz tahsilat veya yeni kayıt yok" boş durumu, trend rozeti yok; önceki dönem 0 iken `Infinity`/`NaN` yüzdesi asla görünmez. → Task 3 testleri `periodChange` için.
2. **Askıya alınmış ama aboneliği aktif firma** yalnızca "Askıda" sekmesinde görünür, "Aktif"te görünmez. → Task 5 testi.
3. **Gün sınırı saat dilimi:** UTC 21:30'da (İstanbul 00:30) yapılan ödeme ertesi güne yazılır. → Task 3 testi.
4. **Bozuk/erişilemeyen tema tercihi:** `localStorage` değeri geçersizse veya erişim hata fırlatırsa panel koyu açılır, sayfa çökmez. → Task 2 testi.
5. **İade edilmiş tutar:** günlük tahsilat `amount_minor - refunded_amount_minor`, `paid_at` boş olan ödeme seride yer almaz. → Task 3 testi.

---

### Task 1: Tailwind v4 + shadcn altyapısı (eski sayfalar korunarak)

**Files:**
- Create: `apps/admin/postcss.config.mjs`, `apps/admin/components.json`, `apps/admin/app/styles.css`, `apps/admin/lib/shadcn-utils.ts`
- Modify: `apps/admin/package.json`, `apps/admin/tsconfig.json`, `apps/admin/app/layout.tsx:1-13,43-50`
- Create (CLI): `apps/admin/components/shadcn/*` (bu taskta yalnızca `button`)

**Interfaces:**
- Produces: TS alias `@/*` → `apps/admin/*`; `cn(...inputs: ClassValue[]): string` in `lib/shadcn-utils.ts`; shadcn bileşen importları `@/components/shadcn/<ad>`; CSS: `[data-ui="v2"]` ve `[data-ui="v2"].dark` / `[data-ui="v2"] .dark` altında Neutral token'ları; Tailwind `font-sans` = `var(--font-geist-sans)`; layout `<html>` sınıfında `--font-geist-sans` değişkeni.

- [ ] **Step 1: Değişiklikten ÖNCE eski sayfaların ekran görüntülerini al**
  Çalışan dev sunucuda (owner hesabıyla oturum açık) 1440×900 ve 375×812'de şu sayfaları kaydet: `/`, `/login`, `/app`, `/reports`, `/assignments`, `/personel` (personel oturumu yoksa giriş ekranı). Klasör: `.superpowers/baseline/` (git'e girmez; `.git/info/exclude`'da `.superpowers/` var).
- [ ] **Step 2: Bağımlılıkları ekle**
  `pnpm --filter @operations/admin add tailwindcss @tailwindcss/postcss tw-animate-css class-variance-authority clsx tailwind-merge` ve `pnpm --filter @operations/admin add -D postcss`. `postcss.config.mjs`: `{ plugins: { "@tailwindcss/postcss": {} } }`.
- [ ] **Step 3: Alias** — `apps/admin/tsconfig.json` `compilerOptions.paths`'e base'teki beş `@operations/*` girdisini aynen kopyala ve `"@/*": ["apps/admin/*"]` ekle (paths birleşmez, üzerine yazar; `baseUrl` repo kökü).
- [ ] **Step 4: `components.json`** — style `new-york`, `rsc: true`, `tsx: true`, tailwind `{ config: "", css: "app/styles.css", baseColor: "neutral", cssVariables: true }`, iconLibrary `lucide`, aliases `{ components: "@/components", ui: "@/components/shadcn", utils: "@/lib/shadcn-utils", lib: "@/lib", hooks: "@/hooks" }`.
- [ ] **Step 5: `app/styles.css`** — sırayla: `@layer theme, base, legacy, components, utilities;`; altı eski dosya `@import "./theme-tokens.css" layer(legacy);` (sonra `globals`, `enterprise-system`, `public-system`, `frosted-system`); `@import "tailwindcss";` ; `@import "tw-animate-css";`; `@custom-variant dark (&:is(.dark *, .dark));`; shadcn Neutral açık token'ları `[data-ui="v2"] { … }`, koyu token'ları `[data-ui="v2"].dark, [data-ui="v2"] .dark { … }` (değerler shadcn Neutral temasından birebir, `npx shadcn init` çıktısı referans); `@theme inline { … }` eşlemeleri ve `--font-sans: var(--font-geist-sans)`. `[data-ui="v2"] { @apply bg-background text-foreground font-sans; }`.
- [ ] **Step 6: `layout.tsx`** — beş CSS importu yerine tek `import "./styles.css";`; mevcut iki font kalır, `Geist` eklenir (`variable: "--font-geist-sans"`, `subsets: ["latin", "latin-ext"]`) ve `<html>` className'ine eklenir.
- [ ] **Step 7: shadcn button'ı kur** — `cd apps/admin && pnpm dlx shadcn@latest add button`. Beklenen: `components/shadcn/button.tsx` oluşur, `components/ui/*` değişmez (`git status` ile doğrula).
- [ ] **Step 8: Doğrula** — `pnpm --filter @operations/admin typecheck && pnpm --filter @operations/admin lint && pnpm --filter @operations/admin build` geçer. Step 1'deki sayfaları tekrar çek, yan yana karşılaştır: görünür bozulma (düzen kayması, kaybolan kenarlık/boşluk, okunmaz metin) varsa `styles.css`'te ilgili seçiciyi düzelterek gider. Tarayıcı konsolunda CSP hatası yok.
- [ ] **Step 9: Commit** — `chore: add tailwind v4 and shadcn foundation with legacy css layer`

### Task 2: Owner tema tercihi (koyu varsayılan, yanıp sönmeden)

**Files:**
- Create: `apps/admin/lib/owner-theme.ts`, `apps/admin/lib/owner-theme.test.ts`

**Interfaces:**
- Produces: `OWNER_THEME_STORAGE_KEY = "owner-theme"`; `type OwnerTheme = "dark" | "light"`; `resolveOwnerTheme(stored: string | null | undefined): OwnerTheme` (geçersiz → `"dark"`); `readOwnerTheme(storage: Pick<Storage, "getItem"> | null): OwnerTheme` (hata fırlatırsa `"dark"`); `writeOwnerTheme(storage: Pick<Storage, "setItem"> | null, theme: OwnerTheme): void` (hatayı yutar); `ownerThemeBootScript: string` — owner kökü (`#owner-root`) render edilmeden önce çalışan, `localStorage`'ı okuyup köke `dark` sınıfını koyan/kaldıran satır içi script (CSP `script-src 'unsafe-inline'` izinli).

- [ ] **Step 1: Failing test** — `owner-theme.test.ts`:
  - `resolveOwnerTheme(null)` → `"dark"`; `("light")` → `"light"`; `("dark")` → `"dark"`; `("blue")` → `"dark"`.
  - `readOwnerTheme({ getItem: () => { throw new Error("blocked"); } })` → `"dark"`; `readOwnerTheme(null)` → `"dark"`.
  - `writeOwnerTheme({ setItem: () => { throw new Error("quota"); } }, "light")` hata fırlatmaz.
  - `ownerThemeBootScript` `"owner-theme"` metnini içerir.
- [ ] **Step 2: Çalıştır, FAIL gör** — `pnpm --filter @operations/admin exec vitest run lib/owner-theme.test.ts`
- [ ] **Step 3: Uygula** (`lib/owner-theme.ts`, saf fonksiyonlar; `"use client"` yok).
- [ ] **Step 4: PASS gör** (aynı komut).
- [ ] **Step 5: Commit** — `feat: add owner theme preference helpers`

### Task 3: Günlük tahsilat / yeni firma serisi (API)

**Files:**
- Create: `apps/admin/lib/platform-activity.ts`, `apps/admin/lib/platform-activity.test.ts`, `apps/admin/app/api/platform/dashboard/route.test.ts`
- Modify: `apps/admin/app/api/platform/dashboard/route.ts`, `apps/admin/app/platform/_components/platform-types.ts` (`DashboardPayload`, `emptyDashboard`)

**Interfaces:**
- Produces:
  - `interface DailyActivity { date: string /* YYYY-MM-DD, Europe/Istanbul */; collectedMinor: number; newOrganizations: number }`
  - `buildDailyActivity(input: { payments: Array<{ amount_minor: number; refunded_amount_minor: number; paid_at: string | null }>; organizations: Array<{ created_at: string }>; days: number; now: Date }): DailyActivity[]` — tam `days` uzunluğunda, eskiden yeniye, boş günler 0.
  - `periodChange(series: DailyActivity[], key: "collectedMinor" | "newOrganizations", days: number): { current: number; previous: number; percent: number | null }` — son `days` gün vs önceki `days` gün; `previous === 0` ise `percent: null`.
  - `DashboardPayload.activity: DailyActivity[]` (90 gün); `emptyDashboard.activity = []`.
- Consumes: `requirePlatformAdmin`, `auth.service.from(...)` (data-client `gte`, `eq`, `select`).

- [ ] **Step 1: Failing tests** — `platform-activity.test.ts`:
  - `buildDailyActivity({ payments: [], organizations: [], days: 7, now })` → 7 eleman, hepsi 0, son elemanın `date`'i `now`'ın İstanbul tarihi.
  - `paid_at: "2026-11-19T21:30:00Z"` olan ödeme `"2026-11-20"` gününe yazılır (now `2026-11-20T12:00:00Z`).
  - `amount_minor: 10000, refunded_amount_minor: 2500` → o gün `collectedMinor: 7500`; `paid_at: null` olan ödeme hiçbir güne eklenmez; pencere dışındaki tarih yok sayılır.
  - `periodChange` önceki dönem 0 → `percent: null`; önceki 100, şimdiki 150 → `percent: 50`.
  `route.test.ts` (organizations route testinin mock deseniyle): `requirePlatformAdmin` 403 dönerse yanıt 403 ve `service` çağrılmaz; başarılı durumda yanıt gövdesinde `activity` uzunluğu 90 ve ödeme sorgusu `status = "succeeded"` ile yapılır.
- [ ] **Step 2: FAIL gör** — `pnpm --filter @operations/admin exec vitest run lib/platform-activity.test.ts app/api/platform/dashboard/route.test.ts`
- [ ] **Step 3: `lib/platform-activity.ts`'i uygula** — gün anahtarı `Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" })` ile.
- [ ] **Step 4: Route'u genişlet** — mevcut `Promise.all`'a iki sorgu ekle: `payments` (`amount_minor,refunded_amount_minor,paid_at`, `eq("status","succeeded")`, `gte("paid_at", since)`, `limit(5000)`) ve `organizations` (`created_at`, `gte("created_at", since)`, `limit(5000)`); `since` = şimdi − 90 gün. Hata olursa mevcut 500 mesajı. Yanıta `activity: buildDailyActivity({ …, days: 90, now: new Date() })` ekle. Ham ödeme satırları yanıta girmez.
- [ ] **Step 5: PASS gör** (aynı komut) ve `pnpm --filter @operations/admin typecheck`.
- [ ] **Step 6: Commit** — `feat: add daily activity series to platform dashboard api`

### Task 4: Owner iskeleti (sidebar + başlık + tema düğmesi)

**Files:**
- Create (CLI): `components/shadcn/{sidebar,separator,sheet,tooltip,skeleton,input,dropdown-menu,avatar,breadcrumb}.tsx`, `hooks/use-mobile.ts`
- Create: `apps/admin/app/platform/_components/owner-sidebar.tsx`, `apps/admin/app/platform/_components/owner-site-header.tsx`, `apps/admin/app/platform/_components/owner-theme-toggle.tsx`
- Modify: `apps/admin/app/platform/_components/platform-shell.tsx` (tamamen yeniden), `apps/admin/app/platform/layout.tsx`

**Interfaces:**
- Consumes: Task 1 alias/token'lar; Task 2 `readOwnerTheme`, `writeOwnerTheme`, `ownerThemeBootScript`; mevcut `getBrowserClient()?.auth.signOut()`, `ProductBrand` (`components/logo`).
- Produces: `PlatformShell({ children })` — kök `<div id="owner-root" data-ui="v2" className="dark …">`; `OwnerSiteHeader({ title }: { title: string })`; `ownerNavigation` dizisi (mevcut altı öğe, aynı `href`/etiket/simge); sayfalar başlığı `OwnerSiteHeader`'a değil, kendi `OwnerPageHeader`'larına yazmaya devam eder (header başlığı pathname'den `ownerNavigation` ile türetilir).

- [ ] **Step 1: Bileşenleri kur** — `cd apps/admin && pnpm dlx shadcn@latest add sidebar separator sheet tooltip skeleton dropdown-menu avatar breadcrumb input`. `git status`: yalnızca `components/shadcn/`, `hooks/`, `package.json`, lockfile değişir.
- [ ] **Step 2: Shell'i dashboard-01 düzeniyle kur** — `SidebarProvider` + `Sidebar variant="inset" collapsible="icon"` + `SidebarInset`; menü: logo/"Operasyon Portalı", altı gezinme öğesi (aktiflik mevcut `exact`/`startsWith` kuralıyla), altta "Firma paneline git" (`/app`) ve kullanıcı bloğu (oturumdaki e-posta; menüsünde "Çıkış yap"). Header: `SidebarTrigger`, ayırıcı, başlık, sağda `OwnerThemeToggle` (Sun/Moon simgesi, `aria-label="Açık temaya geç"`/`"Koyu temaya geç"`). `ownerThemeBootScript` kökten hemen önce `<script dangerouslySetInnerHTML>` ile. Atlama bağlantısı "İçeriğe geç" korunur.
- [ ] **Step 3: Portal teması** — Sheet/DropdownMenu/Tooltip portal içeriklerinin tema alması için `components/shadcn/` içindeki ilgili `*Portal` kullanımlarına `container` olarak `#owner-root` verilir (veya portal içeriğine `data-ui="v2"` + aktif tema sınıfı). Mobil (375px) çekmecede açık/koyu tema doğru görünmeli.
- [ ] **Step 4: Doğrula** — typecheck, lint; tarayıcıda `/platform` 1440 ve 375px, koyu ve açık: menü daralma, mobil çekmece, tema düğmesi, yenilemede tercih korunuyor, ilk yüklemede açık temadan koyuya yanıp sönme yok. Eski sayfalarda (`/app`) değişiklik yok.
- [ ] **Step 5: Commit** — `feat: rebuild owner shell on shadcn sidebar`

### Task 5: Firma sekme kuralları

**Files:**
- Create: `apps/admin/app/platform/_components/organization-tabs.ts`, `apps/admin/app/platform/_components/organization-tabs.test.ts`

**Interfaces:**
- Consumes: `OrganizationRow` (`platform-types.ts`).
- Produces: `type OrganizationTab = "all" | "active" | "grace" | "readOnly" | "suspended"`; `organizationTabs: Array<{ id: OrganizationTab; label: string }>` = Tümü, Aktif, Ek sürede, Salt okunur, Askıda; `matchesOrganizationTab(row: OrganizationRow, tab: OrganizationTab): boolean`; `countOrganizationTabs(rows: OrganizationRow[]): Record<OrganizationTab, number>`.

- [ ] **Step 1: Failing test** —
  - firma `suspended` + abonelik `active` → yalnızca `all` ve `suspended` true.
  - firma `active` + abonelik `lifetime` → `active` true.
  - firma `active` + abonelik `grace_period` → `grace` true, `active` false.
  - firma `active` + abonelik `read_only` → `readOnly` true.
  - firma `active` + abonelik `past_due` / `pending` / `canceled` / `null`, ve firma `closed` → yalnızca `all`.
  - `countOrganizationTabs` beş satırlık karışık listede beklenen sayıları verir.
- [ ] **Step 2: FAIL gör** — `pnpm --filter @operations/admin exec vitest run app/platform/_components/organization-tabs.test.ts`
- [ ] **Step 3: Uygula** (spec'teki kurallar: Aktif = abonelik `active`|`lifetime` VE firma `active`; Askıda = firma `suspended`; abonelik sekmeleri firma `active` iken).
- [ ] **Step 4: PASS gör.**
- [ ] **Step 5: Commit** — `feat: add organization tab rules for owner overview`

### Task 6: Genel Bakış sayfası (dashboard-01) — KULLANICI ONAY NOKTASI

**Files:**
- Create (CLI): `components/shadcn/{card,badge,chart,tabs,table,toggle-group,select,checkbox,label}.tsx`
- Create: `apps/admin/app/platform/_components/overview-section-cards.tsx`, `overview-activity-chart.tsx`, `overview-organizations-table.tsx`
- Modify: `apps/admin/app/platform/page.tsx` (tamamen yeniden)

**Interfaces:**
- Consumes: `usePlatformDashboard()` (`data.metrics`, `data.organizations`, `data.activity`, `data.plans`, `data.auditLogs`, `reload`); Task 3 `periodChange`; Task 5 `organizationTabs`, `matchesOrganizationTab`, `countOrganizationTabs`; mevcut `formatMoney`, `formatDate`, `statusLabel` (`platform-ui.tsx`).
- Produces: `OverviewSectionCards({ metrics, activity })`, `OverviewActivityChart({ activity })`, `OverviewOrganizationsTable({ organizations, plans })`.

- [ ] **Step 1: Bileşenleri kur** — `pnpm dlx shadcn@latest add card badge chart tabs table toggle-group select checkbox label` (ve TanStack: `pnpm --filter @operations/admin add @tanstack/react-table`).
- [ ] **Step 2: KPI kartları** — dashboard-01 `SectionCards` yapısı; sıra ve değerler: "Aylık düzenli gelir" `formatMoney(mrr_minor)` (rozet yok, alt satır `${active_subscriptions} aktif abonelik`); "Toplam tahsilat" `formatMoney(successful_collected_minor)` (rozet: `periodChange(activity,"collectedMinor",30).percent`, null ise yok; alt satır "Son 30 gün: …"); "Kayıtlı firma" `total_organizations` (rozet: `periodChange(…,"newOrganizations",30)`, alt satır `Son 30 günde +${new_organizations_30d}`); "Aktif kullanıcı" `active_users` (rozet yok).
- [ ] **Step 3: Grafik** — shadcn "Area Chart – Interactive" (dashboard-01) + "Bar Chart – Interactive" başlık kutuları: iki kutu "Tahsilat" (dönem toplamı `formatMoney`) / "Yeni firma" (dönem toplamı), seçili seri alan grafiği olarak; aralık `ToggleGroup` (≥768px) / `Select` (mobil): 90 / 30 / 7 gün. Neutral `--chart-*` renkleri. Seçili seride tüm değerler 0 ise grafik yerine "Henüz tahsilat veya yeni kayıt yok" boş durumu.
- [ ] **Step 4: Firma tablosu** — dashboard-01 `DataTable` yapısı (TanStack): üstte `Tabs` (etiket + `Badge` sayı, `countOrganizationTabs`), sağda "Kolonlar" menüsü; kolonlar Firma (ad + slug, `/platform/organizations/[id]` linki), Paket (plan adı `plans`'tan, yoksa "Paket yok"), Abonelik (`Badge` + `statusLabel`), Firma durumu (yalnızca `active` değilse `Badge`), Kayıt (`formatDate(…, false)`), satır menüsü (Detay). Sayfalama 10 satır. `organizations.length === 200` ise altta "İlk 200 firma gösteriliyor — tamamı için Firmalar sayfası" notu ve linki. Satır sürükleme yok.
- [ ] **Step 5: Alt kartlar** — tablonun altında iki/üç sütunlu `Card`'lar: "Son hareketler" (ilk 6 audit log, mevcut içerik), "Paket dağılımı" (mevcut içerik, ilerleme çubuğu nötr), "Sistem sağlığı" (mevcut üç satır + "Sistem ayrıntılarını aç" `Button variant="outline"`). Sayfa başlığı: "Genel Bakış" + açıklama + "Yenile" (`Button variant="outline"`).
- [ ] **Step 6: Doğrula** — typecheck, lint, test, build. `/platform` 1440/1024/768/375 × koyu/açık ekran görüntüleri; konsolda hata yok; boş veri durumunda grafik boş durumu görünür.
- [ ] **Step 7: Commit** — `feat: rebuild owner overview on shadcn dashboard-01`
- [ ] **Step 8: KULLANICIYA GÖSTER VE DUR** — ekran görüntülerini (koyu + açık, masaüstü + mobil) kullanıcıya gönder; onay veya düzeltme gelmeden Task 7'ye geçme. Düzeltmeler bu taskta yapılır.

### Task 7: Kalan owner sayfalarını shadcn'e taşı

**Files:**
- Create (CLI): `components/shadcn/{alert-dialog,dialog,textarea,switch,alert,sonner,pagination}.tsx`
- Modify: `apps/admin/app/platform/_components/platform-ui.tsx` (aynı dışa aktarım adları, shadcn içerikle), `apps/admin/app/platform/organizations/page.tsx`, `organizations/[id]/page.tsx`, `plans/page.tsx`, `payments/page.tsx`, `logs/page.tsx`, `system/page.tsx`

**Interfaces:**
- Consumes: Task 4 shell; mevcut `platformRequest`, `usePlatformDashboard`, `ConfirmDialog` yerine shadcn `AlertDialog`.
- Produces: `platform-ui.tsx` dışa aktarımları adları ve prop'ları **aynı kalır** (`OwnerPageHeader`, `OwnerMetric`, `OwnerPanel`, `OwnerEmpty`, `OwnerLoading`, `StatusBadge`, `DataTable*`, `formatDate`, `formatMoney`, `statusLabel`) ama `components/ui` yerine `components/shadcn` ile çizilir; `OwnerMetric`'in `tone` prop'u kabul edilir ama renk üretmez (Neutral).

- [ ] **Step 1: `platform-ui.tsx`'i shadcn ile yeniden yaz** — `OwnerPanel` → `Card` (`CardHeader`/`CardTitle`/`CardDescription`/`CardAction`/`CardContent`); `DataTable*` → shadcn `Table*`; `StatusBadge` → `Badge` (`active|succeeded|lifetime` → `secondary`, `suspended|past_due|failed` → `destructive` *outline* görünüm, diğerleri `outline`; anlam metinle de verilir); `OwnerLoading` → `Skeleton`; `OwnerEmpty` → ortalanmış muted metin.
- [ ] **Step 2: Sayfalarda `owner-*` sınıflı ham öğeleri değiştir** — her sayfada `className="owner-button …"` → `Button` (`default` yalnızca sayfanın tek ana eylemi, diğerleri `outline`/`ghost`), `input`/`select`/`textarea` → shadcn karşılıkları + `Label`, `ConfirmDialog` → `AlertDialog` (onay butonu `destructive` yalnızca burada), hata/başarı mesajları `Alert` + `sonner` toast. Sayfa mantığı, API çağrıları ve metinler değişmez.
- [ ] **Step 3: Doğrula** — typecheck, lint, test, build; her owner sayfası 1440 + 375, koyu + açık ekran görüntüsü; firma askıya alma/aktifleştirme, paket ekleme/düzenleme diyalogları elle denenir (yerel DB'de, test firması "B Kiraci …" üzerinde; sonra eski haline getirilir).
- [ ] **Step 4: Commit** — `feat: migrate remaining owner pages to shadcn`
- [ ] **Step 5: KULLANICIYA GÖSTER VE DUR** — ekran görüntüleri; onay gelmeden Task 8'e geçme.

### Task 8: Tasarım belgeleri, temizlik ve son doğrulama

**Files:**
- Modify: `apps/admin/DESIGN.md`, `design-system/operations-portal/MASTER.md`, `apps/admin/app/enterprise-system.css` / `globals.css` (yalnızca artık kullanılmayan `owner-*` / `enterprise-owner-*` kuralları)

- [ ] **Step 1: Belgeler** — `DESIGN.md` ve `MASTER.md`'ye "Yeni yön (v2): shadcn/ui Neutral, Geist, lucide, owner varsayılan koyu; kaynak ui-sources (ui.shadcn.com dashboard-01)" bölümü; eski yön "taşıma süresince v2'ye geçmemiş sayfalar için" diye işaretlenir; MASTER.md'deki "Dark mode by default ❌" maddesi "firma/personel alanı için; owner paneli kullanıcı kararıyla koyu" diye güncellenir.
- [ ] **Step 2: Ölü CSS** — `rg "owner-" apps/admin/app apps/admin/components --glob "*.tsx"` boş dönünce, eski CSS'teki `.owner-*` / `.enterprise-owner-*` kurallarını sil.
- [ ] **Step 3: Tam doğrulama** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build` geçer; `pnpm design:check` çalışır (owner dosyalarındaki bulgular düzeltilir; Neutral/koyu kararıyla çelişen bulgu raporda gerekçesiyle not edilir); Task 1 Step 1'deki eski sayfalar tekrar çekilip karşılaştırılır (görünür bozulma yok); `/api/platform/dashboard` firma yöneticisi oturumuyla 403.
- [ ] **Step 4: Commit** — `docs: record v2 design direction and remove legacy owner css`
