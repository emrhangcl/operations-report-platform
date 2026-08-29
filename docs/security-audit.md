# Güvenlik Denetimi

Tarih: 2026-08-29  
Kapsam: `feat/saas-platform` dalındaki yerel kaynak kodu, yerel Supabase ve Docker image.  
Üretim Vercel/Supabase ortamına saldırı testi veya değişiklik yapılmadı.

## Sonuç özeti

Temel tenant izolasyonu, rol kontrolleri, abonelik erişimi, dosya erişimi, istek boyutu ve hata/loglama kontrolleri güçlendirildi. Yerel doğrulama başarılıdır; ancak bu çalışma "bütün güvenlik açıkları kapandı" anlamına gelmez. Üretime açmadan önce aşağıdaki açık riskler ve operasyon maddeleri tamamlanmalıdır.

## Yapılan kontroller

| Kontrol | Sonuç |
| --- | --- |
| `corepack pnpm test` | Geçti: shared 10, payments 3, validation 5 |
| `corepack pnpm typecheck` | Geçti: workspace içindeki 6 proje |
| `corepack pnpm lint` | Geçti: admin ESLint, uyarı yok |
| `corepack pnpm exec supabase test db --local` | Geçti: 4 dosya, 124 pgTAP testi |
| `corepack pnpm exec supabase db diff --local --schema public` | Şema farkı yok |
| `corepack pnpm exec supabase db lint --local` | Çalıştı; bir adet aşağıdaki uyarı kaldı |
| Docker hardened smoke test | Geçti: non-root, read-only filesystem, capability drop, no-new-privileges |
| HTTP smoke test | Geçti: health 200, request ID, unauthenticated admin/platform 403, oversized body 413 |
| Kaynak kodu tehlikeli API taraması | `eval`, `new Function`, raw `innerHTML` ve `dangerouslySetInnerHTML` bulunmadı |
| Git secret taraması | Tracked dosyalarda gerçek key/token eşleşmesi bulunmadı; `.env` repository dışı tutuldu |
| Browser source map kontrolü | Browser bundle içinde source map yok; Docker final image tüm `.map` dosyalarını siliyor |

## Uygulanan korumalar

- Tüm tenant tablolarında `organization_id`, foreign key, erişim politikaları ve cross-tenant pgTAP testleri.
- Firma/rol/subscription kontrolleri server route ve database RLS katmanlarında.
- Platform admin alanı `private.platform_admins` içinde; normal firma yöneticisi bu alana erişemez.
- `service_role` yalnızca server-side `SUPABASE_SERVICE_ROLE_KEY` ile kullanılır; `NEXT_PUBLIC_` veya mobil ortamda kullanılmaz.
- `report-photos` bucket private, 5 MB limitli ve yalnızca JPEG/PNG/WebP kabul ediyor.
- Yeni fotoğraf yollarında firma, rapor, owner, güvenli dosya adı ve uzantı eşleşmesi aranıyor; mobil yüklemede overwrite kapalı.
- Kayıt, webhook, hesap oluşturma/sıfırlama, silme, export ve PDF gibi hassas route’larda istek boyutu ve best-effort process-local rate limit var.
- Request ID, güvenli JSON loglama, hassas alan maskeleme ve genel hata cevapları var.
- Güvenlik header’ları, production HTTPS için HSTS ve Docker final image temizliği eklendi.

## Kalan riskler

### 1. Yüksek: transitif `image-size` advisory

`pnpm audit --prod --audit-level high` iki yüksek bulguyu, Expo/Metro zincirinden gelen `image-size@1.2.1` için raporluyor. Projede `image-size` doğrudan kullanılmıyor. Denetim sırasında npm’de yayımlanmış en güncel sürüm `2.0.2` idi; advisory metadata’sı ise `2.0.3` sürümünü patched olarak gösteriyor. Bu nedenle olmayan bir sürüme zorla override eklenmedi.

Kaynaklar: [`image-size` npm paketi](https://www.npmjs.com/package/image-size), [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr), [GitHub advisory database issue](https://github.com/github/advisory-database/issues/9028), [Expo takip kaydı](https://github.com/expo/expo/issues/48670).

Mevcut azaltım: Expo/Metro geliştirme ve mobile build zinciridir; internete açık bir Metro servisi çalıştırılmamalıdır. Expo uyumlu patched sürüm yayınlandığında dependency tekrar güncellenip audit tekrarlanmalıdır.

### 2. Orta: rate limit dağıtık değil

Uygulamadaki limit process-memory ve instance başınadır. Birden çok Vercel instance’ı veya yatay ölçeklemede tek global limit sağlamaz. Public demo öncesinde Vercel Firewall/rate limiting, Redis/Upstash veya güvenilir reverse proxy katmanı kullanılmalıdır.

### 3. Orta: gerçek ödeme sağlayıcısı bağlı değil

iyzico/PayTR adapter sınırı hazırdır; credential, sandbox callback ve mutabakat akışı yapılandırılmadı. Gerçek ödeme almadan önce provider sandbox, imza doğrulama, idempotency, başarısız ödeme ve iptal senaryoları test edilmelidir.

### 4. Orta: yedekleme/geri yükleme operasyonu bağlı değil

Platform panelindeki yedekleme bilgisi gerçek bir worker’a bağlı değildir. Supabase backup/PITR, harici kritik veri yedeği ve en az bir geri yükleme tatbikatı yapılandırılmalıdır.

### 5. Orta: public GitHub repository iş riski

Secret taraması temiz olsa da public repository uygulama mantığını ve iş süreçlerini görünür kılar. Şirket politikası, private repository ve Vercel deploy kimliklendirmesi birlikte kararlaştırılmalıdır.

### 6. Düşük: dosya içeriği/antivirüs taraması yok

Bucket private, MIME/uzantı/ölçü/path kontrolleri var; ancak dosyanın gerçek magic-byte doğrulaması ve antivirüs/yeniden kodlama hattı yok. Hassas production kullanımı öncesinde server-side image re-encode veya AV taraması eklenmelidir.

### 7. Düşük: Supabase lint uyarısı

`public.process_verified_payment_event` fonksiyonunda `p_provider_customer_id` parametresi şu an kullanılmıyor. Gerçek provider entegrasyonu bağlanırken provider müşteri kimliği doğrulaması eklenmeli ve lint yeniden temizlenmelidir.

### 8. Bilgi: deprecated subdependency uyarıları

Bunlar doğrudan runtime açığı olarak doğrulanmadı; ana paketler güncellendiğinde yeniden değerlendirilmelidir.

## Üretim öncesi kabul listesi

- [ ] Vercel projesi ve GitHub deploy kimliği private/public kararıyla uyumlu.
- [ ] Vercel ve Supabase secret’ları yalnızca platform secret store’da; Git geçmişinde yok.
- [ ] HTTPS, özel domain, HSTS ve DNS doğrulandı.
- [ ] Dağıtık rate limit/WAF ve abuse alarmı etkin.
- [ ] Supabase backup/PITR ve restore tatbikatı tamamlandı.
- [ ] Ödeme sağlayıcısı sandbox ve webhook replay/idempotency testleri geçti.
- [ ] Staging’de gerçek kullanıcı rolleriyle uçtan uca test yapıldı.
- [ ] Auth, webhook, storage, export ve admin audit logları izleniyor.
- [ ] `pnpm audit`, dependency review ve advisory takibi release sürecine eklendi.

