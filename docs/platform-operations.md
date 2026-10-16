# Platform yönetimi

Platform paneli `/platform` adresinde çalışır. Bu alan normal firma yöneticisi rolünden ayrıdır; erişim yalnızca `private.platform_admins` tablosunda kaydı bulunan kullanıcılara verilir. Platform sahibi `/login` ekranından giriş yapar; sunucu bu hesabı tanır ve doğrudan `/platform` alanına yönlendirir.

## İlk platform yöneticisini tanımlama

Yeni bir kurulumda ilk platform sahibi hesabı komut satırından oluşturulur. Hesap ve yetki kaydı tek transaction içinde yazılır:

```bash
pnpm create-admin --platform
```

Komut ad, soyad, e-posta ve en az 10 karakterlik parola sorar. Otomasyon için `ADMIN_EMAIL`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` ve `ADMIN_PASSWORD` ortam değişkenleri verilebilir; parola komut satırı argümanı olarak alınmaz, böylece kabuk geçmişine ve süreç listesine düşmez.

Var olan bir kullanıcıya platform yetkisi vermek gerekirse `pnpm db:psql` ile (şema sahibi `ops_owner` olarak) aşağıdaki sorgu çalıştırılabilir:

```sql
insert into private.platform_admins (user_id, granted_by_user_id)
select id, id from auth.users where email = 'kullanici@ornek.com'
on conflict (user_id) do nothing;
```

`private` şemasındaki tablolara anonim veya oturum açmış istemciler erişemez; platform API'si sunucu tarafında `public.is_platform_admin_for_user` ile yetkiyi doğrular.

## Firmaların açılması

Firmalar `/register` ile kayıt olur; yeni firma `suspended` durumda ve abonelik `pending` olarak başlar. Yerel kurulumda ödeme sağlayıcısı bağlı olmadığından erişim platform panelinden açılır:

- **Ömür boyu erişim ver** + **Aktifleştir**: firmaya ödeme beklemeden yazma erişimi verir.
- **Paketi değiştir**: aboneliği yeniden `pending` yapar ve firmayı ödeme gelene kadar askıya alır (bilinçli iş kuralı).

## Paneldeki işlemler

- Firma detayları, kullanıcılar, abonelik geçmişi, doğrulanmış ödeme kayıtları ve audit logları gösterilir.
- Firma askıya alma, aktifleştirme, kapatma sürecini başlatma, yeniden açma, lifetime verme/kaldırma ve paket değişikliği transaction içindeki sunucu RPC'leriyle yapılır.
- Kalıcı silme firma kodunun aynen yazılmasını ister; tenant verisi transaction içinde silinir, ardından sunucu yüklenen dosyaları ve giriş hesaplarını kaldırır. Yarım kalan silme işlemi firmayı kapalı tutar ve aynı işlemle devam ettirilir.
- Her yönetim işlemi `audit_logs` tablosuna yazılır.
- Dışa aktarma isteği silinmez; `private.platform_export_requests` tablosunda kuyruğa alınır. Dosyayı üreten worker bu aşamada bağlı değildir.
- Kart bilgileri ve sağlayıcıların hassas alanları panel response'una dahil edilmez.

## Henüz bağlı olmayan veriler

- Ödeme sağlayıcısı seçimi ve sandbox credential'ları verilmediği için webhook adapter'ları bilinçli olarak yapılandırılmamıştır.
- Sağlayıcı mutabakatı gelmeden net gelir hesaplanmaz; panelde `Sağlayıcı verisi yok` görünür.
- Otomatik yedekleme işi bağlanmadığı için son başarılı yedekleme zamanı `Kayıt yok` görünür.

Bu durumlar sahte başarı, sahte ödeme veya demo metrikle gizlenmez.

## Yerel doğrulama

```bash
pnpm db:test platform
pnpm --filter @operations/admin typecheck
pnpm --filter @operations/admin lint
pnpm --filter @operations/admin test
```

`pnpm db:test platform` test veritabanını sıfırlayıp platform yönetimi pgTAP testlerini çalıştırır; geliştirme veritabanına dokunmaz. Uygulama çalışırken `pnpm test:e2e` platform girişi, firma kaydı ve erişim açma akışlarını uçtan uca dener.

Gerçek kullanıcılara açmadan önce yedekleme, ödeme sağlayıcısının sandbox callback'i ve ilk platform hesabının doğrulanması tamamlanmalıdır.
