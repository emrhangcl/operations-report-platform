# Operasyon Portalı

Montaj atamalarını, saha operasyonlarını ve kurumsal raporları yöneten çok kiracılı web platformudur. Uygulama tamamen yerelde çalışır: Vercel, Supabase veya başka bir bulut servisine bağımlılığı yoktur. Demo kayıt veya sahte veri oluşturmaz.

## Yapı

```text
apps/admin            Next.js web uygulaması (tanıtım, firma paneli, personel ekranı, platform paneli, API)
apps/admin/lib/server Sunucu katmanı: PostgreSQL bağlantısı, oturum/kimlik, veri geçidi, dosya deposu
apps/mobile           Expo mobil uygulama (opsiyonel; Bearer belirteç ile aynı API'yi kullanır)
packages/data-client  Tarayıcı, mobil ve sunucunun ortak sorgu oluşturucusu
packages/*            Ortak tipler, doğrulama, yardımcılar, ödeme sağlayıcıları
db/migrations         PostgreSQL şeması (0001 temel, 0002 uygulama şeması, sonrakiler değişiklikler)
db/tests              pgTAP veritabanı güvenlik testleri
scripts/local         Yerel PostgreSQL kurulumu ve yönetimi
scripts/db            Migration ve veritabanı test çalıştırıcıları
scripts/backup        Şifreli yedekleme, geri yükleme tatbikatı ve zamanlanmış görev
scripts/storage       Dosya şifreleme ve anahtar değiştirme aracı
scripts/e2e           Çalışan uygulamaya karşı uçtan uca test
```

## Güvenlik katmanları

1. **Ağ:** PostgreSQL yalnızca `127.0.0.1` dinler, tüm bağlantılar scram-sha-256 ister. Uygulama sunucusu (`server.mjs`) istemci adresini soketten belirler; sahte `X-Forwarded-For` başlıkları yok sayılır.
2. **HTTP:** CSP, `X-Frame-Options`, `nosniff` vb. başlıklar; istek boyutu sınırı; veritabanında tutulan, yeniden başlatmada sıfırlanmayan hız sınırları.
3. **Oturum:** Rastgele 256-bit belirteç, veritabanında yalnızca SHA-256 özeti; httpOnly + SameSite=Strict çerez; boşta kalma ve mutlak süre; çıkışta sunucu tarafında iptal; başarısız girişlerde hesap kilidi ve aynı adresten 15 dakikada 20 başarısız girişte IP engeli; güvenlik olay günlüğü (`auth.security_events`).
4. **CSRF:** Çerezli yazma istekleri `X-Auth-Scope` başlığı ve kaynak (Origin) kontrolü gerektirir.
5. **Veri geçidi (`/api/data`):** Şema doğrulaması, tablo/işlem izin listesi, katalogdan doğrulanan tanımlayıcılar, yalnızca parametreli SQL, filtresiz toplu güncelleme/silme yasağı, satır sınırı.
6. **Veritabanı rolleri:** Uygulama `ops_app` ile bağlanır (NOINHERIT, kendi yetkisi yok); her istek `authenticated`/`anon` rolüne geçer, RLS uygulanır. `service_role` yalnızca doğrulanmış sunucu işlemlerinde kullanılır.
7. **RLS ve tetikleyiciler:** Kiracı izolasyonu, abonelik erişim modu, imzalı rapor değişmezliği.
8. **Dosyalar:** Yetki `storage.objects` RLS'i ile; içerik türü dosya imzasıyla doğrulanır; yol geçişi engellenir; indirme kısa ömürlü HMAC imzalı bağlantıyla. Diskte AES-256-GCM ile şifreli tutulur; dosya başka bir yola taşınır veya değiştirilirse açılmaz.
9. **Yedekler:** Veritabanı ve dosyalar her gün ayrı bir anahtarla şifrelenerek yedeklenir; `pnpm backup:verify` yedeği test veritabanına geri yükleyerek doğrular.

Ayrıntılar: `docs/SECURITY.md`.

## Yerel kurulum (Windows)

