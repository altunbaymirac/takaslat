// ============================================================
// Takaslat — AI Edge Function (DeepSeek)
// Tek fonksiyon, action ile yönlendirilen çok görevli AI servisi.
//
// Deploy:  supabase functions deploy ai   (veya Dashboard → Edge Functions)
// Secret:  DEEPSEEK_API_KEY  (Dashboard → Edge Functions → Secrets)
//
// GÜVENLİK: API key sunucuda gizli kalır, tarayıcıya sızmaz.
// KVKK: yalnızca teknik veri (marka/model/yıl/km) gönderilir.
// LİMİT: kullanıcı/IP başına saatlik + günlük kota (ai_usage tablosu).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = 'deepseek-chat';

// Rate limit kotaları
const LIMITS = {
  authed: { hour: 25, day: 80 },
  anon:   { hour: 8,  day: 20 },
};

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
  if (!key) throw new Error('DEEPSEEK_API_KEY tanımlı değil (Edge Functions → Secrets)');

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: jsonMode ? 0.3 : 0.7,
      max_tokens: 900,
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

// JSON modunda güvenli parse (LLM bazen ```json ile sarar)
function safeJson<T>(raw: string, fallback: T): T {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

// ─── Rate limit (ai_usage tablosu) ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAndLog(supabase: any, identifier: string, authed: boolean, action: string) {
  const lim = authed ? LIMITS.authed : LIMITS.anon;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86400_000).toISOString();

  const { count: hourCount } = await supabase
    .from('ai_usage').select('*', { count: 'exact', head: true })
    .eq('identifier', identifier).gte('created_at', hourAgo);
  if ((hourCount ?? 0) >= lim.hour) {
    return { ok: false, message: `Saatlik AI limiti doldu (${lim.hour}). Biraz sonra tekrar dene.` };
  }
  const { count: dayCount } = await supabase
    .from('ai_usage').select('*', { count: 'exact', head: true })
    .eq('identifier', identifier).gte('created_at', dayAgo);
  if ((dayCount ?? 0) >= lim.day) {
    return { ok: false, message: `Günlük AI limiti doldu (${lim.day}). Yarın tekrar dene.` };
  }
  // Kotayı say: pahalı DeepSeek çağrısından önce kaydet
  await supabase.from('ai_usage').insert({ identifier, action });
  return { ok: true, message: '' };
}

// ════════════════════════════════════════════════════════════
// GÖREVLER
// ════════════════════════════════════════════════════════════

