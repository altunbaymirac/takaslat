// ============================================================
// Takaslat — AI Edge Function (DeepSeek)
// Tek fonksiyon, üç görev: action ile yönlendirilir
//   - describe : ilan açıklaması üret
//   - estimate : değer tahmini (gerçek ilan verisi + LLM)
//   - quality  : ilan kalite kontrolü
//
// Deploy:  supabase functions deploy ai
// Secret:  supabase secrets set DEEPSEEK_API_KEY=sk-xxxx
//
// GÜVENLİK: API key burada (sunucuda) gizli kalır, tarayıcıya sızmaz.
// KVKK: yalnızca teknik veri (marka/model/yıl/km) gönderilir, kişisel veri YOK.
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// ─── DeepSeek çağrısı ─────────────────────────────────────────
async function callDeepSeek(
  messages: { role: string; content: string }[],
  jsonMode = false,
): Promise<string> {
  const key = Deno.env.get('DEEPSEEK_API_KEY');
  if (!key) throw new Error('DEEPSEEK_API_KEY tanımlı değil (supabase secrets set)');

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: jsonMode ? 0.3 : 0.7,
      max_tokens: 800,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DeepSeek hata ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

// ─── 1. AÇIKLAMA ÜRET ─────────────────────────────────────────
async function describe(p: Record<string, unknown>) {
  const specs = [
    `Marka: ${p.brand}`,
    `Model: ${p.model}`,
    p.year ? `Yıl: ${p.year}` : '',
    p.km ? `KM: ${p.km}` : '',
    p.fuel ? `Yakıt: ${p.fuel}` : '',
    p.transmission ? `Şanzıman: ${p.transmission}` : '',
    p.color ? `Renk: ${p.color}` : '',
    p.bodyType ? `Kasa: ${p.bodyType}` : '',
    p.condition ? `Durum: ${p.condition}` : '',
    p.hasAccidentRecord ? 'Hasar kaydı: VAR' : 'Hasar kaydı: YOK',
  ].filter(Boolean).join(', ');

  const content = await callDeepSeek([
    {
      role: 'system',
      content:
        'Sen bir Türk araç takas platformu için ilan metni yazarısın. ' +
        'Doğal, samimi ve güven veren Türkçe ile 3-4 cümlelik bir ilan açıklaması yaz. ' +
        'Abartma, yalan özellik ekleme. Takasa açık olduğunu vurgula. Sadece açıklama metnini döndür.',
    },
    { role: 'user', content: `Şu araç için ilan açıklaması yaz: ${specs}` },
  ]);

  return { description: content.trim(), basedOnSimilar: 0 };
}

// ─── 2. DEĞER TAHMİNİ (gerçek veri + LLM) ─────────────────────
async function estimate(p: Record<string, unknown>) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Aynı markadaki aktif ilanları çek (varsa modele göre daralt)
  const { data: rows } = await supabase
    .from('listings')
    .select('estimated_value, year, km, model')
    .eq('is_active', true)
    .eq('brand', p.brand as string)
    .limit(50);

  let similar = (rows ?? []) as { estimated_value: number; year: number | null; km: number | null; model: string | null }[];
  // Model eşleşmesi varsa onları tercih et
  if (p.model) {
    const m = (p.model as string).toLowerCase();
    const modelMatch = similar.filter((r) => (r.model ?? '').toLowerCase().includes(m.split(' ')[0]));
    if (modelMatch.length >= 3) similar = modelMatch;
  }

  // Yeterli gerçek veri varsa: istatistiksel taban
  if (similar.length >= 3) {
    const values = similar.map((r) => r.estimated_value).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    // Yıl/km ile basit ayarlama
    let estimated = median;
    if (p.year && similar.some((r) => r.year)) {
      const avgYear = similar.reduce((s, r) => s + (r.year ?? 0), 0) / similar.filter((r) => r.year).length;
      estimated += (Number(p.year) - avgYear) * (median * 0.04);
    }
    if (p.hasAccidentRecord) estimated *= 0.88;
    estimated = Math.round(estimated / 1000) * 1000;
    const low = Math.round((estimated * 0.9) / 1000) * 1000;
    const high = Math.round((estimated * 1.1) / 1000) * 1000;
    return {
      estimated, low, high,
      basedOn: similar.length,
      message: `${similar.length} benzer ilanın verisine göre hesaplandı.`,
    };
  }

  // Yeterli veri yoksa: LLM'den kaba tahmin (düşük güven)
  const raw = await callDeepSeek([
    {
      role: 'system',
      content:
        'Sen Türkiye ikinci el araç piyasası uzmanısın. Verilen araç için güncel TL cinsinden ' +
        'tahmini değer aralığı ver. Enflasyon yüksek, dikkatli ol. SADECE şu JSON formatında yanıt ver: ' +
        '{"estimated": number, "low": number, "high": number}',
    },
    {
      role: 'user',
      content: `${p.year ?? ''} ${p.brand} ${p.model ?? ''}, ${p.km ?? '?'} km, hasar: ${p.hasAccidentRecord ? 'var' : 'yok'}`,
    },
  ], true);

  try {
    const parsed = JSON.parse(raw);
    return {
      estimated: parsed.estimated ?? null,
      low: parsed.low ?? null,
      high: parsed.high ?? null,
      basedOn: 0,
      message: 'Piyasa tahmini (benzer ilan az, düşük güven).',
    };
  } catch {
    return { estimated: null, low: null, high: null, basedOn: 0, message: 'Değer tahmin edilemedi.' };
  }
}

// ─── 3. KALİTE KONTROL ────────────────────────────────────────
async function quality(p: Record<string, unknown>) {
  const draft = (p.draft ?? {}) as Record<string, unknown>;
  const raw = await callDeepSeek([
    {
      role: 'system',
      content:
        'Sen bir Türk takas platformu için ilan kalite denetçisisin. Verilen ilan taslağını değerlendir. ' +
        'SADECE şu JSON formatında yanıt ver: ' +
        '{"score": 0-100 arası sayı, "grade": "A"|"B"|"C"|"D", "fixes": ["öneri1","öneri2"], "improvedDescription": "iyileştirilmiş açıklama"}. ' +
        'fixes en fazla 4 madde. improvedDescription mevcut açıklamayı Türkçe iyileştirsin.',
    },
    { role: 'user', content: `İlan taslağı: ${JSON.stringify(draft).slice(0, 1500)}` },
  ], true);

  try {
    const parsed = JSON.parse(raw);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 60)),
      grade: parsed.grade ?? 'B',
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.slice(0, 4) : [],
      improvedDescription: parsed.improvedDescription ?? '',
    };
  } catch {
    return { score: 60, grade: 'C', fixes: ['AI yanıtı çözümlenemedi'], improvedDescription: '' };
  }
}

// ─── Router ───────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { action, payload } = await req.json();
    let result: unknown;
    if (action === 'describe')      result = await describe(payload ?? {});
    else if (action === 'estimate') result = await estimate(payload ?? {});
    else if (action === 'quality')  result = await quality(payload ?? {});
    else return json({ error: 'Bilinmeyen action' }, 400);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