Gereksinimler: Node.js 22+, pnpm 10 (`npm i -g pnpm@10`), PostgreSQL 18 ikili dosyaları
(`%LOCALAPPDATA%\Programs\PostgreSQL\18` altına açılmış resmi EDB "binaries" zip'i veya `PG_BIN_DIR`).

```bash
pnpm install
pnpm setup:local
pnpm create-admin --platform
pnpm dev:admin
```

`setup:local`; `.env` dosyasını oluşturur (rastgele `AUTH_SECRET`, `STORAGE_ENCRYPTION_KEY` ve `BACKUP_ENCRYPTION_KEY` dahil), PostgreSQL kümesini
`%USERPROFILE%\OperationsPortal\postgres` altında kurup başlatır, rolleri ve iki veritabanını
(`operations_portal`, `operations_portal_test`) oluşturur ve migration'ları uygular. Tekrar çalıştırmak güvenlidir.

Uygulama `http://localhost:3000` adresinde açılır. Platform sahibi `/login` ile girip `/platform` panelinden paket oluşturur ve firmaları etkinleştirir; firmalar `/register` ile kaydolur, personel `/personel` ekranını kullanır.

Veri klasörü (`%USERPROFILE%\OperationsPortal`): `postgres/` veritabanı, `storage/` yüklenen dosyalar (şifreli), `mail-outbox/` e-postalar (yerelde gönderilmez, `.eml` olarak yazılır), `secrets/` PostgreSQL süper kullanıcı parolası, `backups/` şifreli yedekler.

> **Önemli:** `.env` içindeki `STORAGE_ENCRYPTION_KEY` ve `BACKUP_ENCRYPTION_KEY` anahtarlarını bir parola yöneticisine veya çevrimdışı bir yere ayrıca kaydedin. Bu anahtarlar kaybolursa yüklenen dosyalar ve yedekler açılamaz.

## Yedekleme

```bash
pnpm backup              # şifreli yedek alır (veritabanı + dosyalar)
pnpm backup:list         # yedekleri listeler
pnpm backup:verify       # en yeni yedeği test veritabanına geri yükleyip doğrular
pnpm backup:schedule     # her gün 02:00'de otomatik yedek (Windows Görev Zamanlayıcı)
pnpm backup:unschedule
```

Varsayılan olarak son 14 yedek saklanır (`BACKUP_RETENTION`). `BACKUP_COPY_DIR` ile her yedeğin bir kopyası harici diske de alınabilir. Var olan şifresiz dosyaları şifrelemek veya anahtar değiştirdikten sonra yeniden şifrelemek için `pnpm storage:encrypt` (`--rotate`) kullanılır.

## Veritabanı komutları

```bash
pnpm db:status
pnpm db:start
pnpm db:stop
pnpm db:migrate
pnpm db:psql
```

Şema değişiklikleri her zaman `db/migrations` altına yeni numaralı dosya olarak eklenir; uygulanmış migration'lar değiştirilemez (checksum koruması).

Bilgisayar yeniden başladığında veritabanını `pnpm db:start` ile başlatın.

## Testler

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:test
pnpm test:e2e
```

- `pnpm test`: birim testleri (sorgu derleyici, oturum/CSRF, parola, dosya doğrulama, şifreleme, istemci adresi, yedek şifreleme, yetki koruyucuları, paketler).
- `pnpm db:test`: test veritabanını sıfırlar ve pgTAP güvenlik testlerini çalıştırır (kiracı izolasyonu, abonelik erişimi, imzalar, platform yönetimi, hız sınırları).
- `pnpm test:e2e`: çalışan uygulamaya (`pnpm dev:admin`) HTTP üzerinden iş akışlarını ve saldırı senaryolarını dener. `.env` içindeki `E2E_*` test hesaplarını kullanır.

## Mobil uygulama

`apps/mobile/.env` içine `EXPO_PUBLIC_API_URL=http://<bilgisayarın-ağ-adresi>:3000` yazın ve `pnpm dev:mobile` çalıştırın. Oturum belirteci cihazın şifreli anahtar deposunda (expo-secure-store) tutulur.
