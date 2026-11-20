# Owner paneli yeniden tasarımı (Aşama 1) — Tasarım

Tarih: 2026-11-20 · Durum: onay bekliyor

## Amaç ve neden

Sitenin görünümü tutarsız ve amatör: turuncu her yerde (başlıklar, tablo başlıkları, etiketler), dolu kırmızı "Sil" butonları ekrana hakim, iki farklı font (Space Grotesk + IBM Plex Sans) ve birbirini ezen beş ayrı CSS dosyası (`globals.css` tek başına 204 KB, ayrıca `enterprise-system`, `public-system`, `frosted-system`, `source-landing`). Kullanıcı modern, profesyonel, okunur bir arayüz istiyor; tasarımın **kendi kurduğu kaynaklardan (ui-sources skill: shadcn/ui, 21st.dev, Magic UI, Aceternity…) alınan gerçek örneklere** dayanmasını, kafadan çizilmemesini ve her aşamada kendisine gösterilmesini istiyor. "AI slop" görünümü açık bir başarısızlık kriteri.

Bu belge **yalnızca Aşama 1'i** kapsar: yeni tasarım altyapısı + platform sahibi (owner) paneli. Firma paneli (`/app` ve alt sayfaları), personel ekranı ve tanıtım sitesi ayrı aşamalar olarak sonra, aynı yöntemle (kaynaktan gerçek örnek → kullanıcı seçimi → tasarım belgesi) ele alınacak.

## Hedefler

- Owner paneli (`/platform` ve alt sayfaları) shadcn/ui `dashboard-01` bloğunu temel alır.
- Görsel dil: shadcn **Neutral** renk teması (siyah-beyaz-gri, renkli vurgu yok; turuncu yalnızca logoda), **Geist** fontu, **lucide** simgeleri.
- Owner paneli varsayılan **koyu** açılır; sağ üstte açık/koyu geçiş düğmesi vardır, tercih tarayıcıda hatırlanır.
- Tüm sayılar, grafik ve tablo veritabanındaki gerçek veriden gelir; veri yoksa açık boş durum gösterilir.
- Tailwind v4 + shadcn altyapısı, sonraki aşamalarda sayfa sayfa taşıma yapılabilecek şekilde kurulur.

## Hedef dışı (bu aşamada yok)

- Firma paneli, personel ekranı, tanıtım/landing, giriş/kayıt sayfaları — görünümleri **değişmez ve bozulmamalıdır**.
- Eski CSS dosyalarının silinmesi (taşıma bitene kadar yerinde kalır; owner sayfalarına ait kurallar Aşama 1 sonunda temizlenebilir).
- Yeni iş özelliği, yetki modeli değişikliği, veritabanı şeması değişikliği.
- Mobil (Expo) uygulama.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Kaynaklarda karşılığı olmayan, kafadan uydurulmuş bileşen/görünüm.
- Sahte/örnek veri (dashboard-01'in örnek `data.json`'u, "Acme Inc.", uydurma trendler) ekranda kalması.
- Renkli vurgu, gradyan, cam efekti, gereksiz animasyon.
- Taşınmamış sayfalarda görsel bozulma.
- Güvenliğin zayıflaması: CSP, yetki kontrolü, kiracı izolasyonu, RLS.

## Kısıtlar

