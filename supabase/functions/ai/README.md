# Takaslat AI Edge Function (DeepSeek)

Üç AI görevini tek fonksiyonda toplar: `describe`, `estimate`, `quality`.
Frontend `supabase.functions.invoke('ai', { body: { action, payload } })` ile çağırır.

## Neden Edge Function?

API key tarayıcıya **asla** sızmaz — sunucuda gizli kalır. Frontend'den doğrudan
DeepSeek çağrılsaydı, anahtar herkesin görebileceği şekilde açığa çıkardı.

## Önce: rate-limit tablosu

`supabase/ai_rate_limit.sql` dosyasını Supabase SQL Editor'da çalıştır
(kota kontrolü için `ai_usage` tablosunu oluşturur).

## Kurulum — Yol A: Dashboard (CLI gerekmez, önerilen)

1. **DeepSeek API key al** → https://platform.deepseek.com → API Keys (`sk-...`)
2. **Supabase Dashboard → Edge Functions → "Deploy a new function"**
   - İsim: `ai`
   - `index.ts` içeriğini yapıştır → Deploy
3. **Secret ekle**: Edge Functions → Manage secrets (veya Project Settings →
   Edge Functions → Secrets) → `DEEPSEEK_API_KEY` = `sk-...`
4. Bitti. Uygulamada AI butonları gerçek yanıt verir.

## Kurulum — Yol B: CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref PROJECT_REF      # Dashboard → Settings → General
supabase secrets set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
supabase functions deploy ai
```

## Test

Deploy sonrası uygulamada İlan Ver → araç bilgisi gir → "AI ile yaz" /
"AI ile hesapla" / "Kontrol et" butonları gerçek yanıt vermeli.

## Notlar

- **KVKK**: Yalnızca teknik veri gönderilir (marka/model/yıl/km). İsim, telefon,
  adres gibi kişisel veri DeepSeek'e gitmez.
- **Maliyet**: DeepSeek, GPT-4o'ya kıyasla ~10-30x ucuz. Güncel fiyat:
  https://platform.deepseek.com/pricing
- **Değer tahmini** önce DB'deki gerçek benzer ilanlara bakar (≥3 ilan varsa
  istatistiksel), yoksa LLM'den kaba tahmin alır (düşük güven uyarısıyla).
- Fonksiyon deploy edilmezse frontend hata toast'u gösterir, uygulama çökmez.