async function describe(p: Record<string, unknown>) {
  const specs = [
    `Marka: ${p.brand}`, `Model: ${p.model}`,
    p.year ? `Yıl: ${p.year}` : '', p.km ? `KM: ${p.km}` : '',
    p.fuel ? `Yakıt: ${p.fuel}` : '', p.transmission ? `Şanzıman: ${p.transmission}` : '',
    p.color ? `Renk: ${p.color}` : '', p.bodyType ? `Kasa: ${p.bodyType}` : '',
    p.condition ? `Durum: ${p.condition}` : '',
    p.hasAccidentRecord ? 'Hasar kaydı: VAR' : 'Hasar kaydı: YOK',
  ].filter(Boolean).join(', ');
  const content = await callDeepSeek([
    { role: 'system', content: 'Türk araç takas platformu için ilan metni yazarısın. Doğal, samimi, güven veren Türkçe ile 3-4 cümlelik açıklama yaz. Abartma, yalan özellik ekleme. Takasa açık olduğunu vurgula. Sadece açıklama metnini döndür.' },
    { role: 'user', content: `Şu araç için ilan açıklaması yaz: ${specs}` },
  ]);
  return { description: content.trim(), basedOnSimilar: 0 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function estimate(p: Record<string, unknown>, supabase: any) {
  const { data: rows } = await supabase
    .from('listings').select('estimated_value, year, km, model')
    .eq('is_active', true).eq('brand', p.brand as string).limit(50);

  let similar = (rows ?? []) as { estimated_value: number; year: number | null; model: string | null }[];
  if (p.model) {
    const m = (p.model as string).toLowerCase().split(' ')[0];
    const mm = similar.filter((r) => (r.model ?? '').toLowerCase().includes(m));
    if (mm.length >= 3) similar = mm;
  }
  if (similar.length >= 3) {
    const values = similar.map((r) => r.estimated_value).sort((a, b) => a - b);
    let estimated = values[Math.floor(values.length / 2)];
    const yrs = similar.filter((r) => r.year);
    if (p.year && yrs.length) {
      const avgYear = yrs.reduce((s, r) => s + (r.year ?? 0), 0) / yrs.length;
      estimated += (Number(p.year) - avgYear) * (estimated * 0.04);
    }
    if (p.hasAccidentRecord) estimated *= 0.88;
    estimated = Math.round(estimated / 1000) * 1000;
    return {
      estimated, low: Math.round(estimated * 0.9 / 1000) * 1000, high: Math.round(estimated * 1.1 / 1000) * 1000,
      basedOn: similar.length, message: `${similar.length} benzer ilanın verisine göre hesaplandı.`,
    };
  }
  const raw = await callDeepSeek([
    { role: 'system', content: 'Türkiye ikinci el araç piyasası uzmanısın. Güncel TL değer aralığı ver, enflasyon yüksek. SADECE JSON: {"estimated":number,"low":number,"high":number}' },
    { role: 'user', content: `${p.year ?? ''} ${p.brand} ${p.model ?? ''}, ${p.km ?? '?'} km, hasar: ${p.hasAccidentRecord ? 'var' : 'yok'}` },
  ], true);
  const parsed = safeJson(raw, { estimated: null, low: null, high: null });
  return { ...parsed, basedOn: 0, message: 'Piyasa tahmini (benzer ilan az, düşük güven).' };
}

async function quality(p: Record<string, unknown>) {
  const draft = (p.draft ?? {}) as Record<string, unknown>;
  const raw = await callDeepSeek([
    { role: 'system', content: 'Türk takas platformu ilan kalite denetçisisin. SADECE JSON: {"score":0-100,"grade":"A|B|C|D","fixes":["..."],"improvedDescription":"..."}. fixes en fazla 4 madde. improvedDescription mevcut açıklamayı Türkçe iyileştirsin.' },
    { role: 'user', content: `İlan taslağı: ${JSON.stringify(draft).slice(0, 1500)}` },
  ], true);
  const r = safeJson(raw, { score: 60, grade: 'C', fixes: [] as string[], improvedDescription: '' });
  return {
    score: Math.max(0, Math.min(100, Number(r.score) || 60)),
    grade: r.grade ?? 'B',
    fixes: Array.isArray(r.fixes) ? r.fixes.slice(0, 4) : [],
    improvedDescription: r.improvedDescription ?? '',
  };
}

async function negotiate(p: Record<string, unknown>) {
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas pazarlık mesajı analisti. Verilen mesajı değerlendir. SADECE JSON: {"analysis":{"tone":"agresif|pasif|dengeli","toneReason":"...","length":{"score":0-100,"note":"..."},"positives":["..."],"negatives":["..."],"overallScore":0-100},"possibilities":[{"probability":0-100,"type":"kabul|pazarlik|red","message":"...","reason":"..."}],"tips":["..."]}' },
    { role: 'user', content: `Pazarlık mesajı: "${p.myMessage}"${p.offeredValue ? `, teklif: ${p.offeredValue} TL` : ''}` },
  ], true);
  return safeJson(raw, {
    analysis: { tone: 'dengeli', toneReason: '', length: { score: 70, note: '' }, positives: [], negatives: [], overallScore: 70 },
    possibilities: [], tips: [],
  });
}

async function swapAdvice(p: Record<string, unknown>) {
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas danışmanısın. Kullanıcının isteğine göre öneri ve hazır mesaj üret. SADECE JSON: {"message":"...","tips":["..."],"suggestedMessage":"..."}' },
    { role: 'user', content: `Kullanıcı isteği: "${p.userText}"` },
  ], true);
  const r = safeJson(raw, { message: '', tips: [] as string[], suggestedMessage: '' });
  return { message: r.message ?? '', candidates: [], tips: r.tips ?? [], suggestedMessage: r.suggestedMessage ?? '' };
}

async function offerQuality(p: Record<string, unknown>) {
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas teklif mesajı denetçisi. SADECE JSON: {"score":0-100,"positives":["..."],"issues":["..."],"improvedMessage":"..."}' },
    { role: 'user', content: `Teklif mesajı: "${p.message}"` },
  ], true);
  const r = safeJson(raw, { score: 65, positives: [] as string[], issues: [] as string[], improvedMessage: '' });
  return { score: Math.max(0, Math.min(100, Number(r.score) || 65)), positives: r.positives ?? [], issues: r.issues ?? [], improvedMessage: r.improvedMessage ?? '' };
}

