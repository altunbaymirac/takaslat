# Takaslat Mail Kurulumu (Resend)

Takaslat'ta **iki ayrı mail sistemi** var. İkisi de Resend üzerinden gider ama
farklı yerlerden ayarlanır:

| | Hesap mailleri | Bildirim mailleri |
|---|---|---|
| Ne gönderir | Kayıt doğrulama, şifre sıfırlama | Yeni teklif, mesaj, ilan sonucu |
| Kim gönderir | Supabase Auth | `notify-email` edge function |
| Nereden ayarlanır | Supabase → Authentication → SMTP | Edge Functions + Database Webhook |
| Kurulmazsa | **Kullanıcılara hiç mail gitmez** | Sadece site içi çan çalışır |

Aynı Resend API anahtarı ikisinde de kullanılır.

---

## 0. Ön koşul: Resend

- [x] `takaslat.com` domaini Resend'de **Verified** (tamam).
- [ ] **API Keys → Create API Key**
  - Name: `takaslat-production`
  - Permission: **Sending access**
  - Domain: `takaslat.com`
  - Çıkan `re_...` anahtarını bir yere kopyala — bir daha gösterilmez.

---

## ÖNCE: bot koruması (SMTP'den önce yapılmalı)

Ağustos–Eylül'de kayıt formu bir botla doldurularak sahte hesaplar açıldı
(rastgele isimler, Gmail nokta hilesi adresleri, hepsi "Adana").
Custom SMTP açıldığı anda **her bot kaydı gerçek bir doğrulama maili
tetikler.** Bu adresler ya yok ya da başkasına ait; geri dönen ve spam'e
işaretlenen mailler Resend'deki domain itibarını düşürür, hesap askıya
alınabilir, ücretsiz kota (günde 100) botlara gider.

Bu yüzden sıra: **Turnstile → sonra SMTP.**

Kayıt formunda hesap gerektirmeyen bir ilk katman (görünmez bal küpü alanı
ve süre tuzağı) zaten devrede. Asıl koruma Cloudflare Turnstile — Supabase
bunu sunucuda doğruladığı için formu atlayıp API'ye doğrudan vuran bot da
geçemez.

### Kurulum — SIRA ÖNEMLİ

1. **Cloudflare** (ücretsiz hesap) → **Turnstile → Add widget**
   - Widget name: `Takaslat`
   - Hostnames: `takaslat.com`, `www.takaslat.com`
   - Widget mode: **Managed**
   - Çıkan **Site Key** ve **Secret Key**'i kopyala.
2. **Vercel** → Project → Settings → Environment Variables:
   `VITE_TURNSTILE_SITE_KEY` = Site Key → **Redeploy**.
3. **Kontrol:** `/register` ve `/login` sayfalarında "robot değilim" kutusu
   görünmeli ve işaretlenince buton aktifleşmeli. **Görmeden 4. adıma geçme.**
4. **Supabase** → Authentication → **Attack Protection** (eski adı: Bot and
   Abuse Protection) → **Enable Captcha protection** → Provider: **Turnstile**
   → Secret Key → Save.
5. Çıkış yapıp tekrar giriş yap, sonra yeni bir hesapla kaydolmayı dene.

> 4. adımı 2–3'ten önce yaparsan, site captcha göndermediği için **kimse
> giriş yapamaz.** Böyle olursa Supabase'te korumayı kapatman yeterli.

### Mevcut bot hesaplarını temizleme

`supabase/bot_accounts.sql` → önce özet ve listeyi çalıştır, listeyi incele;
içinde gerçek kullanıcı olmadığından eminsen en alttaki silme bloğunu aç.

---

## 1. Hesap mailleri — EN ACİL

### Neden acil

Supabase'in kendi mail sunucusu **yalnızca proje ekibindeki adreslere** mail
gönderir ve saatte **2 mail** ile sınırlıdır (Supabase dokümanı: *Send emails
with custom SMTP*). Yani özel SMTP kurulu değilse, siteye kaydolan bir kullanıcı
doğrulama mailini **hiç almaz**; şifremi unuttum da çalışmaz.

Kontrol: Supabase → **Authentication → Emails → SMTP Settings**.
"Enable Custom SMTP" kapalıysa, şu an kullanıcılara hiç mail gitmiyor.

### Kurulum

**Authentication → Emails → SMTP Settings → Enable Custom SMTP:**

| Alan | Değer |
|---|---|
| Sender email | `no-reply@takaslat.com` |
| Sender name | `Takaslat` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `re_...` (Resend API anahtarı) |

