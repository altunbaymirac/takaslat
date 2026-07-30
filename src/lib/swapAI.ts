import type { Listing, AIResponse } from '../types';

// ─── Keyword maps ────────────────────────────────────────────────────────────

const SUV_KEYWORDS = ['suv', 'crossover', 'duster', 'tucson', 'qashqai', 'tiguan', 't-roc', 'sportage', 'eclipse', 'kuga', '3008', 'puma', 'karoq', 'rav4', 'cx-5', 'compass'];
const SEDAN_KEYWORDS = ['sedan', 'corolla', 'civic', 'megane', 'passat', 'octavia', 'a4', 'c180', '320i', '520d', 'focus', 'superb', '508'];
const HATCHBACK_KEYWORDS = ['hatchback', 'i20', 'clio', 'polo', 'golf', 'ibiza', 'yaris', 'fiesta'];
const GERMAN_KEYWORDS = ['alman', 'bmw', 'mercedes', 'audi', 'volkswagen', 'vw', 'opel'];
const JAPANESE_KEYWORDS = ['japon', 'toyota', 'honda', 'nissan', 'mitsubishi', 'mazda', 'suzuki'];
const HYBRID_KEYWORDS = ['hibrit', 'hybrid', 'elektrik', 'electric', 'e-tech'];
const DIESEL_KEYWORDS = ['dizel', 'diesel', 'tdi', 'crdi'];

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scorePriceMatch(source: Listing, target: Listing): { pts: number; reason: string | null } {
  if (!source.estimatedValue || source.estimatedValue === 0) return { pts: 10, reason: null };
  const diff = Math.abs(source.estimatedValue - target.estimatedValue);
  const ratio = diff / source.estimatedValue;
  if (ratio <= 0.04) return { pts: 40, reason: 'Fiyatlar neredeyse eşit' };
  if (ratio <= 0.10) return { pts: 35, reason: `Fiyat farkı düşük (${pct(ratio)})` };
  if (ratio <= 0.20) return { pts: 28, reason: `Fiyat aralığı uyuşuyor (${pct(ratio)} fark)` };
  if (ratio <= 0.30) return { pts: 16, reason: `Fiyat farkı makul (${pct(ratio)})` };
  if (ratio <= 0.45) return { pts: 7, reason: null };
  return { pts: 2, reason: null };
}

function scorePreference(wantedFor: string, target: Listing): { pts: number; reasons: string[] } {
  const w = (wantedFor ?? '').toLowerCase();
  const brand = (target.vehicleDetails?.brand ?? '').toLowerCase();
  const model = (target.vehicleDetails?.model ?? '').toLowerCase();
  const body = (target.vehicleDetails?.bodyType ?? '').toLowerCase();
  const fuel = (target.vehicleDetails?.fuel ?? '').toLowerCase();
  const reasons: string[] = [];
  let pts = 0;

  if (brand && w.includes(brand)) { pts += 25; reasons.push(`İstenen marka: ${target.vehicleDetails?.brand}`); }
  else if (model && w.includes(model.split(' ')[0])) { pts += 22; reasons.push('İstenen model eşleşiyor'); }
  else if (SUV_KEYWORDS.some(k => w.includes(k)) && (body.includes('suv') || body.includes('crossover'))) {
    pts += 18; reasons.push('SUV/crossover tercihi uyuşuyor');
  } else if (SEDAN_KEYWORDS.some(k => w.includes(k)) && body.includes('sedan')) {
    pts += 18; reasons.push('Sedan tercihi uyuşuyor');
  } else if (HATCHBACK_KEYWORDS.some(k => w.includes(k)) && body.includes('hatchback')) {
    pts += 16; reasons.push('Hatchback tercihi uyuşuyor');
  }

  if (GERMAN_KEYWORDS.some(k => w.includes(k)) && GERMAN_KEYWORDS.slice(1).includes(brand)) {
    pts += 8; reasons.push('Alman marka tercihi');
  }
  if (JAPANESE_KEYWORDS.some(k => w.includes(k)) && JAPANESE_KEYWORDS.slice(1).includes(brand)) {
    pts += 8; reasons.push('Japon marka tercihi');
  }
  if (HYBRID_KEYWORDS.some(k => w.includes(k)) && fuel.includes('hibrit')) {
    pts += 10; reasons.push('Hibrit tercihi uyuşuyor');
  }
  if (DIESEL_KEYWORDS.some(k => w.includes(k)) && fuel.includes('dizel')) {
    pts += 8; reasons.push('Dizel tercihi uyuşuyor');
  }

  return { pts, reasons };
}

