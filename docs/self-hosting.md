# OPERASYON PORTALI Self-Hosting Rehberi

Bu rehber Next.js uygulamasini Vercel'i kapatmadan, tek bir Linux sunucuda Docker ile paralel olarak calistirmak icindir. Production Vercel yayini yeni kurulum dogrulanana kadar degistirilmemelidir.

## Mimari

Ilk self-host kurulumu tek uygulama instance'i icin tasarlanmistir:

```text
Internet -> HTTPS reverse proxy -> 127.0.0.1:3000 -> OPERASYON PORTALI Docker container -> Supabase
```

Supabase bu asamada yonetilen dis servis olarak kalir. Next.js container'i Auth, Database ve private Storage'a HTTPS ile baglanir.

## Ortam Ayrimi

Gercek degerleri Git'e eklemeyin. Kokteki `.env.example` dosyasini su yerel dosyalardan birine kopyalayin:

| Ortam | Dosya | Kullanim |
| --- | --- | --- |
| Development | `.env.development` | Yerel gelistirme |
| Staging | `.env.staging` | Gecici test Supabase projesi ve test domaini |
| Production | `.env.production` | Gercek domain ve production Supabase |

Bu dosyalar `.gitignore` tarafindan dislanir. `SUPABASE_SERVICE_ROLE_KEY` yalnizca runtime ortam degiskeni olarak verilir; Docker build argumani degildir ve image'a yazilmaz.

`NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` tarayici bundle'ina girdigi icin public degerlerdir. Bunlar yetkilendirme yerine gecmez; veri guvenligi RLS ve server-side kontrollerle saglanir.

## Yerel Standalone Dogrulamasi

```bash
corepack pnpm install --frozen-lockfile
NEXT_STANDALONE=true corepack pnpm --filter @operations/admin build
cd apps/admin
mkdir -p .next/standalone/apps/admin/.next
cp -R public .next/standalone/apps/admin/public
cp -R .next/static .next/standalone/apps/admin/.next/static
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/apps/admin/server.js
```

Ardindan:

```bash
curl --fail http://127.0.0.1:3000/api/health
```

Beklenen yanit:

```json
{"service":"operations-portal","status":"ok"}
```

Windows'ta pnpm standalone klasoru olustururken symlink yetkisi gerekir. Dogrudan Windows build'i kullanilacaksa Developer Mode'u etkinlestirin veya yetkili bir terminal kullanin. Docker/Linux build'inde bu kisit yoktur.

## Docker ile Calistirma

Docker Engine ve Docker Compose v2 kurulu bir makinede:

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
docker compose ps
docker compose logs --tail=100 web
```

Health kontrolu:

```bash
curl --fail http://127.0.0.1:3000/api/health
docker inspect --format '{{json .State.Health}}' operations-portal-web-1
```

Container:

- Node.js 22 tabanlidir.
- `nextjs` adli UID/GID `1001` non-root kullanici ile calisir.
- Tum Linux capability'leri dusurulur.
- `no-new-privileges` aktiftir.
- Root filesystem read-only'dir; yalnizca `/tmp` ve Next cache tmpfs olarak yazilabilir.
- `.git`, `.env`, testler, dokumanlar, mobil uygulama ve gelistirme araclari final image'da bulunmaz.

## Ubuntu/OVH Hazirligi

1. Sunucuya guncel Ubuntu LTS kurun ve guvenlik guncellemelerini uygulayin.
2. SSH parola girisini kapatip anahtar tabanli giris kullanin.
3. Uygulama icin ayri, sudo yetkisi sinirli bir deploy kullanicisi olusturun.
4. Docker Engine ve Compose eklentisini resmi Docker deposundan kurun.
5. Firewall'da yalnizca SSH, `80/tcp` ve `443/tcp` acin. Container portu sadece `127.0.0.1:3000` adresine baglanir.
6. Depoyu private repository erisimi olan deploy anahtari veya sinirli token ile clone edin.
7. `.env.production` dosyasini sunucuda olusturun ve sadece deploy kullanicisinin okuyabilecegi izinleri verin.
8. Docker Compose ile container'i baslatin ve health kontrolunu dogrulayin.
9. Reverse proxy ve TLS hazir olmadan domain DNS'ini yeni sunucuya cevirmeyin.

## Domain ve TLS

Bir domain veya alt domain onerilir. Ornek: `rapor.example.com`.

Nginx reverse proxy ozeti:

```nginx
server {
    listen 80;
    server_name rapor.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

TLS icin Certbot veya sirketin mevcut reverse proxy/TLS yonetimi kullanilmalidir. HTTPS dogrulanmadan gercek kullanici trafigi acilmamalidir.

## Vercel Uyumlulugu

`@vercel/analytics` ve `@vercel/speed-insights` yalnizca Vercel ortami algilandiginda veya `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS=true` verildiginde render edilir. Self-host ortaminda uygulamanin calismasi bu paketlere bagli degildir.

Mevcut Vercel projesi ve domain baglantisi bu asamada degistirilmez. Ayni commit once staging/self-host domaininde dogrulanir; gecis daha sonra planli DNS degisikligiyle yapilir.

## Guncelleme Akisi

```bash
git fetch origin
git checkout <onayli-commit-veya-tag>
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

Her guncellemeden once veritabani migration gereksinimi ayri kontrol edilmelidir. Production migration onaysiz calistirilmamalidir.

## Rollback

1. Calisan image'i commit SHA ile etiketleyin.
2. Yeni image'i baslatmadan once onceki image etiketini kaydedin.
3. Health veya smoke test basarisizsa onceki Git commit/image etiketine donun.
4. `docker compose up -d` ile onceki image'i tekrar baslatin.
5. Veritabani migration'i varsa uygulama rollback'inden ayri degerlendirin; destructive ters migration calistirmayin.

SaaS calismasi oncesi kaynak kod geri donus noktasi:

```text
baseline/pre-saas-20260829
```

## Operasyon Notlari

- Container loglarini merkezi bir log sistemine veya sinirli boyutlu Docker log rotation'a baglayin.
- Supabase backup ve restore tatbikatini periyodik yapin.
- Health endpoint sadece uygulama process'ini kontrol eder; Supabase baglantisini kontrol ederek hassas hata ayrintisi vermez.
- Tek instance icin mevcut Next cache yeterlidir. Birden fazla instance'a cikildiginda paylasilan cache ve sticky olmayan trafigin etkileri ayrica tasarlanmalidir.
- Production source map'leri kapali tutulur.
