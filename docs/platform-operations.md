# Platform yönetimi

Platform paneli `/platform` adresinde çalışır. Bu alan normal firma yöneticisi rolünden ayrıdır; erişim yalnızca `private.platform_admins` tablosundaki Auth kullanıcılarına verilir.

## İlk platform yöneticisini tanımlama

Supabase SQL Editor veya güvenli bir sunucu bakım oturumunda, hesabın Auth kullanıcı kimliği biliniyorsa aşağıdaki sorgu çalıştırılabilir. Service role anahtarını tarayıcıya, repoya veya komut geçmişine yazmayın.

```sql
insert into private.platform_admins (user_id, granted_by_user_id)
values ('AUTH_USER_UUID', 'AUTH_USER_UUID')
on conflict (user_id) do nothing;
```

`AUTH_USER_UUID` değeri Supabase Auth kullanıcı listesindeki UUID olmalıdır. Bu tabloya anonim veya normal authenticated istemci erişemez; platform API’si sunucu tarafında service role ile kontrol yapar.

## Paneldeki işlemler

- Firma detayları, kullanıcılar, abonelik geçmişi, doğrulanmış ödeme kayıtları ve audit logları gösterilir.
- Firma askıya alma, aktifleştirme, kapatma sürecini başlatma, lifetime verme/kaldırma ve paket değişikliği transaction içindeki server RPC’leriyle yapılır.
- Her yönetim işlemi `audit_logs` tablosuna yazılır.
- Dışa aktarma isteği silinmez; `private.platform_export_requests` tablosunda kuyruğa alınır. Dosyayı üreten worker bu aşamada bağlı değildir.
- Kart bilgileri ve sağlayıcıların hassas alanları panel response’una dahil edilmez.

## Henüz bağlı olmayan veriler

- Ödeme sağlayıcısı seçimi ve sandbox credential’ları verilmediği için webhook adapter’ları bilinçli olarak yapılandırılmamıştır.
- Sağlayıcı mutabakatı gelmeden net gelir hesaplanmaz; panelde `Sağlayıcı verisi yok` görünür.
- Harici yedekleme worker’ı bağlanmadığı için son başarılı yedekleme zamanı `Kayıt yok` görünür.

Bu durumlar sahte başarı, sahte ödeme veya demo metrikle gizlenmez.

## Yerel doğrulama

```powershell
corepack pnpm exec supabase db reset --local --no-seed
corepack pnpm exec supabase test db --local
corepack pnpm --filter @tunca/admin typecheck
corepack pnpm --filter @tunca/admin lint
```

Production Supabase üzerinde migration çalıştırılmadan önce staging backup, provider sandbox callback’i ve ilk platform hesabının doğrulanması gerekir.
