# CLAUDE.md — Operasyon Portalı

Bu dosya her oturumda otomatik okunur. Amacı: kullanıcı sadece bir istek yazdığında,
o işe en uygun **skill** veya **agent**'ın otomatik seçilip çalıştırılmasını sağlamak.

## Dil
- Kullanıcıya **her zaman Türkçe** yanıt ver. Kod, değişken adı ve commit mesajları İngilizce kalır.

## Kaynak öncelik sırası
1. `AGENTS.md` ve `docs/*` bu depo için bağlayıcı kaynaktır (mimari, güvenlik, RLS, iş kuralları).
2. Kod/mimari sorusu gelince ve `graphify-out/graph.json` varsa, önce `graphify query "<soru>"` ile bu bilgi grafiğinden yanıtla.
3. Aşağıdaki yönlendirme tablosuna göre uzman skill/agent seç.

## Otomatik yönlendirme tablosu
Kullanıcının isteğini aşağıdaki niyetlerle eşleştir; birden fazla eşleşirse en spesifik olanı kullan.
Ağır/çok adımlı işleri ilgili **agent** ile, teknik rehber gerektirenleri **skill** ile yürüt.

| İstek / niyet | Kullanılacak araç |
| --- | --- |
| Arayüz/tasarım yenileme, sayfa/komponent tasarımı, renk/tipografi/düzen | skill `ui-ux-pro-max`, sonra `design-system` + `ui-styling` |
| Logo, banner, marka kimliği, sunum görseli | skill `design` (veya `banner-design`) |
| Animasyon / geçiş / mikro-etkileşim | skill `ecc:motion-foundations` → `ecc:motion-patterns` → `ecc:motion-advanced` |
| React/Next.js bileşen deseni, performans | skill `ecc:react-patterns`, `ecc:react-performance`, `ecc:nextjs-turbopack` |
| Erişilebilirlik (a11y) tasarımı/denetimi | agent `ecc:a11y-architect`, skill `ecc:frontend-a11y` |
| TypeScript/React kod incelemesi | agent `ecc:typescript-reviewer` / `ecc:react-reviewer` (veya `/code-review`) |
| Güvenlik incelemesi / açık taraması | agent `ecc:security-reviewer`, skill `security-review`, komut `/ecc:security-scan` |
| PostgreSQL / RLS / şema / migration | agent `ecc:database-reviewer`, skill `ecc:postgres-patterns`, `ecc:database-migrations` |
| Derleme/tip hatası düzeltme | agent `ecc:react-build-resolver` / `ecc:build-error-resolver` (veya `/ecc:build-fix`) |
| Test yazma / kapsama / TDD | agent `ecc:tdd-guide`, skill `ecc:tdd-workflow`, `ecc:react-testing` |
| Uçtan uca (E2E) / tarayıcı testi | agent `ecc:e2e-runner`, skill `ecc:e2e-testing`, `ecc:browser-qa` |
| Kod sadeleştirme / ölü kod temizliği | agent `ecc:code-simplifier` / `ecc:refactor-cleaner` (veya `/simplify`) |
| Sessiz hata / yutulan hata avı | agent `ecc:silent-failure-hunter` |
| Mimari tasarım / planlama | agent `ecc:architect` / `ecc:planner` / `ecc:code-architect` |
| Kod keşfi / "X nerede, nasıl çalışıyor" | agent `ecc:code-explorer` veya `graphify query` |
| Dokümantasyon güncelleme | agent `ecc:doc-updater`, komut `/ecc:update-docs` |
| Tanıtım/pazarlama sayfası metni, SEO | agent `ecc:marketing-agent` / `ecc:seo-specialist`, skill `ecc:seo` |
| Grafik/çizelge/dashboard görseli | skill `dataviz` |
| Kod tabanı hakkında soru | skill `graphify` (`graphify query "<soru>"`) |

## Çalışma kuralları
- Dosya değiştiren veya çok adımlı her işte görev listesini güncel tut; iş bitince özet ver.
- Güvenlik, kiracı izolasyonu (RLS) ve `service_role` kurallarını asla gevşetme (`docs/SECURITY.md`).
- Şema değişiklikleri yalnızca `db/migrations` altında yeni numaralı dosya olarak; uygulanmış migration değiştirilmez.
- Commit/PR mesajlarına imza/attribution satırı ekleme.
