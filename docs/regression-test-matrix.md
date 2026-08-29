# Regresyon ve Doğrulama Matrisi

Tarih: 2026-08-29  
Kapsam: yerel `feat/saas-platform` dalı. Üretim verisi kullanılmadı.

## Otomatik doğrulama

| Alan | Senaryo | Sonuç |
| --- | --- | --- |
| Build | Admin production build ve mobile TypeScript | Geçti |
| Tip/lint | Workspace typecheck ve admin lint | Geçti |
| Unit | Shared rate limit, validation ve payment adapter testleri | Geçti: 18 test |
| Tenant | Firma A/B select, insert, update, delete, report ve counter izolasyonu | Geçti |
| Storage | Firma/rapor/owner path eşleşmesi, private bucket, MIME ve uzantı sınırı | Geçti |
| Subscription | lifetime, active, grace/read-only ve blocked durumları | Geçti |
| Payment | doğrulanmış event, idempotency ve yanlış firma/provider reddi | Geçti |
| Platform admin | firma durum/paket/lifetime işlemleri ve audit kaydı | Geçti |
| Docker | non-root, read-only, capability drop, no-new-privileges | Geçti |
| HTTP | health, security headers, request ID, 403 ve 413 kontrolleri | Geçti |
| Browser smoke | Ana sayfa, kayıt formu, hatalı girişte genel mesaj ve `/platform` için login yönlendirmesi | Geçti |

## Manuel veya staging’de tamamlanacak akışlar

| Rol/alan | Kontrol |
| --- | --- |
| Ziyaretçi | Ana sayfa, kayıt, e-posta doğrulama yönlendirmesi ve giriş |
| Personel | Rapor oluşturma, taslak, fotoğraf yükleme, PDF, gönderim ve yalnızca kendi raporlarını görme |
| Personel | Montaj ataması geldiğinde bildirim ve `Montajlarım` ekranı |
| Firma yöneticisi | Kullanıcı/firmalar/hatlar/bantlar/araçlar yönetimi ve yetki sınırları |
| Firma yöneticisi | Atama, birden fazla hat-bant kalemi, rapor görüntüleme/silme ve audit |
| Platform admin | `/platform`, firma askıya alma/aktif etme, paket ve lifetime işlemleri |
| Storage | Gerçek cihazdan kamera/galeri yüklemesi ve rapor silme sonrası erişim davranışı |
| Payment | Seçilen sağlayıcının sandbox checkout, signed webhook, retry ve refund akışı |
| Operasyon | Backup restore, log/alert, domain/DNS ve gerçek e-posta teslimatı |

## Release kuralı

Otomatik kontrollerden biri başarısızsa release yapılmaz. Manuel akışlar staging’de gerçek olmayan test hesaplarıyla tamamlanır; production hesabı veya service-role anahtarı test verisine yazılmaz. Her release sonrasında build, DB testleri, dependency audit ve Docker/HTTP smoke testleri tekrarlanır.
