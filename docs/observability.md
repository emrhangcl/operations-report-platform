# Hata yönetimi ve güvenli loglama

## Uygulama davranışı

- `apps/admin/middleware.ts` her isteğe güvenilir bir `X-Request-ID` ekler ve route’a `x-request-id` olarak aktarır.
- API hata yardımcıları response gövdesine `request_id` ekler; kullanıcı teknik ayrıntıyı görmeden destek ekibine bu kimliği iletebilir.
- `error.tsx`, `global-error.tsx`, `not-found.tsx`, `forbidden`, `rate-limited` ve `maintenance` sayfaları hassas stack trace göstermez.
- `apps/admin/lib/observability.ts` yalnızca server tarafında çalışır ve JSON log üretir.

## Log kuralları

Log seviyeleri `info`, `warn` ve `error` olarak ayrılır. Production’da `info` kayıtları kapalıdır. Log yardımcıları aşağıdaki alanları maskeler:

- parola, token, secret, API key, service role, authorization, cookie, imza ve kart alanları,
- e-posta, telefon, isim, adres, vergi kimliği ve IP gibi kişisel alanlar.

Webhook gövdesi, Authorization header, cookie, ödeme kartı ve imzalı URL loglanmaz. Hata stack’i yalnızca server loguna gider; kullanıcı response’una girmez. JSON serialization kontrol karakterlerini escape ettiği için kullanıcı girdisi log satırını bölemez.

Audit log, teknik logdan ayrıdır ve yalnızca yetkili işlem geçmişini temsil eder.

## Operasyon notu

Log toplama ürünü seçildiğinde `request_id` alanı üzerinden arama yapılmalıdır. Sağlayıcı credential’ları ve gerçek log değerleri repository’ye veya dokümana yazılmamalıdır.
