# TUNCA Montaj ve Tamir Rapor Sistemi

TUNCA Teknik Makina Sanayi ve Ticaret A.Ş. için hazırlanmış temiz başlangıçlı monorepo demo sistemidir. Uygulama demo kayıt, seed veri veya fake dashboard verisi oluşturmaz.

## Yapı

```text
apps/admin      Next.js yönetim paneli
apps/mobile     Expo SDK 54 React Native mobil uygulama
packages/types  Ortak TypeScript tipleri
packages/validation  Ortak Zod doğrulama kuralları
packages/shared Ortak tarih, izin, Excel ve rapor numarası yardımcıları
supabase/migrations PostgreSQL schema, trigger ve RLS
```

Logo dosyası `assets/tunca-logo.png`, admin içinde `apps/admin/public/tunca-logo.png`, mobil içinde `apps/mobile/assets/tunca-logo.png` olarak yerleştirildi.

## Kurulum

1. Node.js 22 veya üzerini kurun.

2. Paket yöneticisini ve bağımlılıkları hazırlayın:

```bash
corepack enable
pnpm install
```

3. Supabase üzerinde yeni bir proje oluşturun.

4. `.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` yalnızca server tarafında ve `create-admin` scriptinde kullanılır. Mobil veya web client bundle içine koymayın.

5. Migration çalıştırın:

```bash
supabase db push
```

Supabase CLI kullanmıyorsanız `supabase/migrations/202608190001_initial_schema.sql` dosyasını SQL editor üzerinden çalıştırabilirsiniz.

6. Private storage bucket:

Migration `report-photos` bucket'ını private olarak oluşturur. Supabase panelinde bucket'ın public olmadığını kontrol edin.

7. İlk admin hesabını manuel oluşturun:

```bash
pnpm run create-admin
```

Komut ad, soyad, e-posta ve şifre sorar. Veritabanına otomatik demo admin eklenmez.

8. Admin paneli başlatın:

```bash
pnpm run dev:admin
```

Panel varsayılan olarak `http://localhost:3000` adresinde açılır.

9. Expo mobil uygulamayı başlatın:

```bash
pnpm run dev:mobile
```

10. iPhone'da test:

Expo Go uygulamasını açın ve terminaldeki QR kodu kamera ile okutun.

11. Android'de test:

Expo Go uygulamasını açın ve terminaldeki QR kodu okutun.

12. Excel export testi:

Admin panelde `Raporlar` sayfasına gidin, rapor seçin veya filtre uygulayın, `Excel'e Aktar` ya da `Filtre Sonucunu Aktar` butonunu kullanın.

## İlk Çalıştırma Beklentisi

Boş veritabanında admin dashboard kartları `0` gösterir. Firma, bant, personel, rapor ve fotoğraf otomatik oluşturulmaz.

Önerilen manuel akış:

1. Firma ekle.
2. Bant ekle.
3. Personel hesabı oluştur.
4. Mobil uygulamada personel ile giriş yap.
5. Rapor oluştur, fotoğraf ekle ve gönder.
6. Admin panelden raporu kontrol et.
7. Excel'e aktar.

## Güvenlik Notları

Raporu oluşturan kullanıcı frontend'den gelen bir değere göre değil, Supabase auth session üzerinden DB trigger ile `created_by_user_id` alanına yazılır. Personel sadece kendi raporlarını okuyabilir ve sadece kendi taslaklarını güncelleyebilir. Admin tüm raporları görebilir.

Rapor numarası yalnızca `SUBMITTED` durumda transaction-safe PostgreSQL trigger ile üretilir:

```text
TNC-2026-000001
```

`project`, imza, kaşe veya onay workflow alanları eklenmedi.

## Kontrol Komutları

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```