function scoreLocation(source: Listing, target: Listing): { pts: number; reason: string | null } {
  if (source.city === target.city) return { pts: 18, reason: `Aynı şehir (${source.city})` };
  const nearby: Record<string, string[]> = {
    'İstanbul': ['Bursa', 'Kocaeli'],
    'Bursa': ['İstanbul', 'Kocaeli'],
    'Kocaeli': ['İstanbul', 'Bursa'],
    'Ankara': ['Kayseri', 'Eskişehir'],
    'Kayseri': ['Ankara'],
    'Eskişehir': ['Ankara'],
  };
  if (nearby[source.city]?.includes(target.city)) return { pts: 8, reason: 'Yakın şehir' };
  return { pts: 3, reason: null };
}

function scoreVehicle(target: Listing): { pts: number; reasons: string[] } {
  if (!target.vehicleDetails) return { pts: 10, reasons: [] };
  const km = target.vehicleDetails.km ?? 0;
  const year = target.vehicleDetails.year ?? 0;
  const hasAccidentRecord = target.vehicleDetails.hasAccidentRecord ?? false;
  const reasons: string[] = [];
  let pts = 0;

  const condPts: Record<string, number> = { 'Mükemmel': 12, 'İyi': 9, 'Orta': 5, 'Yıpranmış': 1 };
  pts += condPts[target.condition] ?? 5;

  if (km > 0 && km < 50_000)       { pts += 8; reasons.push('Düşük kilometre'); }
  else if (km > 0 && km < 80_000)  { pts += 5; }
  else if (km > 150_000)           { pts -= 4; }

  if (year >= 2021)       { pts += 6; reasons.push(`${year} model yeni araç`); }
  else if (year >= 2018)  { pts += 3; }

  if (hasAccidentRecord) { pts -= 8; reasons.push('⚠ Hasar kaydı var'); }
  else                   { pts += 4; reasons.push('Hasar kaydı yok'); }

  return { pts, reasons };
}

// ─── Negotiation tips ────────────────────────────────────────────────────────

function negotiationTip(source: Listing, target: Listing): string {
  const diff = target.estimatedValue - source.estimatedValue;
  const absDiff = Math.abs(diff);

  if (absDiff < 30_000) return 'Fiyatlar çok yakın, nakit fark ödemeden takası teklif edebilirsin.';
  if (diff > 0) {
    if (absDiff < 80_000) return `Aradaki fark yaklaşık ${fmt(absDiff)}. Karşı taraftan %10-15 indirim isteyebilirsin.`;
    return `${fmt(absDiff)} fark var. Aracının bakım geçmişini öne çıkarırsan pazarlıkta avantaj sağlarsın.`;
  }
  if (absDiff < 80_000) return `Sen ${fmt(absDiff)} daha değerli bir araç sunuyorsun, nakit fark isteyebilirsin.`;
  return `${fmt(absDiff)} avantajın var. Karşı tarafa nakit fark ya da ekstra aksesuar teklif edebilirsin.`;
}

// ─── General query handler (no listing context) ──────────────────────────────

function buildGeneralMessage(query: string): string | null {
  const q = query.toLowerCase();

  if (q.includes('müzakere') || q.includes('pazarlık') || q.includes('taktik') || q.includes('nasıl pazarlık')) {
    return `Takasta işe yarayan birkaç tüyo:\n\n1. **Belgelerini hazırla** — bakım fişleri, ekspertiz raporu işe yarar\n2. **Piyasayı araştır** — sahibinden.com'da son satışlara bak\n3. **İlk teklifi %10 düşük ver** — yükseltmek için yer bırak\n4. **Aynı şehirde buluşmaya çalış** — lojistik kolaylaşır\n5. **50-100k arası fark** çoğu zaman kabul görür`;
  }
  if (q.includes('marka') || q.includes('güvenilir') || q.includes('iyi mi') || q.includes('alınır')) {
    return `En çok işlem gören markalar: **Toyota, Honda, Volkswagen, Renault, Ford**.\n\n- **Toyota/Honda** — bakım maliyeti düşük, değer kaybı az\n- **VW/Skoda** — konforlu ama servisi pahalı\n- **Renault/Dacia** — uygun fiyat, yaygın servis ağı\n\nBir ilan sayfasını açıp benden analiz istersen o araca özel yorum yapabilirim.`;
  }
  if (q.includes('nasıl çalış') || q.includes('takas nedir') || q.includes('ne yapacağım')) {
    return `Takaslat'ta takas şu şekilde işliyor:\n\n1. **İlanını ver** — aracın hakkında bilgileri gir\n2. **Teklifleri bekle** — ilgilenenlerin tekliflerini al\n3. **Teklif gönder** — beğendiğin bir ilana sen de teklif at\n4. **Anlaşın** — uygulama üzerinden mesajlaşın, buluşun`;
  }
  if (q.includes('fiyat') || q.includes('değer') || q.includes('analiz')) {
    return `İdeal takas aralığı genelde **%15-20 fark** olarak kabul görür. ${fmt(200_000)} üzerindeki farklar nakit tamamlama gerektirir.\n\nBir ilan sayfasında benden fiyat analizi istersen sana özel hesaplama yaparım.`;
  }

  return null;
}

// ─── Message generator ───────────────────────────────────────────────────────

