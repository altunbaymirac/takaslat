# Takaslat AI Edge Function (DeepSeek)

Üç AI görevini tek fonksiyonda toplar: `describe`, `estimate`, `quality`.
Frontend `supabase.functions.invoke('ai', { body: { action, payload } })` ile çağırır.

## Neden Edge Function?

API key tarayıcıya **asla** sızmaz — sunucuda gizli kalır. Frontend'den doğrudan
DeepSeek çağrılsaydı, anahtar herkesin görebileceği şekilde açığa çıkardı.

## Kurulum (tek seferlik)

1. **DeepSeek API key al** → https://platform.deepseek.com → API Keys (`sk-...`)

2. **Supabase CLI kur** (yoksa):
   ```bash
   npm install -g supabase
   ```

3. **Projeye bağlan** (PROJECT_REF Supabase Dashboard → Settings → General'da):
   ```bash
   supabase login
   supabase link --project-ref PROJECT_REF
   ```

4. **Secret'ı ayarla** (anahtar burada gizli kalır):
   ```bash
   supabase secrets set DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
   ```

5. **Deploy et**:
   ```bash
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