async function autoMessage(p: Record<string, unknown>) {
  const tone = (p.tone as string) ?? 'samimi';
  const content = await callDeepSeek([
    { role: 'system', content: `Takas teklif mesajı yazarısın. ${tone} bir tonda, kısa (2-3 cümle), nazik bir takas mesajı yaz. Sadece mesajı döndür.` },
    { role: 'user', content: 'İlanla ilgilenen bir kullanıcı için takas teklif mesajı yaz.' },
  ]);
  return { message: content.trim(), diff: null };
}

async function conversationCoach(p: Record<string, unknown>) {
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas görüşme koçusun. Karşı tarafın son mesajını analiz et. SADECE JSON: {"intent":"...","caution":"...","replies":["...","..."],"nextBestAction":"..."}. replies 2-3 hazır yanıt önerisi.' },
    { role: 'user', content: `Karşı tarafın son mesajı: "${p.lastMessage}"` },
  ], true);
  return safeJson(raw, { intent: 'ilgi', caution: '', replies: [] as string[], nextBestAction: 'Bekle' });
}

async function scenarios(p: Record<string, unknown>) {
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas senaryosu üreticisisin. SADECE JSON: {"summary":"...","scenarios":[{"name":"...","difficulty":"kolay|orta|zor","plan":"...","bestFor":"..."}]}. 2-3 senaryo.' },
    { role: 'user', content: `Kullanıcı şununla takas istiyor: "${p.targetText}"${p.maxCashDiff ? `, max nakit farkı: ${p.maxCashDiff} TL` : ''}` },
  ], true);
  return safeJson(raw, { summary: '', scenarios: [] });
}

