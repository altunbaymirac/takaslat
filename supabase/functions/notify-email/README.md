# Takaslat Bildirim E-postası (Resend)

`notifications` tablosuna bir satır düştüğünde kullanıcıya bildirim maili atar.

## Akış

```
teklif / mesaj / moderasyon
        ↓  (DB trigger)
  notifications satırı          → uygulama içi çan (realtime)
        ↓  (Database Webhook)
  notify-email edge function
        ↓
      Resend  → kullanıcının e-postası
```

Trigger'lar `supabase/migrations/20260923190000_notification_triggers_and_email.sql`
içinde. **Önce o migration çalıştırılmalı**, yoksa ne çan ne mail çalışır.

## 1. Resend hesabı ve alan adı

1. https://resend.com → kayıt ol (ücretsiz katman: 3.000 mail/ay, 100/gün).
2. **Domains → Add Domain** → `takaslat.com`, **region: Ireland (eu-west-1)**.

   > Region, maillerin hangi coğrafyadan gönderildiğini belirler; kullanıcılar
   > Türkiye'de olduğu için en yakın seçenek İrlanda. **Sonradan değiştirilemez** —
   > değiştirmek için domaini silip yeniden eklemek ve DNS kayıtlarını yenilemek
   > gerekir, o yüzden DNS'e girişmeden önce doğru region'ı seç.
   >
   > Region yalnızca gönderimi etkiler: hesap verisi, loglar ve mail metadata'sı
   > hangi region seçilirse seçilsin Resend tarafında ABD'de tutulur.

3. Resend'in verdiği **SPF (TXT)**, **DKIM (TXT)** ve **DMARC** kayıtlarını
   alan adının DNS panelinde oluştur. Doğrulama genelde 5–30 dakika sürer.
4. **API Keys → Create API Key** → `re_...` anahtarını kopyala.

> Alan adını doğrulamadan `onboarding@resend.dev` ile yalnızca kendi adresine
> test maili atabilirsin; gerçek kullanıcılara gönderim için doğrulama şart.

## 2. Migration'ı çalıştır

Supabase Dashboard → SQL Editor → migration dosyasının içeriğini yapıştır → Run.

## 3. Fonksiyonu deploy et

Dashboard → Edge Functions → Deploy a new function → isim `notify-email`,
`index.ts` içeriğini yapıştır. Ya da CLI ile:

```bash
supabase functions deploy notify-email --no-verify-jwt
```

`--no-verify-jwt` gerekli: çağrıyı kullanıcı değil, veritabanı webhook'u yapıyor.
Yetkilendirme paylaşılan gizli anahtarla sağlanır (aşağıda).

## 4. Secret'ları tanımla

Dashboard → Edge Functions → Manage secrets:

| Secret | Değer |
| --- | --- |
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | `Takaslat <bildirim@takaslat.com>` |
| `NOTIFY_WEBHOOK_SECRET` | rastgele uzun bir dize (aşağıda üretiliyor) |
| `SITE_URL` | `https://www.takaslat.com` |

Gizli anahtar üretmek için:

```bash
openssl rand -hex 32
```

`SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` edge function ortamında hazır gelir,
elle eklemeye gerek yok.

## 5. Database Webhook'u bağla

Dashboard → Database → Webhooks → **Create a new hook**:

- **Name**: `notification_email`
- **Table**: `public.notifications`
- **Events**: yalnızca `Insert`
- **Type**: HTTP Request → `POST`
- **URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/notify-email`
- **HTTP Headers**:
  - `Content-Type: application/json`
  - `x-notify-secret: <NOTIFY_WEBHOOK_SECRET ile aynı değer>`

Anahtar eşleşmezse fonksiyon 401 döner ve mail gitmez — dışarıdan sahte istekle
kullanıcılara mail attırılmasını bu engeller.

## 6. Test

1. İki farklı hesapla giriş yap, birinden diğerinin ilanına teklif ver.
2. Alıcının çanında bildirim belirmeli (realtime).
3. Aynı anda mail düşmeli.
4. Gitmezse: Edge Functions → `notify-email` → Logs. Sık görülenler:
   - `401` → webhook başlığındaki gizli anahtar secret ile aynı değil.
   - `Resend hatası (403)` → alan adı henüz doğrulanmamış.
   - `skipped: opted out` → kullanıcı Ayarlar'dan mailleri kapatmış.

## Davranış notları

- **Tür süzgeci**: yalnızca `offer`, `message`, `status`, `moderation` türleri
  mail olur. `system` ve `wishlist` uygulama içinde kalır.
- **Sohbet boğmaz**: aynı teklif için okunmamış bir mesaj bildirimi dururken
  yenisi üretilmez (trigger seviyesinde), yani hızlı yazışmada tek mail gider.
- **Çift gönderim yok**: mail atıldığında `notifications.email_sent_at` işaretlenir.
- **KVKK**: mail yalnızca kullanıcının kendi hesap hareketi için gider, pazarlama
  içeriği taşımaz; yine de Ayarlar'dan tek tıkla kapatılabilir.