Kaydet.

**Authentication → Rate Limits:** özel SMTP açılınca e-posta limiti
yükseltilebilir hale gelir. Saatte en az `30` yap; yoksa aynı anda birkaç kişi
kaydolduğunda mailler takılır.

**Authentication → URL Configuration** (maildeki bağlantıların doğru yere
gitmesi için):

| Alan | Değer |
|---|---|
| Site URL | `https://www.takaslat.com` |
| Redirect URLs | `https://www.takaslat.com/**` |

Site URL `localhost` kalmışsa, maildeki bağlantılar kullanıcıyı çalışmayan bir
adrese götürür.

### Türkçe şablonlar

Varsayılan şablonlar İngilizce. **Authentication → Emails → Templates:**

| Şablon | Konu | İçerik |
|---|---|---|
| Confirm signup | `Takaslat hesabını doğrula` | `email-templates/confirm-signup.html` |
| Reset password | `Takaslat şifreni yenile` | `email-templates/reset-password.html` |

Dosyanın tamamını "Message body" alanına yapıştır.

### Test

1. Kişisel bir adresle siteye yeni kayıt ol → doğrulama maili gelmeli.
2. Ayarlar → **Şifremi değiştir** → şifre yenileme maili gelmeli.
3. Resend → **Emails** sayfasında ikisini de "Delivered" olarak görmelisin.
   Burada görünmüyorsa mail Resend'den değil, hâlâ Supabase'in kendi
   sunucusundan gidiyor demektir.

---

## 2. Bildirim mailleri

Önkoşul: `20260923190000_notification_triggers_and_email.sql` migration'ı
uygulanmış olmalı (uygulandı — site içi çan bu sayede çalışıyor).

### 2a. Gizli anahtar üret

Webhook'un gerçekten Supabase'den geldiğini doğrulamak için rastgele bir dize:

```bash
openssl rand -hex 32
```

### 2b. Fonksiyonu deploy et

Supabase → **Edge Functions → Deploy a new function → Via Editor**:

- Name: `notify-email`
- İçerik: `supabase/functions/notify-email/index.ts` dosyasının tamamı
- Deploy'dan sonra fonksiyonun ayarlarında **Verify JWT** kapalı olmalı
  (çağrıyı kullanıcı değil veritabanı yapıyor; yetki 2a'daki anahtarla).

### 2c. Secret'lar

**Edge Functions → Secrets:**

| Secret | Değer |
|---|---|
| `RESEND_API_KEY` | `re_...` |
| `RESEND_FROM` | `Takaslat <bildirim@takaslat.com>` |
| `NOTIFY_WEBHOOK_SECRET` | 2a'da ürettiğin dize |
| `SITE_URL` | `https://www.takaslat.com` |

### 2d. Webhook

**Database → Webhooks → Create a new hook:**

- Name: `notification_email`
- Table: `notifications`, Events: yalnızca **Insert**
- Type: **HTTP Request**, Method: `POST`
- URL: `https://kozvhbepwboaxpksgqaj.supabase.co/functions/v1/notify-email`
- HTTP Headers:
  - `Content-Type`: `application/json`
  - `x-notify-secret`: 2a'da ürettiğin dize (secret ile birebir aynı)

### Test

İki farklı hesapla giriş yap, birinden diğerinin ilanına teklif ver.
Alıcının çanında bildirim belirmeli **ve** maili gelmeli.

Gelmezse Edge Functions → `notify-email` → **Logs**:

| Logdaki | Anlamı |
|---|---|
| `401` | Webhook başlığındaki anahtar secret ile aynı değil |
| `Resend hatası (403)` | API anahtarı yanlış veya domain doğrulanmamış |
| `skipped: opted out` | Kullanıcı Ayarlar'dan maili kapatmış (normal) |
| Hiç log yok | Webhook kurulmamış veya yanlış tabloya bağlı |

---

## 3. İsteğe bağlı: KVKK hesap silme

Ayarlar'daki **Hesabımı sil** satırı, Vercel'de şu ortam değişkeni tanımlıysa
görünür (Vercel → Project → Settings → Environment Variables):

```
VITE_LEGAL_CONTACT_EMAIL=kvkk@takaslat.com
```

Tanımladıktan sonra yeniden deploy gerekir. Bu adresi Resend'de değil, gerçekten
okuyacağın bir posta kutusunda aç (ör. domain sağlayıcının mail yönlendirmesi).