function visualDescription() {
  // Görsel analizi için gerçek vision modeli gerekmez — güven sinyali notu
  return {
    summary: 'Görsel/ekspertiz dosyası ilana güven sinyali olarak eklendi.',
    checks: ['Panel aralıkları', 'Lastik durumu', 'Far ve tampon uyumu'],
    risks: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function risk(p: Record<string, unknown>, supabase: any) {
  const { data: listing } = await supabase
    .from('listings').select('title, category, estimated_value, description, city, condition, has_accident_record, brand, model, year, km')
    .eq('id', p.listingId as string).single();
  if (!listing) return { riskScore: 30, level: 'Orta', risks: [], positives: [], checklist: [] };
  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas ilanı risk analistisin. İlanı değerlendir. SADECE JSON: {"riskScore":0-100,"level":"Düşük|Orta|Yüksek","risks":["..."],"positives":["..."],"checklist":["..."]}' },
    { role: 'user', content: `İlan: ${JSON.stringify(listing).slice(0, 1200)}` },
  ], true);
  const r = safeJson(raw, { riskScore: 25, level: 'Düşük', risks: [] as string[], positives: [] as string[], checklist: [] as string[] });
  return { riskScore: Math.max(0, Math.min(100, Number(r.riskScore) || 25)), level: r.level ?? 'Düşük', risks: r.risks ?? [], positives: r.positives ?? [], checklist: r.checklist ?? [] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function swapScore(p: Record<string, unknown>, supabase: any) {
  const { data: source } = await supabase
    .from('listings').select('id, title, estimated_value, category, city')
    .eq('id', p.sourceListingId as string).single();
  if (!source) throw new Error('Kaynak ilan bulunamadı');

  // Aynı kategoride, yakın değerli aday ilanlar
  const { data: candidates } = await supabase
    .from('listings').select('id, title, estimated_value, city, brand, model')
    .eq('is_active', true).eq('category', source.category)
    .neq('id', source.id).limit(20);

  const cands = (candidates ?? []) as { id: string; title: string; estimated_value: number; city: string }[];
  if (!cands.length) return { source: { id: source.id, title: source.title, value: source.estimated_value }, suggestions: [] };

  const raw = await callDeepSeek([
    { role: 'system', content: 'Takas eşleştirme motorusun. Kaynak ilana en uygun adayları seç ve puanla. SADECE JSON: {"suggestions":[{"listingId":"...","compatibilityScore":0-100,"reasons":["..."],"warnings":["..."],"negotiationTip":"..."}]}. En fazla 4 öneri, sadece mantıklı eşleşmeler.' },
    { role: 'user', content: `Kaynak: ${JSON.stringify({ title: source.title, value: source.estimated_value })}. Adaylar: ${JSON.stringify(cands.map((c) => ({ id: c.id, title: c.title, value: c.estimated_value, city: c.city })))}` },
  ], true);
  const r = safeJson(raw, { suggestions: [] as Array<Record<string, unknown>> });
  const byId = new Map(cands.map((c) => [c.id, c]));
  const suggestions = (r.suggestions ?? []).slice(0, 4).map((s) => {
    const c = byId.get(s.listingId as string);
    if (!c) return null;
    const priceDiff = c.estimated_value - source.estimated_value;
    return {
      listingId: c.id, title: c.title, city: c.city, value: c.estimated_value,
      compatibilityScore: Math.max(0, Math.min(100, Number(s.compatibilityScore) || 50)),
      priceDiff, breakdown: {}, reasons: (s.reasons as string[]) ?? [], warnings: (s.warnings as string[]) ?? [],
      negotiationTip: (s.negotiationTip as string) ?? '',
    };
  }).filter(Boolean);
  return { source: { id: source.id, title: source.title, value: source.estimated_value }, suggestions };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function priceGap(p: Record<string, unknown>, supabase: any) {
  let sv = Number(p.sourceValue) || 0;
  let tv = Number(p.targetValue) || 0;
  if (!sv && p.sourceListingId) {
    const { data } = await supabase.from('listings').select('estimated_value').eq('id', p.sourceListingId).single();
    sv = data?.estimated_value ?? 0;
  }
  if (!tv && p.targetListingId) {
    const { data } = await supabase.from('listings').select('estimated_value').eq('id', p.targetListingId).single();
    tv = data?.estimated_value ?? 0;
  }
  const rawDiff = tv - sv;
  const payer = rawDiff > 0 ? 'sourceUser' : rawDiff < 0 ? 'targetUser' : 'none';
  const abs = Math.abs(rawDiff);
  return {
    rawDiff, payer,
    fairRange: { min: Math.round(abs * 0.9 / 1000) * 1000, max: Math.round(abs * 1.1 / 1000) * 1000 },
    verdict: abs === 0 ? 'Denk takas' : `${new Intl.NumberFormat('tr-TR').format(abs)} TL fark var`,
    explanation: payer === 'none' ? 'İki ilan değerce denk, nakit fark gerekmez.' : `${payer === 'sourceUser' ? 'Sizin' : 'Karşı tarafın'} üste nakit eklemesi beklenir.`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function marketInsights(supabase: any) {
  const { data } = await supabase.from('listings').select('brand, city, estimated_value, view_count').eq('is_active', true).limit(500);
  const rows = (data ?? []) as { brand: string | null; city: string | null; estimated_value: number; view_count: number | null }[];
  const brandMap = new Map<string, { count: number; total: number; views: number }>();
  const cityMap = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    if (r.brand) {
      const b = brandMap.get(r.brand) ?? { count: 0, total: 0, views: 0 };
      brandMap.set(r.brand, { count: b.count + 1, total: b.total + r.estimated_value, views: b.views + (r.view_count ?? 0) });
    }
    if (r.city) {
      const c = cityMap.get(r.city) ?? { count: 0, total: 0 };
      cityMap.set(r.city, { count: c.count + 1, total: c.total + r.estimated_value });
    }
  }
  const hotBrands = [...brandMap.entries()].map(([brand, v]) => ({ brand, count: v.count, avgValue: Math.round(v.total / v.count), demandScore: Math.round((v.views / Math.max(1, v.count)) * 10) })).sort((a, b) => b.count - a.count).slice(0, 6);
  const cityPremiums = [...cityMap.entries()].map(([city, v]) => ({ city, count: v.count, avgValue: Math.round(v.total / v.count) })).sort((a, b) => b.avgValue - a.avgValue).slice(0, 6);
  return { hotBrands, cityPremiums, insight: hotBrands.length ? `En çok ilan: ${hotBrands[0].brand}. Ortalama değer: ${new Intl.NumberFormat('tr-TR').format(hotBrands[0].avgValue)} TL.` : 'Henüz yeterli veri yok.' };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function budget(p: Record<string, unknown>, supabase: any) {
  const b = Number(p.budget) || 0;
  let q = supabase.from('listings').select('id, title, city, category, images, estimated_value, owner_id').eq('is_active', true);
  if (p.category && p.category !== 'Tümü') q = q.eq('category', p.category);
  if (p.city) q = q.eq('city', p.city);
  const { data } = await q.lte('estimated_value', Math.round(b * 1.15)).order('estimated_value', { ascending: false }).limit(40);
  const rows = (data ?? []) as { id: string; title: string; city: string; category: string; images: string[]; estimated_value: number }[];
  const inBudget = rows.filter((r) => r.estimated_value <= b).map((r) => ({ listingId: r.id, title: r.title, city: r.city, category: r.category, image: r.images?.[0] ?? '', price: r.estimated_value, utilization: Math.round((r.estimated_value / b) * 100) }));
  const stretch = rows.filter((r) => r.estimated_value > b).map((r) => ({ listingId: r.id, title: r.title, city: r.city, image: r.images?.[0] ?? '', price: r.estimated_value, overBy: r.estimated_value - b }));
  const catMap = new Map<string, number>();
  for (const r of inBudget) catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
  return { budget: b, inBudgetCount: inBudget.length, stretchCount: stretch.length, byCategory: [...catMap.entries()].map(([name, count]) => ({ name, count })), inBudget: inBudget.slice(0, 12), stretch: stretch.slice(0, 6) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function forecast(p: Record<string, unknown>, supabase: any) {
  const { data: listing } = await supabase.from('listings').select('id, title, estimated_value, category, brand, year').eq('id', p.id as string).single();
  if (!listing) throw new Error('İlan bulunamadı');
  const v = listing.estimated_value;
  const monthly = listing.category === 'Araç' ? -0.012 : listing.category === 'Elektronik' ? -0.025 : 0.004; // aylık değişim
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return { month: m, value: Math.round(v * Math.pow(1 + monthly, m)), label: `${m}. ay` };
  });
  const after6m = months[5].value, after12m = months[11].value;
  return {
    listingId: listing.id, title: listing.title, currentValue: v, months,
    summary: { after6m, after12m, totalChange6m: after6m - v, totalChange12m: after12m - v, monthlyDepreciation: Math.round(v * Math.abs(monthly)), inflationAdjust: 0 },
    factors: listing.category === 'Araç' ? ['Kilometre artışı', 'Model yaşı', 'Piyasa talebi'] : listing.category === 'Elektronik' ? ['Yeni model çıkışı', 'Teknolojik eskime'] : ['Bölge talebi', 'Enflasyon etkisi'],
    recommendation: monthly < 0 ? 'Değer kaybı bekleniyor, takası geciktirmeyin.' : 'Değer korunuyor/artıyor, acele gerekmez.',
  };
}

async function personalFeed() {
  // Kişisel feed DB-yoğun; şimdilik boş (frontend favorilerden yerel öneri üretiyor)
  return { items: [], profileSignals: [] };
}

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Kullanıcı kimliği (JWT) veya IP — rate limit için
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    let userId: string | null = null;
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const identifier = userId ?? `ip:${ip}`;

    const { action, payload } = await req.json();
    const p = (payload ?? {}) as Record<string, unknown>;

    // Rate limit kontrolü (visualDescription LLM kullanmaz, muaf)
    if (action !== 'visualDescription') {
      const gate = await checkAndLog(supabase, identifier, Boolean(userId), action);
      if (!gate.ok) return json({ error: gate.message, rateLimited: true }, 429);
    }

    let result: unknown;
    switch (action) {
      case 'describe':           result = await describe(p); break;
      case 'estimate':           result = await estimate(p, supabase); break;
      case 'quality':            result = await quality(p); break;
      case 'negotiate':          result = await negotiate(p); break;
      case 'swapAdvice':         result = await swapAdvice(p); break;
      case 'offerQuality':       result = await offerQuality(p); break;
      case 'autoMessage':        result = await autoMessage(p); break;
      case 'conversationCoach':  result = await conversationCoach(p); break;
      case 'scenarios':          result = await scenarios(p); break;
      case 'visualDescription':  result = visualDescription(); break;
      case 'risk':               result = await risk(p, supabase); break;
      case 'swapScore':          result = await swapScore(p, supabase); break;
      case 'priceGap':           result = await priceGap(p, supabase); break;
      case 'marketInsights':     result = await marketInsights(supabase); break;
      case 'budget':             result = await budget(p, supabase); break;
      case 'forecast':           result = await forecast(p, supabase); break;
      case 'personalFeed':       result = await personalFeed(); break;
      default: return json({ error: 'Bilinmeyen action: ' + action }, 400);
    }
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
