# Mevcut Sistem Baseline

Bu belge, SaaS donusumu baslamadan once calisan sistemin geri donus ve regresyon referansidir.

## Baseline Kimligi

| Alan | Deger |
| --- | --- |
| Tarih | 2026-08-29 (Europe/Istanbul) |
| Kaynak depo | `https://github.com/emrhangcl/operations-report-platform.git` |
| Baseline commit | `cdc51f1d3543399489558f73e8222abb9d61ab1d` |
| Geri donus etiketi | `baseline/pre-saas-20260829` |
| Gelistirme branch'i | `feat/saas-platform` |
| Baseline branch senkronu | `main` ve `origin/main` arasinda fark yok (`0/0`) |
| Calisma agaci | Temiz |

GitHub'in kimlik dogrulamasiz repository API'si depoya `404` dondurdu. Uzak Git erisimi ise mevcut yerel kimlik bilgileriyle calisiyor. Bu nedenle depo baseline tarihinde private olarak degerlendirildi; gorunurluk degistirilmedi. Private depo erisiminin Vercel tarafindaki durumu bu asamada degistirilmedi veya yeniden yapilandirilmadi.

## Guvenli Calisma Sinirlari

- Production Vercel projesinde degisiklik yapilmadi.
- Production Supabase projesine migration uygulanmadi ve veri yazilmadi.
- Tarayici testi yerel Next.js sunucusunda kimliksiz olarak yapildi.
- Yerel `.env` production Supabase adresini isaret ettigi icin gercek hesapla giris yapilmadi; kimliksiz sorgular RLS/izin katmaninda `401` ile reddedildi.
- Seed, demo, sahte firma, personel, rapor, fotograf veya odeme kaydi olusturulmadi.
- `.env` icerigi, tokenlar ve anahtarlar okunabilir rapora veya terminal ciktisina alinmadi.

## Teknoloji ve Calisma Zamani

| Bilesen | Baseline |
| --- | --- |
| Monorepo | pnpm workspaces |
| Node.js | `v24.18.0` |
| pnpm | `11.22.0` |
| Web | Next.js App Router `15.5.23`, React `19.2.8` |
| Mobil | Expo SDK `54.0.37`, React Native `0.81.5` |
| Veritabani/Auth/Storage | Supabase |
| Dogrulama | Zod |
| Excel | ExcelJS |
| PDF | pdfmake |
| Analitik | Vercel Analytics ve Speed Insights |

Supabase changelog kontrolunde ilerideki calismayi etkileyen iki guncel konu kaydedildi:

- Supabase JS ailesi 2026-06-30 sonrasinda Node.js 20 destegini birakiyor; self-host ortami Node.js 22 veya daha yeni kullanmali.
- Yeni `public` tablolari Data API'ye otomatik acilmiyor. Yeni SaaS tablolarinda RLS'ye ek olarak acik `GRANT`/Data API erisimi bilincli tanimlanmali.

## Monorepo Yapisi

| Yol | Sorumluluk |
| --- | --- |
| `apps/admin` | Admin paneli ve personel mobil web/PWA arayuzu |
| `apps/mobile` | Opsiyonel Expo Go mobil istemci |
| `packages/types` | Ortak TypeScript veri tipleri |
| `packages/validation` | Form ve islem Zod semalari |
| `packages/shared` | Yetki, rapor numarasi ve Excel yardimcilari |
| `supabase/migrations` | Veritabani, trigger, RLS ve Storage politikalari |
| `scripts/create-admin.ts` | Ilk admin hesabini server-side service role ile olusturma |

## Web Sayfalari