- Next.js 15.5 App Router, React 19, pnpm workspace. Proje şu an Tailwind kullanmıyor.
- CSP (`apps/admin/next.config.mjs`): `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`, `connect-src 'self'`. Dış CDN'den font/script yüklenemez → font `next/font` ile kendi sunucumuzdan sunulmalı.
- Owner verisi yalnızca `requirePlatformAdmin` korumalı API'lerden gelir; yeni veri de aynı korumayla ve sunucu tarafında eklenir.
- Mevcut owner sayfaları: `platform/page.tsx` (genel bakış), `organizations`, `organizations/[id]`, `plans`, `payments`, `logs`, `system`; ortak bileşenler `platform/_components/*` (shell, ui, client, types).
- Kök `layout.tsx` beş eski CSS dosyasını ve iki Google fontunu global yüklüyor; `RouteShell` firma rotalarını `AdminShell` ile sarıyor (owner rotaları kendi `PlatformShell`'ini kullanıyor).

## Değerlendirilen yaklaşımlar

1. **Tailwind v4 + shadcn/ui'ye kademeli geçiş — SEÇİLDİ.** Kaynaklardaki bileşenler birebir kullanılabilir; sayfa sayfa taşınır, eski CSS taşınan kısımlarla birlikte azalır. Bedeli: yeni bağımlılıklar ve geçiş süresince eski/yeni stilin bir arada yaşaması.
2. **Düz CSS'te kalıp shadcn görünümünü elle yazmak.** Bağımlılık yok ama bileşenler yeniden yazılır; yavaş ve "kafadan yazma" riskini artırır — kullanıcının istemediği şey.
3. **Tailwind'siz Radix/Base UI.** Görünüm yine elle yazılır; 2'nin maliyeti, 1'in yarı faydası. Elendi.

Kullanıcı 1'i seçti.

## Kullanıcının verdiği kararlar

| Konu | Karar | Dayanak |
|---|---|---|
| Altyapı | Tailwind v4 + shadcn/ui | yaklaşım 1 |
| Owner dashboard şablonu | shadcn/ui `dashboard-01` | ui.shadcn.com/blocks; 4 gerçek şablon arasından seçildi |
| Renk teması | Neutral | ui.shadcn.com/examples/dashboard renk seçicisi |
| Owner varsayılan mod | Koyu (geçiş düğmesiyle açık) | panel yalnızca platform sahibi tarafından kullanılıyor |
| Font / simge / içerik önerileri | Kabul edildi ("önerilerini yap") | aşağıdaki tasarım |

## Tasarım

### Altyapı

- `apps/admin`'e Tailwind v4 (`@tailwindcss/postcss`) ve shadcn/ui kurulur (`components.json`, Neutral tema token'ları, açık + koyu set).
- **Bileşen yolu çakışması:** `apps/admin/components/ui/` klasörü zaten var (`button`, `data-table`, `dropdown`, `utils.ts` içinde `cn()` …) ve ~15 eski sayfa bunu kullanıyor. shadcn CLI'nin varsayılan yolu bunların üzerine yazar. Bu yüzden `components.json` alias'ları shadcn bileşenlerini **`components/shadcn/`** altına, yardımcıyı ayrı bir dosyaya yönlendirir; eski `components/ui/` dokunulmadan kalır ve sayfalar taşındıkça boşalır. *(uygulayıcı kararı)*
- **Değişken adı çakışması:** `app/theme-tokens.css` `:root`'ta shadcn ile aynı adlı değişkenler tanımlıyor (`--background`, `--primary`, `--border` …). shadcn token'ları owner kökünde (`[data-ui="v2"]` + `.dark`) tanımlanır, böylece eski `:root` değerleri eski sayfalarda aynen kalır; portal açan bileşenler (Dialog, Select, Sonner, DropdownMenu) portal kapsayıcısı aynı öznitelikle işaretlenerek tema alır. *(uygulayıcı kararı)*
- **CSS katman sırası:** `@layer theme, base, legacy, components, utilities;` Eski CSS dosyaları (`theme-tokens` dahil altı dosya) `legacy` katmanına alınır (`@import "./globals.css" layer(legacy)` vb.). Böylece eski sayfalarda eski kurallar Tailwind preflight'ını ezer, yeni sayfalarda Tailwind utility'leri eski kuralları ezer. Eski CSS'teki ~34 element seçicisinin (`h1`, `table`, `button`, `a`, `body`…) owner sayfalarına sızıp sızmadığı görsel olarak kontrol edilir; sızan özellikler owner kökünde sıfırlanır. Katmansız kalan CSS modülleri (ör. `customer-signature.module.css`) önce/sonra karşılaştırmasında ayrıca kontrol edilir.
- **Eski sayfalarda kabul ölçütü:** piksel düzeyinde eşitlik değil, **görünür bozulma olmaması**. Preflight'ın eski CSS'in tanımlamadığı özelliklerde yol açtığı küçük farklar (ör. liste boşluğu, img display) kabul edilir; düzen kayması, okunmaz metin, kaybolan kenarlık gibi görünür bozulmalar düzeltilir. Bu sayfalar zaten sonraki aşamalarda yeniden tasarlanacak. *(uygulayıcı kararı)*
- **Font:** Geist, `next/font/google` ile (derlemede indirilip kendi sunucumuzdan sunulur, CSP uyumlu). Owner alanında `font-sans` Geist; eski fontlar eski sayfalarda kalır.
- **Tema:** owner alanı kendi kökünde `dark` sınıfıyla açılır; geçiş düğmesi tercihi `localStorage`'da tutar ve sayfa yüklenmeden önce uygulanır (yanıp sönme olmasın). Bu tercih yalnızca owner alanını etkiler; firma paneli bu aşamada değişmez.

