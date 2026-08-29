# ERP/CRM Yol Haritası

Bu belge yalnızca planlama içindir. Bu aşamada ERP/CRM kodu, migration’ı, route’u, paket bağımlılığı veya menü öğesi eklenmemiştir.

## Amaç

Montaj ve servis raporlarından doğan müşteri, iş emri, saha planı, stok/ürün ve ticari takip ihtiyacını mevcut rapor sistemini bozmadan aşamalı biçimde karşılamak.

## Önerilen fazlar

1. **İhtiyaç ve veri sözlüğü:** Firma, müşteri, tesis, hat, bant, ürün, araç, personel, yetkili, iş emri, rapor ve ek dosya sahipliklerini kesinleştirme.
2. **CRM çekirdeği:** Müşteri/firma kartı, kontaklar, tesisler, notlar, aktivite geçmişi ve arama/filtreleme.
3. **Servis operasyonu:** Talep, öncelik, SLA, atama, planlanan tarih, durum geçmişi ve amir onayı.
4. **ERP-lite:** Ürün/bant kataloğu, araç/ekipman, sarf malzeme ve raporla ilişkili miktar takibi. Finans/muhasebe kapsam dışı bırakılır veya mevcut ERP’ye entegre edilir.
5. **Raporlama:** Firma, hat, bant, personel, süre, tekrar arıza ve SLA göstergeleri; tenant sınırları korunarak export.
6. **Entegrasyon ve mobil iyileştirme:** E-posta/bildirim, takvim, mevcut ERP/API ve gerekirse imzalı PDF akışı.

## Yetki modeli

- Platform admin: tenant yaşam döngüsü, paket ve destek amaçlı sınırlı görünüm.
- Firma owner/admin: kendi firmasının kullanıcı, katalog ve operasyon ayarları.
- Yetkili amir: kendi firmasındaki iş emri ve montaj atamaları.
- Personel: kendisine atanan işleri ve kendi oluşturduğu raporları; değişiklik yetkisi iş durumuna göre sınırlı.
- Denetçi/okuyucu: yalnızca açıkça izin verilen salt-okunur kayıtlar.

Her yeni tablo `organization_id`, foreign key, RLS, audit ihtiyacı, silme stratejisi ve retention süresi tanımlanmadan geliştirmeye alınmaz.

## Veri ve migration yaklaşımı

- Mevcut raporların kimliği korunur; yeni CRM/ERP kayıtları raporlarla foreign key üzerinden bağlanır.
- Personel silme işlemi rapor sahibini anonimleştirme veya geçmişteki display adı snapshot’ını koruma kararıyla tasarlanır.
- Soft delete yalnızca iş/denetim geçmişi gerektiren varlıklarda kullanılır; erişim politikası silinmiş kaydı yeniden görünür kılmaz.
- İlk migration read-only backfill ve sayım ile doğrulanır; yazma açılması ayrı release olur.
- CSV/import işlemleri şema doğrulama, duplicate kontrolü, dry-run ve geri alınabilir batch ile yapılır.

## Entegrasyonlar

Öncelik sırası: mevcut e-posta/bildirim altyapısı, seçilen ödeme sağlayıcısı, şirket ERP’si ve gerekiyorsa takvim. Her entegrasyon için secret yönetimi, webhook imza doğrulaması, idempotency, timeout/retry, audit ve tenant eşleştirme sözleşmesi hazırlanır.

## Onay kapıları

Her fazdan önce ürün sahibi kapsamı ve veri sahipliğini onaylar. Geliştirme öncesi ERD/API sözleşmesi, RLS/test planı ve geri dönüş planı yazılır. Staging uçtan uca testleri ve güvenlik incelemesi geçmeden production migration yapılmaz.