function buildMessage(query: string, source: Listing | null, results: ReturnType<typeof score>[]): string {
  // Önce genel sorguları dene (ilan bağlamı olmadan da çalışır)
  const generalReply = buildGeneralMessage(query);

  if (!source) {
    if (generalReply) return generalReply;
    if (results.length === 0) {
      return 'Hangi araç için eşleşme arıyorsun? Bir ilan sayfasını açıp buradan "En iyi eşleşmeleri bul" dersen sana özel sonuçlar getirebilirim.';
    }
    return `Aramanla ilgili **${results.length} ilan** buldum. Aşağıda detaylar var.`;
  }

  // İlan bağlamlı sorgular
  if (results.length === 0) {
    if (!source) {
      return [
        'Net eşleşme çıkarabilmem için hangi ilanı takasa koyduğunu veya ne aradığını yazman gerekiyor.',
        '',
        'Örnek:',
        '- "2018 Civic var, SUV bakıyorum"',
        '- "İstanbulda 900 bine kadar otomatik araç öner"',
        '- "Bu ilan için daha düşük fark isteyenleri bul"',
      ].join('\n');
    }
    return 'Belirttiğin kritere uyan net bir eşleşme bulamadım. Marka, şehir, bütçe veya nakit fark aralığını biraz genişletmeyi deneyebilirsin.';
  }

  const top = results[0];
  const topScore = top.compatibilityScore;

  const intro = topScore >= 75
    ? `**${source.title}** için güçlü eşleşmeler buldum. En iyi sonuç **%${topScore}** uyumlulukla aşağıda.`
    : topScore >= 50
    ? `**${source.title}** için ${results.length} seçenek buldum. Fiyat farklarına bir göz at.`
    : `**${source.title}** için çok güçlü bir eşleşme yok ama ${results.length} ilan var, bakabilirsin.`;

  const priceLine = `\n\nAracının tahmini değeri **${fmt(source.estimatedValue)}**. ` +
    (top.priceDiff > 0
      ? `En iyi eşleşmede **${fmt(top.priceDiff)} ek ödeme** gerekebilir.`
      : top.priceDiff < 0
      ? `En iyi eşleşmeden **${fmt(Math.abs(top.priceDiff))} nakit fark** isteyebilirsin.`
      : 'Fiyatlar neredeyse eşit, nakit fark gerekmez.');

  // Genel sorgu da varsa ekle (örn. "pazarlık nasıl yapılır" + ilan açıkken)
  const extra = generalReply ? `\n\n---\n${generalReply}` : '';

  return intro + priceLine + extra;
}

// ─── Main scorer ─────────────────────────────────────────────────────────────

function score(source: Listing, target: Listing) {
  const price = scorePriceMatch(source, target);
  const pref = scorePreference(source.wantedFor, target);
  const loc = scoreLocation(source, target);
  const veh = scoreVehicle(target);

  const total = price.pts + pref.pts + loc.pts + veh.pts;
  // Max mümkün puan ~123 (40+35+18+30) → 100'e çevir, max 95
  const normalized = Math.min(Math.max(Math.round(total / 1.23), 5), 95);

  const reasons = [
    price.reason,
    ...pref.reasons,
    loc.reason,
    ...veh.reasons,
  ].filter(Boolean).slice(0, 3) as string[];

  if (reasons.length === 0) reasons.push('Genel kategori uyumu');

  return {
    listingId: target.id,
    compatibilityScore: normalized,
    reasons,
    priceDiff: target.estimatedValue - source.estimatedValue,
    negotiationTip: negotiationTip(source, target),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SwapAIRequest {
  currentListing: Listing | null;
  allListings: Listing[];
  userQuery: string;
  conversationHistory?: { role: string; content: string }[];
}

export function runSwapAI(req: SwapAIRequest): AIResponse {
  const { currentListing, allListings, userQuery } = req;

  const source = currentListing ?? inferSourceFromQuery(userQuery, allListings);

  if (!source) {
    return {
      message: buildMessage(userQuery, null, []),
      suggestions: [],
    };
  }

  const candidates = allListings
    .filter((l) => l.id !== source.id && l.ownerId !== source.ownerId)
    .map((l) => score(source, l))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 5);

  return {
    message: buildMessage(userQuery, source, candidates),
    suggestions: candidates,
  };
}

// Sorgudan kaynak ilan tahmin et (sadece açık marka/model eşleşmelerinde)
function inferSourceFromQuery(query: string, listings: Listing[]): Listing | null {
  const q = query.toLowerCase();
  for (const l of listings) {
    const brand = (l.vehicleDetails?.brand ?? '').toLowerCase();
    const model = (l.vehicleDetails?.model ?? '').toLowerCase();
    if (brand && q.includes(brand)) return l;
    if (model && q.includes(model.split(' ')[0])) return l;
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

function pct(ratio: number) {
  return `%${Math.round(ratio * 100)}`;
}