### Owner iskeleti (tüm `/platform/*` sayfaları)

dashboard-01'in `AppSidebar` (variant `inset`) + `SiteHeader` düzeni:

- **Sol menü:** logo + "Operasyon Portalı"; menü öğeleri mevcut sayfalarla birebir: Genel Bakış, Firmalar, Paketler ve Fiyatlar, Ödemeler, Sistem Kayıtları, Sistem Durumu. Altta: "Firma paneline git" (`/app`), kullanıcı bloğu (ad, e-posta, menüsünde Çıkış). Menü simgelere daralabilir (shadcn sidebar davranışı), mobilde çekmece olur.
- **Üst başlık:** menü daraltma düğmesi, sayfa başlığı, sağda açık/koyu geçiş düğmesi.
- Dashboard-01'deki örnek öğeler (Quick Create, Lifecycle, Data Library, GitHub linki vb.) **kaldırılır**; yalnızca gerçek sayfalar yer alır.

### Genel Bakış (`/platform`)

dashboard-01 bölümleri, gerçek veriyle:

1. **KPI kartları (SectionCards), sırayla:** Aylık düzenli gelir (`mrr_minor`), Toplam tahsilat (`successful_collected_minor`), Kayıtlı firma (`total_organizations`, alt satır: son 30 günde `new_organizations_30d`), Aktif kullanıcı (`active_users`). Trend rozeti yalnızca gerçekten hesaplanabiliyorsa gösterilir (önceki döneme göre); hesaplanamıyorsa rozet yoktur — uydurma yüzde yok.
2. **Grafik:** iki seri farklı birimde (para ve adet), aynı eksende çizilemez. Kaynaktaki karşılığı kullanılır: shadcn charts'taki **"Bar Chart – Interactive"** örneğinin seri değiştirme düğmeleri (başlıkta iki kutu: "Tahsilat ₺…" / "Yeni firma …", tıklanan seri gösterilir, kutuda dönem toplamı yazar) + dashboard-01'deki **3 ay / 30 gün / 7 gün** aralık seçici. Görsel tip dashboard-01 gibi alan grafiği. Neutral temanın gri tonları. *(uygulayıcı kararı; ilk ekran görüntüsünde kullanıcıya gösterilir)*
3. **Tablo (DataTable):** firmalar; kolonlar Firma (ad + slug), Paket, Abonelik durumu (rozet), Firma durumu (yalnızca aktif değilse rozet), Kayıt tarihi, satır menüsü (Detay → `/platform/organizations/[id]`). Kolon göster/gizle ve sayfalama dashboard-01'deki gibi. dashboard-01'in satır sürükleme özelliği **alınmaz**. *(sekme kuralları uygulayıcı kararı)*
   - **Sekmeler ve süzme alanı:** Tümü · Aktif (abonelik `active` veya `lifetime`, firma `active`) · Ek sürede (abonelik `grace_period`) · Salt okunur (abonelik `read_only`) · Askıda (firma durumu `suspended`, abonelik durumuna bakılmaz). Askıya alınmış firma yalnızca "Askıda"da görünür, abonelik sekmelerinde görünmez. Diğer durumlar (`past_due`, `pending`, `canceled`, firma `closed`) yalnızca "Tümü"de görünür.
   - **Sayılar:** sekme rozetleri istemcideki listeden hesaplanır. API bugün en fazla 200 firma döndürüyor; 200'e ulaşılırsa tablonun altında "İlk 200 firma gösteriliyor, tamamı için Firmalar sayfası" notu çıkar. Sunucu taraflı sayfalama bu aşamada yok (bugün 5 firma var).
