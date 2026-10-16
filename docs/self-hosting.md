# OPERASYON PORTALI Self-Hosting Rehberi

Uygulama tamamen kendi altyapinizda calisir: bir Next.js sunucu sureci ve bir PostgreSQL 18 veritabani. Harici BaaS, kimlik dogrulama veya barindirma servisi gerekmez.

## Mimari

```text
Tarayici / mobil -> (HTTPS reverse proxy) -> Next.js (127.0.0.1:3000) -> PostgreSQL 18 (127.0.0.1:5432)
                                                  |
                                                  +-> OPS_DATA_DIR/storage     (yuklenen dosyalar)
                                                  +-> OPS_DATA_DIR/mail-outbox (giden e-postalar)
```

Uygulama veritabanina yalnizca `ops_app` rolu ile baglanir; bu rolun kendi tablo yetkisi yoktur ve her istekte RLS'e tabi `authenticated`/`anon` rolune gecer. Ayrintilar: `docs/DATABASE.md`, `docs/SECURITY.md`.

## Yerel Kurulum (Windows)

Adim adim kurulum `README.md` icindedir. Ozet:

```bash
pnpm install
pnpm setup:local
pnpm create-admin --platform
pnpm dev:admin
```

- PostgreSQL ikili dosyalari: `%LOCALAPPDATA%\Programs\PostgreSQL\18` (resmi EDB "binaries" zip'i; yonetici yetkisi gerekmez).
- Veri: `%USERPROFILE%\OperationsPortal` (`postgres/`, `storage/`, `mail-outbox/`, `secrets/`).
- Sunucu Windows'ta WMI uzerinden, cagiran terminalden bagimsiz baslatilir; terminal kapansa da calismaya devam eder. Bilgisayar yeniden basladiginda `pnpm db:start` ile baslatin.
- PostgreSQL'i Windows servisi olarak kaydetmek isterseniz (otomatik baslatma) yonetici terminalinde: `pg_ctl register -N OperationsPortalPostgres -D "%USERPROFILE%\OperationsPortal\postgres\data"`. Servis, veri klasorune erisebilen bir hesapla calismalidir.

Not: Claude masaustu uygulamasi gibi MSIX paketli uygulamalardan calisan surecler `AppData` altina yeni klasor yazdiginda bu yazim paket ozel alanina sanallastirilabilir. Veri klasorunun kullanici profilinin kokunde tutulmasinin nedeni budur.

## Ortam Degiskenleri

Gercek degerleri Git'e eklemeyin. Tum degiskenler `.env.example` icinde aciklanmistir; yerelde `pnpm setup:local` eksikleri doldurur.

| Degisken | Kullanim |
| --- | --- |
| `APP_URL` | Kanonik adres. `https://` ise oturum cerezleri `Secure` ve `__Host-` onekli olur. |
| `DATABASE_URL` | Calisma zamani baglantisi (`ops_app`). |
| `DATABASE_MIGRATION_URL` | Yalnizca migration (`ops_owner`). Uygulama sunucusuna verilmesi gerekmez. |
| `AUTH_SECRET` | En az 32 karakter; imzali dosya baglantilari. |
| `OPS_DATA_DIR` | Dosya deposu ve giden e-postalar; kalici ve yedekli olmalidir. |
| `AUTH_REQUIRE_EMAIL_VERIFICATION` | Production'da `true` onerilir. |

Hicbir sir `NEXT_PUBLIC_*` ile tarayiciya tasinmaz. Mobil uygulama yalnizca `EXPO_PUBLIC_API_URL` kullanir.

## Linux Sunucuda Calistirma

1. Guncel Ubuntu LTS kurun; guvenlik guncellemelerini uygulayin, SSH parola girisini kapatin, ayri bir deploy kullanicisi olusturun.
2. PostgreSQL 18'i resmi PGDG deposundan kurun. `listen_addresses = '127.0.0.1'` ve `pg_hba.conf` icinde yalnizca loopback + `scram-sha-256` birakin.
3. Rolleri ve veritabanini olusturun (superuser ile). Rol modeli `scripts/local/postgres.mjs` icindeki `bootstrapRoles()` ile aynidir:

   ```sql
   create role ops_owner login password '<owner-parolasi>';
   create role ops_app login noinherit connection limit 40 password '<app-parolasi>';
   create role anon nologin;
   create role authenticated nologin;
   create role service_role nologin bypassrls;
   grant anon, authenticated, service_role to ops_app;
   grant anon, authenticated, service_role to ops_owner with inherit false, set true;
   alter role ops_app set statement_timeout = '30s';
   alter role ops_app set idle_in_transaction_session_timeout = '60s';
   alter role ops_app set lock_timeout = '10s';
   create database operations_portal owner ops_owner;
   ```

   Ardindan `operations_portal` icinde: `revoke all on database operations_portal from public; grant connect, temporary on database operations_portal to ops_app; alter schema public owner to ops_owner; revoke all on schema public from public;`
4. Depoyu sinirli yetkili bir deploy anahtariyla clone edin, `.env` dosyasini sunucuda olusturup yalnizca deploy kullanicisinin okuyabilecegi izinleri verin.
5. `pnpm install --frozen-lockfile` ve `pnpm db:migrate` calistirin.
6. Uygulamayi derleyin ve standalone sunucuyu baslatin:

   ```bash
   NEXT_STANDALONE=true pnpm --filter @operations/admin build
   cd apps/admin
   cp -R public .next/standalone/apps/admin/public
   cp -R .next/static .next/standalone/apps/admin/.next/static
   HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/apps/admin/server.js
   ```

   Sureci bir systemd servisi olarak, ayri ve yetkisiz bir kullaniciyla calistirin.
7. `curl --fail http://127.0.0.1:3000/api/health` ile saglik kontrolu yapin. Beklenen yanit: `{"service":"operations-portal","status":"ok"}`.

## Docker ile Calistirma

`Dockerfile` ve `compose.yaml` yalnizca web uygulamasini calistirir; veritabani compose disindadir. Bu dosyalar mevcut gelistirme makinesinde (Docker kurulu degil) dogrulanmamistir; hedef sunucuda once staging olarak deneyin.

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose ps
```

- Container non-root `nextjs` (UID 1001) ile, read-only kok dosya sistemiyle, tum Linux capability'leri dusurulmus ve `no-new-privileges` acik olarak calisir.
- `app-data` volume'u `/data` olarak baglanir (`OPS_DATA_DIR=/data`): yuklenen dosyalar ve giden e-postalar burada kalicidir.
- PostgreSQL yalnizca `127.0.0.1` dinliyorsa container ona ulasamaz. Ya uygulamayi Docker'siz (yukaridaki standalone yontem) calistirin ya da PostgreSQL'i yalnizca Docker koprusu adresinde dinleyecek ve `pg_hba.conf` icinde yalnizca o alt agi kabul edecek sekilde ayarlayin.

## Domain ve TLS

Gercek kullanici trafigi yalnizca HTTPS ile acilmalidir. `APP_URL` HTTPS adresi olmalidir; boylece cerezler `Secure` olur ve CSP `upgrade-insecure-requests` ekler.

```nginx
server {
    listen 443 ssl;
    server_name rapor.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Hiz siniri istemci adresini `X-Forwarded-For` / `X-Real-IP` basliklarindan okur. Proxy bu basliklari istemciden gelen degerle birlestirmek yerine kendi gordugu adresle ezmelidir (yukaridaki gibi `$remote_addr`). Firewall'da yalnizca SSH, `80/tcp` ve `443/tcp` acik olmalidir; `3000` ve `5432` disariya acilmaz.

## Yedekleme

Otomatik yedekleme isi henuz yoktur. Veritabani ve dosyalar birlikte yedeklenmelidir:

```bash
pg_dump --format=custom --file "$OPS_DATA_DIR/backups/operations-$(date +%F).dump" "$DATABASE_MIGRATION_URL"
tar -czf "$OPS_DATA_DIR/backups/storage-$(date +%F).tgz" -C "$OPS_DATA_DIR" storage
```

Geri yukleme bos bir veritabanina `pg_restore` ve `storage` klasorunun geri acilmasiyla yapilir; duzenli geri yukleme tatbikati yapin.

## Guncelleme Akisi

```bash
git fetch origin
git checkout <onayli-commit-veya-tag>
pnpm install --frozen-lockfile
pnpm db:migrate
NEXT_STANDALONE=true pnpm --filter @operations/admin build
# servisi yeniden baslatin
curl --fail http://127.0.0.1:3000/api/health
```

Migration'dan once yedek alin. Uygulanmis migration dosyalari degistirilemez; calistirici checksum uyusmazliginda durur.

## Geri Donus

1. Calisan surumu commit SHA veya etiketle kaydedin.
2. Saglik veya smoke test basarisizsa onceki commit'e donup yeniden derleyin ve baslatin.
3. Migration'lar geri alinmaz; veri duzeltmesi gerekiyorsa yeni bir ileri migration yazin. Yikici ters islem calistirmayin.

## Operasyon Notlari

- Uygulama JSON log uretir; loglari merkezi bir sisteme veya boyut sinirli log rotasyonuna baglayin. Imzali baglanti, cerez, parola ve belirtecler loglanmaz.
- `auth.security_events` tablosu giris, cikis, kilitlenme ve parola sifirlama olaylarini tutar; izleme icin buradan sorgulanabilir.
- Health endpoint yalnizca uygulama surecini kontrol eder; veritabani ayrintisi vermez.
- Hiz sinirlari ve okuma onbellegi tek surec icindir. Birden fazla instance'a cikildiginda paylasilan bir hiz sinirlayici tasarlanmalidir.
- Production source map'leri kapali tutulur.