| Route | Erisim | Mevcut davranis |
| --- | --- | --- |
| `/login` | Herkes | Admin e-posta/sifre girisi |
| `/` | Aktif admin | Gercek kayitlardan toplam rapor, aylik rapor, taslak, aktif montaj, aktif personel, firma, hat ve arac sayilari |
| `/assignments` | Aktif admin | Montaj atama, guncelleme, iptal/tamamlama ve silme; personel, firma, coklu yetkili, coklu hat/bant/urun kalemi, arac, urun, islem ve faturalandirma on bilgileri |
| `/reports` | Aktif admin | Rapor listeleme; tarih, rapor no, firma, personel, bant ve durum filtreleri; secim; tekli/toplu silme; Excel aktarimi |
| `/reports/[id]` | Aktif admin | Salt okunur rapor detayi, ozet kartlari, bolumsel bilgiler, fotograf galerisi/lightbox, PDF indirme/paylasma ve rapor silme |
| `/personnel` | Aktif admin | Personel veya admin hesabi olusturma, profil guncelleme, parola sifirlama baglantisi uretme ve kullanici silme |
| `/companies` | Aktif admin | Firma ekleme, duzenleme ve silme |
| `/lines` | Aktif admin | Firmaya bagli hat ekleme, duzenleme ve silme |
| `/vehicles` | Aktif admin | Plaka ekleme, duzenleme ve silme |
| `/belts` | Aktif admin | Zorunlu bant kodu, opsiyonel ad/aciklama ile bant ekleme, duzenleme ve silme |
| `/personel` | Aktif personel | Personel girisi, ana ekran, yeni rapor, montajlarim, taslaklarim, gonderdigim raporlar ve salt okunur rapor detayi |
| `/manifest.webmanifest` | Herkes | `/personel` baslangicli PWA manifesti |

Admin sayfalari `AdminShell` icinde istemci tarafinda `auth.getUser()` ve `profiles.role/is_active` kontrolu yapar. Kimliksiz kullanici `/login` sayfasina yonlendirilir. Personel ve admin oturumlari ayni tarayicida birbirini dusurmemesi icin farkli local storage anahtarlari kullanir:

- Admin: `operations-admin-auth`
- Personel: `operations-personnel-auth`

## API Endpoint'leri

| Metot ve route | Yetki | Islev |
| --- | --- | --- |
| `DELETE /api/admin/belts/[id]` | Aktif admin | Bant siler ve audit log yazar |
| `DELETE /api/admin/companies/[id]` | Aktif admin | Raporlardaki firma bagini `null` yapar, firmayi siler ve audit log yazar |
| `DELETE /api/admin/personnel/[id]` | Aktif admin | Auth kullanicisini ve profilini siler; kendi hesabini silmeyi reddeder; rapor snapshot gecmisini korur |
| `POST /api/admin/personnel/create-account` | Aktif admin | Supabase Auth kullanicisi ve profil olusturur; `ADMIN` veya `PERSONNEL` rolu verir |
| `POST /api/admin/personnel/reset-password` | Aktif admin | Recovery action link uretir ve audit log yazar |
| `DELETE /api/admin/reports/[id]` | Aktif admin | Storage fotograflarini ve raporu siler, audit log yazar |
| `GET /api/admin/reports/export` | Aktif admin | Filtre veya ID listesine gore en fazla 5000 raporu XLSX olarak uretir |
| `GET /api/reports/[id]/pdf` | Aktif admin veya rapor sahibi aktif personel | Yetkili raporu tek sayfaya sigmayi hedefleyen A4 yatay PDF olarak uretir |

Server endpoint'leri Bearer access token'i Supabase Auth `getUser()` ile dogrular. Admin endpoint'leri daha sonra service role ile `profiles.role = ADMIN` ve `is_active = true` kontrolu yapar. `SUPABASE_SERVICE_ROLE_KEY` yalnizca server modulunde ve admin olusturma scriptinde kullanilir; `NEXT_PUBLIC_` degiskeni degildir.

Kimliksiz API baseline testi: sekiz endpoint'in tamami `403 {"message":"Oturum bulunamadi."}` ile reddedildi.

## Roller ve Yetki Modeli

### ADMIN

- Tum aktif yonetim sayfalarina erisir.
- Firma, hat, arac, bant, kullanici ve montaj atamalarini yonetir.
- Tum raporlari gorur, Excel/PDF alir ve rapor silebilir.
- Hassas Auth islemleri server endpoint'lerinden yapilir.

### PERSONNEL

