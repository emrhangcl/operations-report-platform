# Ödeme Sağlayıcısı Değerlendirmesi

Bu doküman, TUNCA SaaS abonelikleri için gerçek entegrasyon seçilmeden önce hazırlanmış teknik karşılaştırmadır. Üretim veya sandbox anahtarı bu depoya eklenmez.

## Kısa karar

İlk aday olarak **iyzico** önerilir. Resmi dokümantasyonunda abonelik ürünü, abonelik işlemleri ve yenileme bildirimleri ayrı akışlar olarak tanımlanıyor. Bu, aylık/yıllık yenilemelerin sağlayıcı tarafında tutulmasını kolaylaştırır.

**PayTR** adapter içinde desteklenebilir; ancak incelenen resmi akışlarda callback ve imza doğrulama öne çıkıyor. Tekrarlayan abonelik durumunun, yenileme denemelerinin ve dönem yönetiminin daha büyük bölümünü uygulamanın kendisi orkestre edecektir.

Bu bir canlı entegrasyon kararı değildir. Sağlayıcı seçimi ve sandbox bilgileri için ürün sahibinin açık onayı bekleniyor.

## iyzico

- Hosted Checkout Form ve abonelik checkout akışları mevcut.
- Abonelik bildirimleri `subscription.order.success` ve `subscription.order.failure` olaylarıyla alınabiliyor.
- Webhook doğrulamasında `X-IYZ-SIGNATURE-V3` kullanılmalı.
- İmza, sağlayıcının tanımladığı alan sırası ve merchant secret ile HMAC-SHA256 olarak doğrulanmalı.
- Kart bilgisi TUNCA veritabanına alınmamalı; hosted checkout kullanılmalı.

Kaynaklar:

- https://docs.iyzico.com/en/products/subscription/subscription-implementation
- https://docs.iyzico.com/en/products/subscription/subscription-implementation/subscription-transactions
- https://docs.iyzico.com/en/advanced/webhook

## PayTR

- Direct API ve iFrame akışları mevcut.
- Callback bildirimlerinde `merchant_oid`, durum, tutar ve hash alanları kullanılıyor.
- Hash, PayTR merchant key/salt bilgileriyle HMAC-SHA256 ve Base64 olarak doğrulanmalı.
- PayTR aynı bildirim için tekrar deneme yapabildiğinden callback idempotent olmalı; yalnızca ilk geçerli olay ödeme durumunu değiştirmeli.
- Callback endpoint'i kullanıcı oturumuna bağlanmamalı; yalnızca sağlayıcı imzası ve sunucu tarafı sipariş eşleşmesi esas alınmalı.

Kaynaklar:

- https://dev.paytr.com/en/iframe-api/iframe-api-2-adim
- https://dev.paytr.com/en/direkt-api/direkt-api-2-adim
- https://dev.paytr.com/en/durum-sorgu

## Uygulamadaki sınır

`packages/payments` provider bağımsız sözleşmeyi, HMAC yardımcılarını ve yapılandırılmamış sağlayıcının hata vermesini içerir. `apps/admin/app/api/payments/webhooks/[provider]/route.ts` ham gövde sınırı, imza doğrulama sınırı ve server-only service role geçişiyle hazırdır.

Gerçek sağlayıcı adapter'ı şu kararlar verilmeden yazılmayacaktır:

1. iyzico veya PayTR seçimi.
2. Sandbox hesabı ve test anahtarlarının güvenli secret store'a eklenmesi.
3. Aylık/yıllık plan fiyatlarının ve vergi/fatura davranışının kesinleştirilmesi.
4. Sağlayıcı panelindeki webhook URL'sinin HTTPS olarak tanımlanması.

Kart numarası, CVV, access token veya secret key uygulama veritabanında, istemci bundle'ında, loglarda veya Docker image'ında tutulmayacaktır.