4. Mevcut ekrandaki "Son hareketler", "Sistem sağlığı", "Paket dağılımı" bilgileri kaybolmaz: tablonun altında shadcn kartları olarak kalır (içerik aynı, görünüm yeni).

### Grafik için veri

Mevcut `/api/platform/dashboard` zaman serisi döndürmüyor. Aynı route'a (aynı `requirePlatformAdmin` + rate limit) son 90 güne ait günlük seri eklenir: `{ date, collectedMinor, newOrganizations }[]`. Kaynak: başarılı ödemeler (`payments`) ve `organizations.created_at`. Toplama sunucuda yapılır; istemciye yalnızca günlük toplamlar gider. Şema değişikliği yok; gerekirse sorgu `service` istemcisiyle mevcut tablolardan yapılır. Veri yoksa grafik alanında "Henüz tahsilat veya yeni kayıt yok" boş durumu.

### Diğer owner sayfaları

Firmalar, Firma detayı, Paketler, Ödemeler, Sistem Kayıtları, Sistem Durumu: içerik ve davranış aynı kalır; görünüm shadcn bileşenleriyle (Card, Table, Badge, Button, Input, Select, Dialog, Tabs, Sonner toast) yeniden kurulur. Silme/askıya alma gibi yıkıcı işlemler satırda **ghost** buton/menü öğesi, dolu kırmızı yalnızca onay diyaloğunda.

### Proje tasarım kuralları (DESIGN.md / Impeccable) ile uzlaşma

`apps/admin/DESIGN.md`, `design-system/operations-portal/MASTER.md` ve `theme-tokens.css` bugün "kehribar tek vurgu, Space Grotesk + IBM Plex" yönünü tanımlıyor; bu tasarım kullanıcının açık kararıyla o yönü değiştiriyor. Bu aşamada:
- `DESIGN.md` ve `MASTER.md`'ye yeni yön (shadcn Neutral, Geist, lucide, owner varsayılan koyu, kaynak: ui-sources) eklenir; eski yön "taşıma süresince eski sayfalar için geçerli" diye işaretlenir. Çelişen iki kural bir arada "geçerli" bırakılmaz.
- Impeccable detector (`pnpm design:check`) doğrulamada çalıştırılır; owner dosyalarında çıkan bulgular düzeltilir. Yeni yönle doğrudan çelişen bir kural çıkarsa (ör. vurgu rengi zorunluluğu) bulgu raporda gerekçesiyle belirtilir, kullanıcı kararı uygulanır. *(uygulayıcı kararı)*

### Gösterim sırası (kullanıcıya)

1. Altyapı + owner iskeleti + Genel Bakış → gerçek ekran görüntüsü (koyu ve açık) kullanıcıya gösterilir, onay alınır.
2. Kalan owner sayfaları → ekran görüntüleri, onay.

## Doğrulama

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` geçer.
- Owner sayfaları 1440 / 1024 / 768 / 375 px genişlikte koyu ve açık modda ekran görüntüsüyle kontrol; tarayıcı konsolunda CSP veya hydration hatası yok.
- Taşınmamış sayfalar (landing `/`, `/login`, `/app`, `/reports`, `/personel`, rapor imza ekranı) önce/sonra ekran görüntüsüyle karşılaştırılır; görünür bozulma olmamalı (ölçüt yukarıda).
- `pnpm design:check` çalıştırılır.
- Yeni API alanı için: platform yöneticisi olmayan oturumla 403, kiracılar arası veri sızmadığı (yalnızca toplamlar).
- Metin kontrastı WCAG AA (4.5:1) — Neutral tema varsayılanları bunu sağlar; özel değişiklik yapılırsa ölçülür.

## Uygulayıcıya bırakılanlar

- shadcn bileşenlerinin tam listesi ve sürümleri (sayfa ne gerektiriyorsa).
- Grafik kütüphanesi: shadcn chart'ın kullandığı Recharts; tablo: shadcn data-table'ın kullandığı TanStack Table.
- Trend rozeti için "önceki dönem" hesabının mümkün olup olmadığı (değilse rozet gösterilmez).