- Yalnizca aktif profil ise personel web/mobil arayuzunu kullanir.
- Kendi taslak ve gonderilmis raporlarini gorur.
- Kendi taslagini gunceller; gonderilmis rapor salt okunurdur.
- Kendisine atanan montaji gorur, `ASSIGNED -> IN_PROGRESS -> COMPLETED` akisini ilerletebilir.
- Montaj plan bilgisini degistiremez.
- Kendi raporuna personel/fotograf ekleyebilir ve kendi PDF'ini alabilir.

## Personel Rapor Akisi

Personel ana ekraninda su akislari bulunur:

- Yeni Rapor
- Montajlarim
- Taslaklarim
- Gonderdigim Raporlar
- Salt okunur rapor detayi
- PDF indir ve desteklenen cihazlarda paylas

Rapor formu sekiz acilir bolumden olusur:

1. Genel bilgiler: rapor tarihi, firma, birden fazla yetkili, firmaya bagli coklu hat/bant kalemi, bant kodlari, makina marka/model, formu dolduran, arac alis/teslim KM, giden personel, plaka ve ekipman.
2. Zaman bilgileri: atolyeden cikis, musteriye varis, musteriden cikis ve fabrikaya donus tarih/saatleri.
3. Urun bilgileri: her is kalemi icin en, boy ve miktar; item/coil kodu; urun turleri.
4. Yapilan islemler: islem turleri, kenar kesim yontemi, mekanik baglanti, profil, eski bant suresi ve degistirme sebepleri.
5. Test ve pres: test parcasi, test durumu, gozlemci, pres saatleri, enerji/basinc/isi kontrolleri.
6. Teknik detaylar: islem aciklamasi, faturalandirma ve teknik detay.
7. Gerdirme ve blanket: gerdirme, basinc, on gerdirme, calisir teslim ve bilgilendirme.
8. Fotograflar: kamera veya galeriden coklu secim, aciklama ve secilen fotografi kaldirma.

Rapor `client_request_id` uzerinden upsert edilir. DB trigger'i raporu olusturan kullaniciyi oturumdan belirler, snapshot alanlarini doldurur ve `SUBMITTED` durumunda transaction-safe sayacla `RPR-YYYY-000001` biciminde rapor numarasi uretir.

Montaj atamasindan rapor acildiginda adminin girdigi on bilgiler forma tasinir. Personel raporu gonderince atama rapora baglanir ve `COMPLETED` durumuna gecirilir.

## Fotograf Yukleme ve Goruntuleme

- Web personel arayuzu `image/*` kabul eder; kamera veya galeriyi ayri secenek olarak acar.
- Web yukleme yolu: `<report_id>/<random_local_id>.<extension>`.
- Expo istemci kamera/galeri izni ister, goruntu kalitesini `0.7` ile alir ve ayni rapor klasoru yapisini kullanir.
- Metadata `report_photos` tablosunda, dosya private `report-photos` bucket'inda tutulur.
- Admin ve personel detay ekranlari 30 dakikalik signed URL olusturur.
- Admin rapor detayinda kucuk galeri ve tiklanabilir lightbox vardir.
- Bucket sinirlari: private, azami 5 MB, sadece JPEG/PNG/WebP.
- Storage RLS, dosya yolu ile `reports` ve `report_photos` kaydini eslestirerek yalnizca admin veya rapor sahibine erisim verir.

## Excel ve PDF

### Excel

- Filtre sonucunu veya secilen raporlari aktarir.
- `Raporlar` sayfasinda 48 kolon bulunur.
- Ikinci `Fotograflar` sayfasinda rapor no, kategori, aciklama ve private storage yolu yer alir.
- Tarih/saat kolonlari Excel tarih formatiyla yazilir.
- Endpoint server-side admin yetkisi gerektirir.

### PDF

- A4 yatay ve kompakt rapor dokumani uretir.
- Logo, genel bilgiler, arac/zaman, hat/ekipman, islem/teknik, urun kalemleri, pres/kontrol, gerdirme/teslim, notlar ve iki imza alani bulunur.
- Fotograflar PDF'e gomulmez.
- Dis URL ve yerel dosya erisimi pdfmake seviyesinde kisitlanmistir; sadece paket fontlari yerel olarak okunur.
- Admin veya rapor sahibi aktif personel indirebilir/paylasabilir.

## Expo Mobil Istemci

Expo uygulamasi web personel akisi disinda su yerel ozellikleri tasir:

- `AsyncStorage` ile cihaz taslaklari.
- `NetInfo` ile cevrimici/cevrimdisi durum.
- `DEVICE_SAVED`, `WAITING_SYNC`, `SYNCED`, `SYNC_ERROR` durumlari.
- Baglanti yokken bekleyen taslak kaydi ve daha sonra senkronizasyon.
- Kamera veya galeriden fotograf secimi.
- Gonderilmis rapor listesi ve salt okunur rapor detayi.

Expo istemci opsiyoneldir; yayinlanan web uygulamasi `/personel` PWA akisini da sunar.

## Supabase Veri Modeli

| Tablo | Amac |
| --- | --- |
| `profiles` | Auth kullanicisina bagli ad, iletisim, rol ve aktiflik |
| `companies` | Musteri firmalari ve varsayilan yetkili bilgileri |
| `company_lines` | Firmaya bagli ve firma icinde benzersiz hat adlari |
| `vehicles` | Benzersiz arac plakalari |
| `belts` | Zorunlu kod, opsiyonel ad/aciklama ve aktiflik |
| `reports` | Rapor ana kaydi, snapshot'lar, zaman/urun/islem/teknik alanlar ve JSONB `work_items` |
| `report_personnel` | Rapora katilan personelin snapshot isimleri |
| `report_process_types` | Rapor urun/islem tipi iliski kayitlari (legacy/uyumluluk) |
| `report_process_actions` | Rapor islem iliski kayitlari (legacy/uyumluluk) |
| `report_photos` | Private Storage dosya metadatasi |
| `installation_assignments` | Admin tarafindan personele verilen montaj atamalari ve on doldurulmus JSONB rapor degerleri |
| `report_number_counters` | Yil bazli transaction-safe rapor sayaci; client erisimi yok |
| `audit_logs` | Admin/teknik degisiklik kayitlari |

`reports.customer_stock_note` veritabaninda legacy kolon olarak bulunur ancak mevcut form tipinde ve arayuzde kullanilmaz.

Personel silindiginde `reports.created_by_user_id`, `report_photos.created_by` ve `installation_assignments.assigned_to_profile_id` `SET NULL` olur; rapor ve snapshot gecmisi korunur.

## RLS ve Ayricalikli Fonksiyonlar

Tum Data API tablolari RLS kullanir. En son politika setinin ozeti:

| Kaynak | SELECT | INSERT/UPDATE/DELETE |
| --- | --- | --- |
| `profiles` | Kendi profilin, admin veya aktif profiller | Admin |
| `companies`, `belts` | Admin veya aktif personel icin aktif kayitlar | Admin |
| `company_lines`, `vehicles` | Admin veya aktif personel | Admin |
| `reports` | Admin veya kaydi olusturan | Aktif profil insert; admin veya sahibin taslagi update |
| Rapor alt tablolari | Ust rapora admin/sahip erisimi | Admin veya rapor sahibi |
| `installation_assignments` | Admin veya atanmis aktif personel | Admin; atanmis personel yalniz izinli durum gecisleri |
| `audit_logs` | Admin | Authenticated insert; trigger/API tarafindan kullanilir |
| `report_number_counters` | Client politikasi yok | Client yetkisi yok, service role/trigger |

Yetki yardimcilari `private` schema'dadir:

- `private.current_user_role()`
- `private.is_admin()`
- `private.is_active_profile()`

Bu fonksiyonlar `SECURITY DEFINER` olarak calisir, `PUBLIC` ve `anon` execute yetkileri kaldirilmistir. Trigger fonksiyonlarinin da dogrudan client execute yetkileri yoktur.

## Baseline Test Sonuclari

| Test | Sonuc | Kanit/Ozet |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | PASS | 6 workspace, lockfile degismedi |
| Lint | PASS | Admin ESLint, sifir warning |
| Unit test | PASS | 4 dosya, 8 test: izinler, rapor numarasi, Excel ve validation |
| Production build | PASS | Next.js 17 route uretildi; Expo typecheck build komutunda gecti |
| Root typecheck | PASS | types/shared/validation/admin/mobile temiz |
| Yerel Next.js calisma | PASS | `http://127.0.0.1:3000` hazir |
| Admin korunan route yonlendirmesi | PASS | 8 admin route kimliksiz erisimde `/login` sayfasina gitti |
| Personel giris sayfasi | PASS | Masaustu ve 390x844 mobil viewport'ta form tasmasiz gorundu |
| Kimliksiz API korumasi | PASS | 8 hassas endpoint `403` dondurdu |
| Guvenlik basliklari | PASS | CSP, `DENY`, `nosniff`, referrer ve permissions policy mevcut |
| Authenticated admin E2E | NOT RUN | Production verisine dokunmama kurali; ayrik local/staging Supabase ve test hesabi yok |
| Authenticated personel E2E | NOT RUN | Production verisine dokunmama kurali; ayrik local/staging Supabase ve test hesabi yok |
| Fotograf upload E2E | NOT RUN | Gecici test Storage/veritabani yok |
| Excel/PDF gercek rapor E2E | NOT RUN | Gecici test veritabani ve rapor yok |

## Tarayici Baseline Bulgulari

Basarili davranislar:

- Admin korunan sayfalari kimliksiz kullaniciyi girise yonlendiriyor.
- Personel giris ekrani responsive gorunuyor.
- Tum hassas API endpoint'leri kimliksiz istekleri reddediyor.
- Guvenlik basliklari yerel response'larda mevcut.

Mevcut kusurlar ve regresyon referanslari:

1. `favicon.ico` istegi `404` donuyor.
2. Admin sayfalari istemci auth yonlendirmesi tamamlanmadan kendi Supabase sorgularini baslatabiliyor; kimliksiz durumda tarayici konsolunda `401` istekleri goruluyor. Veri donmuyor.
3. CSP `connect-src` icinde Vercel olcum alanlarini barindiriyor ancak `script-src` icinde `https://va.vercel-scripts.com` yok. Bu nedenle Analytics ve Speed Insights scriptleri yerelde CSP tarafindan engelleniyor.
4. Ozel `error.tsx`, `global-error.tsx`, `not-found.tsx`, 403, 429 ve bakim sayfalari henuz yok.
5. Otomatik browser E2E/integration test paketi yok; mevcut otomatik testler paylasilan paketlerle sinirli.
6. Next.js `standalone` output, Dockerfile, container health-check ve self-host deployment dokumani henuz yok.
7. `@vercel/analytics` ve `@vercel/speed-insights` Vercel'e ozel iki runtime eklentidir. Ana uygulama verisi ve auth Supabase uzerindedir.

## Regresyon Kontrol Listesi

SaaS donusumu sonrasinda en az su davranislar bu baseline ile tekrar karsilastirilmalidir:

- Admin ve personel oturumlari birbirinden bagimsiz kalmali.
- Admin panel route ve API'leri normal personele acilmamali.
- Firma, hat, arac, bant ve kullanici CRUD davranisi korunmali.
- Coklu hat/bant/urun kalemi atama ve rapor akisi korunmali.
- Montaj atamasi personelde gorunmeli ve rapora donusebilmeli.
- Taslak rapor duzenlenebilmeli; gonderilmis rapor salt okunur kalmali.
- Rapor numarasi benzersiz ve yil bazli uretilmeli.
- Fotograf bucket'i private kalmali ve rapor sahipligi disina sizmamalidir.
- Excel filtre/secim aktarimi ve PDF indirme/paylasma calismali.
- Personel silme rapor gecmisini silmemeli.
- Bos ekranlar demo veri yerine profesyonel bos durum gostermeli.

## Baseline Sonucu

Kaynak kod, unit testler, production build, typecheck, kimliksiz browser akislari ve API korumalari baseline olarak kayda alindi. Tam girisli islevsel E2E kaniti production'a dokunmama kurali nedeniyle ayrik local/staging Supabase kurulmadan tamamlanamaz. Sonraki asamalarda gecici test veritabani olusturulup test verisi sonunda temizlenerek bu bosluk kapatilmalidir.
