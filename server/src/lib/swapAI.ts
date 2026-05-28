/**
 * Takaslat — Sunucu tarafı AI eşleştirme motoru
 *
 * DB'den gelen ham verilerle çalışır; frontend tiplerine bağımlılığı yok.
 * Tüm işlemler sunucuda gerçek zamanlı yapılır.
 *
 * Puanlama ağırlıkları: server/src/lib/aiWeights.ts
 */
import { PRICE_WEIGHTS, LOCATION_WEIGHTS, SCORE_BOOST, PRICE_FILTER } from './aiWeights';
// PREFERENCE_WEIGHTS & VEHICLE_WEIGHTS: değerleri aiWeights.ts'te belgelenmiş, fonksiyonlarda inline kullanılıyor.

// ─── Minimal Listing tipi ─────────────────────────────────────────────────────

export interface AIListing {
  id: string;
  title: string;
  category: string;
  estimatedValue: number;
  description: string;
  wantedFor: string;
  city: string;
  images: string[];
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  condition: string;
  tags: string[];
  createdAt: string | Date;
  vehicleDetails?: {
    brand?: string;
    model?: string;
    year?: number;
    km?: number;
    fuel?: string;
    transmission?: string;
    color?: string;
    hasAccidentRecord?: boolean;
    bodyType?: string;
    engineCC?: number;
  } | null;
}

export interface AISuggestion {
  listingId: string;
  title: string;
  estimatedValue: number;
  city: string;
  image: string;
  ownerName: string;
  compatibilityScore: number;
  reasons: string[];
  priceDiff: number;
  negotiationTip: string;
}

export interface AIResponse {
  message: string;
  suggestions: AISuggestion[];
  listingCount: number;
}

// ─── Keyword maps ─────────────────────────────────────────────────────────────

const SUV_KW      = ['suv', 'crossover', 'duster', 'tucson', 'qashqai', 'tiguan', 't-roc', 'sportage', 'eclipse', 'kuga', '3008', 'puma', 'karoq', 'rav4', 'cx-5', 'compass'];
const SEDAN_KW    = ['sedan', 'corolla', 'civic', 'megane', 'passat', 'octavia', 'a4', 'c180', '320i', '520d', 'focus', 'superb', '508'];
const HATCH_KW    = ['hatchback', 'i20', 'clio', 'polo', 'golf', 'ibiza', 'yaris', 'fiesta'];
const GERMAN_KW   = ['alman', 'bmw', 'mercedes', 'audi', 'volkswagen', 'vw', 'opel'];
const JAPANESE_KW = ['japon', 'toyota', 'honda', 'nissan', 'mitsubishi', 'mazda', 'suzuki'];
const HYBRID_KW   = ['hibrit', 'hybrid', 'elektrik', 'electric', 'e-tech'];
const DIESEL_KW   = ['dizel', 'diesel', 'tdi', 'crdi'];

// ─── Scoring fonksiyonları ────────────────────────────────────────────────────

function scorePriceMatch(source: AIListing, target: AIListing): { pts: number; reason: string | null } {
  const diff  = Math.abs(source.estimatedValue - target.estimatedValue);
  const ratio = diff / source.estimatedValue;
  if (ratio <= 0.04) return { pts: PRICE_WEIGHTS.exact,        reason: 'Fiyatlar neredeyse eşit' };
  if (ratio <= 0.10) return { pts: PRICE_WEIGHTS.veryClose,    reason: `Fiyat farkı düşük (${pct(ratio)})` };
  if (ratio <= 0.20) return { pts: PRICE_WEIGHTS.close,        reason: `Fiyat aralığı uyuşuyor (${pct(ratio)} fark)` };
  if (ratio <= 0.30) return { pts: PRICE_WEIGHTS.acceptable,   reason: `Fiyat farkı makul (${pct(ratio)})` };
  if (ratio <= 0.45) return { pts: PRICE_WEIGHTS.loose,        reason: null };
  return { pts: PRICE_WEIGHTS.tooDifferent, reason: null };
}

function scorePreference(wantedFor: string, target: AIListing): { pts: number; reasons: string[] } {
  const w     = wantedFor.toLowerCase();
  const brand = (target.vehicleDetails?.brand ?? '').toLowerCase();
  const model = (target.vehicleDetails?.model ?? '').toLowerCase();
  const body  = (target.vehicleDetails?.bodyType ?? '').toLowerCase();
  const fuel  = (target.vehicleDetails?.fuel ?? '').toLowerCase();
  const reasons: string[] = [];
  let pts = 0;

  if (brand && w.includes(brand))                        { pts += 25; reasons.push(`İstenen marka: ${target.vehicleDetails?.brand}`); }
  else if (model && w.includes(model.split(' ')[0]))     { pts += 22; reasons.push('İstenen model eşleşiyor'); }
  else if (SUV_KW.some(k => w.includes(k)) && (body.includes('suv') || body.includes('crossover'))) {
    pts += 18; reasons.push('SUV/crossover tercihi uyuşuyor');
  } else if (SEDAN_KW.some(k => w.includes(k)) && body.includes('sedan')) {
    pts += 18; reasons.push('Sedan tercihi uyuşuyor');
  } else if (HATCH_KW.some(k => w.includes(k)) && body.includes('hatchback')) {
    pts += 16; reasons.push('Hatchback tercihi uyuşuyor');
  }

  if (GERMAN_KW.some(k => w.includes(k))   && GERMAN_KW.slice(1).includes(brand))   { pts += 8; reasons.push('Alman marka tercihi'); }
  if (JAPANESE_KW.some(k => w.includes(k)) && JAPANESE_KW.slice(1).includes(brand)) { pts += 8; reasons.push('Japon marka tercihi'); }
  if (HYBRID_KW.some(k => w.includes(k))   && fuel.includes('hibrit'))               { pts += 10; reasons.push('Hibrit tercihi uyuşuyor'); }
  if (DIESEL_KW.some(k => w.includes(k))   && fuel.includes('dizel'))                { pts += 8;  reasons.push('Dizel tercihi uyuşuyor'); }

  return { pts, reasons };
}

function scoreLocation(source: AIListing, target: AIListing): { pts: number; reason: string | null } {
  if (source.city === target.city) return { pts: LOCATION_WEIGHTS.sameCity, reason: `Aynı şehir (${source.city})` };
  const nearby: Record<string, string[]> = {
    'İstanbul': ['Bursa', 'Kocaeli'],
    'Bursa':    ['İstanbul', 'Kocaeli'],
    'Ankara':   ['Kayseri', 'Eskişehir'],
    'Kayseri':  ['Ankara'],
    'İzmir':    ['Manisa'],
    'Manisa':   ['İzmir'],
  };
  if (nearby[source.city]?.includes(target.city)) return { pts: LOCATION_WEIGHTS.nearbyCity, reason: 'Yakın şehir' };
  return { pts: LOCATION_WEIGHTS.different, reason: null };
}

function scoreVehicle(target: AIListing): { pts: number; reasons: string[] } {
  if (!target.vehicleDetails) return { pts: 10, reasons: [] };
  const { km = 0, year = 2000, hasAccidentRecord = false } = target.vehicleDetails;
  const reasons: string[] = [];
  let pts = 0;

  const condPts: Record<string, number> = { 'Mükemmel': 12, 'İyi': 9, 'Orta': 5, 'Yıpranmış': 1 };
  pts += condPts[target.condition] ?? 5;

  if (km < 50_000)  { pts += 8; reasons.push('Düşük kilometre'); }
  else if (km < 80_000) { pts += 5; }
  else if (km > 150_000) { pts -= 4; }

  if (year >= 2021)      { pts += 6; reasons.push(`${year} model yeni araç`); }
  else if (year >= 2018) { pts += 3; }

  if (hasAccidentRecord) { pts -= 8; reasons.push('⚠ Hasar kaydı var'); }
  else                   { pts += 4; reasons.push('Hasar kaydı yok'); }

  return { pts, reasons };
}

function negotiationTip(source: AIListing, target: AIListing): string {
  const diff    = target.estimatedValue - source.estimatedValue;
  const absDiff = Math.abs(diff);
  if (absDiff < 30_000)  return 'Fiyatlar çok yakın, nakit fark olmadan takas mümkün.';
  if (diff > 0) {
    if (absDiff < 80_000) return `Yaklaşık ${fmt(absDiff)} fark var. Hedef ilan sahibinden %10-15 indirim isteyin.`;
    return `${fmt(absDiff)} fark söz konusu. Aracınızın bakım geçmişini öne çıkararak pazarlık edin.`;
  }
  if (absDiff < 80_000) return `${fmt(absDiff)} fazla değer sunuyorsunuz; nakit fark talep edebilirsiniz.`;
  return `${fmt(absDiff)} avantajınız var. Hedef ilan sahibine nakit fark veya ek aksesuar teklif edin.`;
}

function buildMessage(query: string, source: AIListing | null, results: ReturnType<typeof scoreOne>[], total: number): string {
  const q = query.toLowerCase();

  if (!source || results.length === 0) {
    if (q.includes('fiyat') || q.includes('analiz')) {
      return `Fiyat analizi: platformda şu an **${total} aktif ilan** var. İdeal takas aralığı **%15-20 fark**tır. Karşılaştırmak istediğiniz ilanı belirtin.`;
    }
    if (q.includes('müzakere') || q.includes('pazarlık') || q.includes('taktik')) {
      return `Takas müzakeresinde başarı için:\n\n1. **Belgeleri hazırlayın** — bakım fişleri, ekspertiz raporu\n2. **Piyasa fiyatını bilin** — son satışları karşılaştırın\n3. **İlk teklifi %10 düşük yapın** — yükseltmek için alan bırakın\n4. **Şehir içi buluşun** — aynı şehirde takas daha kolay\n5. **Nakit fark esnekliği** — 50-100k arası fark çoğu zaman kabul görür`;
    }
    return `Platformda şu an **${total} aktif ilan** var. Daha iyi eşleştirme için hangi aracı takas etmek istediğinizi belirtin.`;
  }

  const topScore = results[0].compatibilityScore;
  const intro = topScore >= 80
    ? `**${source.title}** için harika eşleşmeler buldum! En iyi sonuç **%${topScore}** uyumlulukla aşağıda.`
    : topScore >= 60
    ? `**${source.title}** için ${results.length} olası takas buldum. Fiyat farkına dikkat edin.`
    : `**${source.title}** için uyumluluk düşük olsa da değerlendirilebilecek ${results.length} ilan var.`;

  const top = results[0];
  const priceLine = `\n\nAracınızın tahmini değeri **${fmt(source.estimatedValue)}**. ` + (
    top.priceDiff > 0
      ? `En yakın eşleşmede **${fmt(top.priceDiff)} ek ödeme** gerekebilir.`
      : top.priceDiff < 0
      ? `En yakın eşleşmeden **${fmt(Math.abs(top.priceDiff))} nakit fark** talep edebilirsiniz.`
      : 'Fiyatlar neredeyse eşit — nakit fark gerekmeyebilir.'
  );

  return intro + priceLine;
}

// ─── Tek ilan skorlama ────────────────────────────────────────────────────────

function scoreOne(source: AIListing, target: AIListing): AISuggestion {
  const price = scorePriceMatch(source, target);
  const pref  = scorePreference(source.wantedFor, target);
  const loc   = scoreLocation(source, target);
  const veh   = scoreVehicle(target);

  const total      = price.pts + pref.pts + loc.pts + veh.pts;
  const normalized = Math.min(Math.max(Math.round(total * SCORE_BOOST), 10), 97);

  const reasons = [price.reason, ...pref.reasons, loc.reason, ...veh.reasons]
    .filter(Boolean).slice(0, 3) as string[];
  if (reasons.length === 0) reasons.push('Genel kategori uyumu');

  return {
    listingId:          target.id,
    title:              target.title,
    estimatedValue:     target.estimatedValue,
    city:               target.city,
    image:              target.images[0] ?? '',
    ownerName:          target.ownerName,
    compatibilityScore: normalized,
    reasons,
    priceDiff:          target.estimatedValue - source.estimatedValue,
    negotiationTip:     negotiationTip(source, target),
  };
}

// ─── Kaynak ilanı queryden çıkar ──────────────────────────────────────────────

function inferSource(query: string, listings: AIListing[]): AIListing | null {
  const q = query.toLowerCase();
  for (const l of listings) {
    const brand = (l.vehicleDetails?.brand ?? '').toLowerCase();
    const model = (l.vehicleDetails?.model ?? '').toLowerCase();
    if (brand && q.includes(brand)) return l;
    if (model && q.includes(model.split(' ')[0])) return l;
  }
  return null;
}

// ─── Ana fonksiyon (tek seferlik) ─────────────────────────────────────────────

export function runSwapAI(params: {
  query: string;
  currentListingId?: string | null;
  listings: AIListing[];
}): AIResponse {
  const { query, currentListingId, listings } = params;

  const source = currentListingId
    ? (listings.find(l => l.id === currentListingId) ?? inferSource(query, listings))
    : inferSource(query, listings);

  if (!source) {
    return {
      message:      buildMessage(query, null, [], listings.length),
      suggestions:  [],
      listingCount: listings.length,
    };
  }

  // ⚠ Aynı kategoride + makul fiyat aralığında (%30-200) öneriler ver
  let pool = listings.filter(l => l.id !== source.id && l.ownerId !== source.ownerId);
  const sameCat = pool.filter(l => l.category === source.category);
  if (sameCat.length > 0) pool = sameCat;
  pool = pool.filter(l => l.estimatedValue >= source.estimatedValue * PRICE_FILTER.minRatio && l.estimatedValue <= source.estimatedValue * PRICE_FILTER.maxRatio);
  // Aralık dışı kalırsa hiç eşleşme bulunmasın diye fallback yok — kullanıcı bilinçli filtre uygulasın

  const candidates = pool
    .map(l => scoreOne(source, l))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 5);

  return {
    message:      buildMessage(query, source, candidates, listings.length),
    suggestions:  candidates,
    listingCount: listings.length,
  };
}

// ─── ÇOK TURLU SOHBET ─────────────────────────────────────────────────────────

export interface ConversationTurn {
  role:          'user' | 'assistant';
  content:       string;
  candidateIds?: string[];
}

interface Intent {
  type:           'refine' | 'reference' | 'question' | 'search' | 'greeting' | 'thanks';
  refineFilter?:  (l: AIListing) => boolean;
  refineSort?:    (a: AIListing, b: AIListing) => number;
  referenceIdx?: number;            // 0,1,2... for "ilki", "ikincisi"
  questionTopic?: 'price' | 'negotiation' | 'brand' | 'best' | 'general';
  brandFilter?:   string;
  prefix?:        string;
}

// Türkçe karakter normalize — kullanıcı "yardim" yazsa bile "yardım" gibi bulsun
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
}

function has(q: string, ...patterns: string[]): boolean {
  const nq = normalize(q);
  return patterns.some((p) => nq.includes(normalize(p)));
}

interface Intent2 extends Intent {
  showcaseCategory?: 'Araç' | 'Elektronik' | 'Gayrimenkul';
  showcaseKind?: 'recent' | 'popular' | 'cheap' | 'premium' | 'all';
  helpTopic?: 'general' | 'how-to-list' | 'safety' | 'how-it-works';
}

function detectIntent(query: string): Intent2 {
  const q = query.toLowerCase().trim();
  const wordCount = q.split(/\s+/).filter(Boolean).length;

  // ── Selamlama / teşekkür ─────────────────────────────────────────────────
  if (/^(selam|merhaba|hey|hi|hello|sa\b|naber|nasılsın)/.test(q)) return { type: 'greeting' };
  if (has(q, 'teşekkür', 'sağol', 'saol', 'thanks', 'eyvallah')) return { type: 'thanks' };

  // ── Yardım sorguları ─────────────────────────────────────────────────────
  if (has(q, 'yardım', 'nasıl çalış', 'ne yapabil', 'neler yap', 'özellik') || q === 'help' || q === '?')
    return { type: 'question', helpTopic: 'general' } as Intent2;
  if (has(q, 'ilan ver', 'nasıl ilan', 'ilan oluştur'))
    return { type: 'question', helpTopic: 'how-to-list' } as Intent2;
  if (has(q, 'güvenli', 'dolandırıcı', 'risk', 'tehlike'))
    return { type: 'question', helpTopic: 'safety' } as Intent2;

  // ── Showcase: kısa kategori sorguları ────────────────────────────────────
  // "ilan", "ilanlar", "ne var"
  if (wordCount <= 2 && (q === 'ilan' || q === 'ilanlar' || has(q, 'ne var', 'göster', 'platform', 'her şey')))
    return { type: 'search', showcaseKind: 'all' } as Intent2;

  // Araç kategorisi
  if (wordCount <= 2 && (q === 'araba' || q === 'arabalar' || q === 'araç' || q === 'oto' || q === 'otomobil' || q === 'vasıta'))
    return { type: 'search', showcaseCategory: 'Araç', showcaseKind: 'all' } as Intent2;

  // Elektronik
  if (wordCount <= 2 && (q === 'telefon' || q === 'telefonlar' || q === 'laptop' || q === 'bilgisayar' || q === 'tablet' || q === 'elektronik'))
    return { type: 'search', showcaseCategory: 'Elektronik', showcaseKind: 'all' } as Intent2;

  // Gayrimenkul
  if (wordCount <= 2 && (q === 'ev' || q === 'evler' || q === 'daire' || q === 'daireler' || q === 'gayrimenkul' || q === 'emlak' || q === 'villa'))
    return { type: 'search', showcaseCategory: 'Gayrimenkul', showcaseKind: 'all' } as Intent2;

  // Popüler / yeni
  if (has(q, 'popüler', 'çok bakıl', 'en çok izlen', 'trend'))
    return { type: 'search', showcaseKind: 'popular' } as Intent2;
  if (has(q, 'yeni eklen', 'son ilan', 'yeni gelen', 'taze'))
    return { type: 'search', showcaseKind: 'recent' } as Intent2;

  // ── Referans: "ilkini", "ikincisi", "üçüncüsü" ───────────────────────────
  if (has(q, 'ilkini', 'ilki', 'birinci', 'birincisi') || /\bilk\b/.test(q))
    return { type: 'reference', referenceIdx: 0, prefix: 'İlk önerim hakkında:' };
  if (has(q, 'ikinci', 'ikincisi'))
    return { type: 'reference', referenceIdx: 1, prefix: 'İkinci öneri hakkında:' };
  if (has(q, 'üçüncü', 'üçüncüsü'))
    return { type: 'reference', referenceIdx: 2, prefix: 'Üçüncü öneri hakkında:' };

  // ── Soru — fiyat ─────────────────────────────────────────────────────────
  if (has(q, 'fiyat tahmini', 'fiyat analiz', 'değer', 'ne kadar eder', 'kaç para', 'piyasa'))
    return { type: 'question', questionTopic: 'price' };

  // ── Soru — müzakere/pazarlık ─────────────────────────────────────────────
  if (has(q, 'pazarlık', 'müzakere', 'nasıl konuşmalı', 'taktik', 'ipucu'))
    return { type: 'question', questionTopic: 'negotiation' };

  // ── Soru — en iyi seçim ──────────────────────────────────────────────────
  if (has(q, 'en iyi', 'hangisini', 'hangisi daha', 'sen olsan', 'tavsiye', 'öneri', 'hangi'))
    return { type: 'question', questionTopic: 'best' };

  // ── Genel marka analizi (Toyota, BMW vs. iyi mi)
  const brandQuestion = q.match(/(toyota|honda|bmw|mercedes|audi|volkswagen|opel|renault|peugeot|ford|fiat|hyundai|kia|nissan|mazda|skoda|seat|dacia|mitsubishi)/);
  if (brandQuestion && has(q, 'iyi mi', 'nasıl', 'kalite', 'tavsiye edilir')) {
    return { type: 'question', questionTopic: 'brand', brandFilter: brandQuestion[1] };
  }

  // ── Refinement: daha ucuz ────────────────────────────────────────────────
  if (has(q, 'daha ucuz', 'en ucuz', 'ucuz olan', 'uygun fiyat')) {
    return {
      type:       'refine',
      refineSort: (a, b) => a.estimatedValue - b.estimatedValue,
      prefix:     '💰 En uygun fiyatlıları öne çıkarıyorum…',
    };
  }
  // Daha pahalı / premium
  if (has(q, 'daha pahalı', 'en pahalı', 'premium', 'lüks', 'üst segment')) {
    return {
      type:       'refine',
      refineSort: (a, b) => b.estimatedValue - a.estimatedValue,
      prefix:     '✨ Daha üst segmenttekileri sıralıyorum…',
    };
  }
  // Daha yeni
  if (has(q, 'daha yeni', 'yeni model', 'son model', 'güncel', 'en yeni')) {
    return {
      type:         'refine',
      refineFilter: (l) => (l.vehicleDetails?.year ?? 0) >= 2020,
      refineSort:   (a, b) => (b.vehicleDetails?.year ?? 0) - (a.vehicleDetails?.year ?? 0),
      prefix:       '🆕 Sadece 2020 ve sonrası modelleri gösteriyorum…',
    };
  }
  // Düşük km
  if (has(q, 'düşük km', 'az kilometre', 'az kullanılmış', 'az km')) {
    return {
      type:         'refine',
      refineFilter: (l) => (l.vehicleDetails?.km ?? Infinity) < 80_000,
      refineSort:   (a, b) => (a.vehicleDetails?.km ?? 0) - (b.vehicleDetails?.km ?? 0),
      prefix:       '🏃 80.000 km altı seçenekleri filtreliyorum…',
    };
  }
  // Hasarsız
  if (has(q, 'hasarsız', 'hasar kaydı yok', 'sıfır hasar', 'temiz')) {
    return {
      type:         'refine',
      refineFilter: (l) => !l.vehicleDetails?.hasAccidentRecord,
      prefix:       '✅ Sadece hasar kaydı olmayan ilanları gösteriyorum…',
    };
  }
  // Yakıt tipi
  if (has(q, 'hibrit', 'hibrid'))     return { type: 'refine', refineFilter: l => (l.vehicleDetails?.fuel ?? '').toLowerCase().includes('hibrit'),    prefix: '⚡ Hibrit araçları filtreliyorum…' };
  if (has(q, 'elektrikli', 'elektrik')) return { type: 'refine', refineFilter: l => (l.vehicleDetails?.fuel ?? '').toLowerCase().includes('elektrik'), prefix: '⚡ Elektrikli araçları filtreliyorum…' };
  if (has(q, 'dizel', 'diesel'))      return { type: 'refine', refineFilter: l => (l.vehicleDetails?.fuel ?? '').toLowerCase().includes('dizel'),    prefix: '🛢️ Dizel araçları filtreliyorum…' };
  if (has(q, 'benzinli') || /\bbenzin\b/.test(q)) return { type: 'refine', refineFilter: l => (l.vehicleDetails?.fuel ?? '').toLowerCase().includes('benzin'),   prefix: '⛽ Benzinli araçları filtreliyorum…' };

  // Şehir bazlı refinement
  const cities = ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'kayseri', 'eskişehir', 'mersin', 'gaziantep', 'trabzon', 'diyarbakır'];
  for (const c of cities) {
    if (q.includes(c)) {
      const cap = c.charAt(0).toUpperCase() + c.slice(1);
      return {
        type:         'refine',
        refineFilter: (l) => l.city.toLowerCase().includes(c),
        prefix:       `📍 Sadece ${cap}'daki ilanları gösteriyorum…`,
      };
    }
  }

  // Otomatik vites
  if (/\b(otomatik|otomatik vites)\b/.test(q)) {
    return {
      type:         'refine',
      refineFilter: l => (l.vehicleDetails?.transmission ?? '').toLowerCase().includes('otomatik'),
      prefix:       '🕹️ Otomatik vitesli olanları filtreliyorum…',
    };
  }

  // ── Marka filtre (refine değil, search içinde de kullanılabilir) ────────
  const brands = ['toyota', 'honda', 'bmw', 'mercedes', 'audi', 'volkswagen', 'vw', 'opel', 'renault', 'peugeot', 'ford', 'fiat', 'hyundai', 'kia', 'nissan', 'mazda', 'skoda', 'seat', 'dacia', 'mitsubishi'];
  for (const b of brands) {
    if (q.includes(b)) {
      return {
        type:         'refine',
        refineFilter: (l) => (l.vehicleDetails?.brand ?? '').toLowerCase().includes(b === 'vw' ? 'volkswagen' : b),
        prefix:       `🏷️ ${b.charAt(0).toUpperCase() + b.slice(1)} markasını filtreliyorum…`,
        brandFilter:  b,
      };
    }
  }

  // Default: yeni arama
  return { type: 'search' };
}

// ─── Konuşma fonksiyonu ───────────────────────────────────────────────────────

export function runConversationalAI(params: {
  query: string;
  currentListingId?: string | null;
  listings: AIListing[];
  history?: ConversationTurn[];
}): AIResponse {
  const { query, currentListingId, listings, history = [] } = params;

  // Önceki asistan turundan adayları al
  const lastAssistant = [...history].reverse().find(t => t.role === 'assistant');
  const previousCandidates = (lastAssistant?.candidateIds ?? [])
    .map(id => listings.find(l => l.id === id))
    .filter((l): l is AIListing => Boolean(l));

  const source = currentListingId
    ? listings.find(l => l.id === currentListingId) ?? inferSource(query, listings)
    : inferSource(query, listings);

  const intent = detectIntent(query) as Intent2;

  // ── Yardımcı: ilan → öneri formatına dönüştür ────────────────────────────
  const toSuggestion = (l: AIListing, reason = 'Platformdan'): AISuggestion => source ? scoreOne(source, l) : ({
    listingId: l.id, title: l.title, estimatedValue: l.estimatedValue, city: l.city,
    image: l.images[0] ?? '', ownerName: l.ownerName,
    compatibilityScore: 75, reasons: [reason],
    priceDiff: 0, negotiationTip: '',
  });

  // ── Selamlama (varyasyonlu) ──────────────────────────────────────────────
  if (intent.type === 'greeting') {
    const greetings = [
      `Merhaba! 👋 Ben **TakaslAI**. Platformda **${listings.length} aktif ilan** var. Hangi konuda yardım edebilirim?`,
      `Selam! 🙂 Sana takas için en iyi eşleşmeleri bulabilirim. **${listings.length} ilan** arasından seçim yapabiliriz. Neye bakıyorsun?`,
      `Hey! ✦ TakaslAI burada. **${listings.length} aktif ilan** üzerinden arama, fiyat analizi veya müzakere tavsiyesi yapabilirim. Başlayalım mı?`,
    ];
    const sample = listings.slice(0, 3).map(l => toSuggestion(l, 'Öne çıkan ilan'));
    return {
      message: greetings[Math.floor(Math.random() * greetings.length)] +
        `\n\n**Şunları deneyebilirsin:**\n- *"Araç göster"* / *"Elektronik göster"*\n- *"Popüler ilanlar"*\n- *"Pazarlık taktikleri"*\n- *"BMW iyi mi?"*\n\n👇 Sana birkaç ilan da gösteriyorum:`,
      suggestions:  sample,
      listingCount: listings.length,
    };
  }

  if (intent.type === 'thanks') {
    return {
      message: 'Rica ederim! 🙂 Başka takas önerisi ya da fiyat analizi istersen söylemen yeterli.',
      suggestions: [],
      listingCount: listings.length,
    };
  }

  // ── Referans: "ilkini anlat", "ikinciyi söyle" ───────────────────────────
  if (intent.type === 'reference' && intent.referenceIdx !== undefined) {
    const target = previousCandidates[intent.referenceIdx];
    if (!target) {
      return {
        message: 'Önceki bir öneriden bahsediyorsun ama henüz öneri sunmadım. Önce bir arama yapmamı ister misin?',
        suggestions: [],
        listingCount: listings.length,
      };
    }
    const v = target.vehicleDetails;
    const lines: string[] = [`${intent.prefix} **${target.title}**`];
    lines.push(`📍 ${target.city} · 💰 ${fmt(target.estimatedValue)} · Durum: ${target.condition}`);
    if (v) {
      lines.push(`🚗 ${v.year} model, ${v.km?.toLocaleString('tr-TR')} km, ${v.fuel}, ${v.transmission}`);
      if (v.hasAccidentRecord) lines.push(`⚠️ Hasar kaydı var — pazarlıkta kullanabilirsin.`);
      else                     lines.push(`✅ Hasar kaydı yok — güvenli seçim.`);
    }
    if (source && previousCandidates.length > 0) {
      const sc = scoreOne(source, target);
      lines.push(`\n**Uyumluluk:** %${sc.compatibilityScore} · ${sc.reasons.join(' · ')}`);
      lines.push(`\n💡 ${sc.negotiationTip}`);
    }
    return {
      message:      lines.join('\n'),
      suggestions:  source ? [scoreOne(source, target)] : [],
      listingCount: listings.length,
    };
  }

  // ── Genel soru — En iyisi hangisi ────────────────────────────────────────
  if (intent.type === 'question' && intent.questionTopic === 'best') {
    const pool = previousCandidates.length > 0
      ? previousCandidates
      : (source ? listings.filter(l => l.id !== source.id).map(l => l) : listings);

    if (pool.length === 0) {
      return { message: 'Henüz değerlendirilecek ilan yok.', suggestions: [], listingCount: listings.length };
    }

    if (source) {
      const scored = pool.map(l => scoreOne(source, l)).sort((a, b) => b.compatibilityScore - a.compatibilityScore);
      const top = scored[0];
      const topL = pool.find(l => l.id === top.listingId)!;
      return {
        message: `🏆 Bence en iyi seçim **${topL.title}** — %${top.compatibilityScore} uyum.\n\n**Neden:** ${top.reasons.join(' · ')}\n\n💡 ${top.negotiationTip}`,
        suggestions: scored.slice(0, 3),
        listingCount: listings.length,
      };
    }
    return {
      message: `Tavsiye için önce hangi aracı takas etmek istediğini söyle. Mesela: *"Toyota Corolla için takas bul"*`,
      suggestions: [],
      listingCount: listings.length,
    };
  }

  // ── Fiyat analizi ────────────────────────────────────────────────────────
  if (intent.type === 'question' && intent.questionTopic === 'price') {
    const prices = listings.map(l => l.estimatedValue);
    if (prices.length === 0) return { message: 'Henüz fiyat verisi yok.', suggestions: [], listingCount: 0 };
    const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return {
      message: `💰 **Platform fiyat analizi** (${listings.length} ilan):\n\n- Ortalama: **${fmt(avg)}**\n- En düşük: ${fmt(min)}\n- En yüksek: ${fmt(max)}\n\n*İdeal takas için fark **%15-20**'yi geçmemeli — daha fazlası nakit tamamlama gerektirir.*`,
      suggestions: [],
      listingCount: listings.length,
    };
  }

  // ── Müzakere tavsiyesi ───────────────────────────────────────────────────
  if (intent.type === 'question' && intent.questionTopic === 'negotiation') {
    return {
      message: `🤝 **Takas müzakere taktikleri:**\n\n1. **Bilgi topla** — sahibinden.com'da son satışlara bak, piyasayı bil\n2. **İlk teklif düşük olsun** — %10-15 altından başla, yükseltmek için alan bırak\n3. **Belgeleri hazırla** — bakım fişleri, ekspertiz, lastik faturası\n4. **Hasar kaydını öne çıkar** — karşı tarafta varsa indirim iste\n5. **Şehir içi buluş** — aynı şehirde takas daha hızlı kapanır\n6. **Nakit fark esnek tut** — 50-100k arası fark çoğu zaman kabul görür\n7. **Acele etme** — birkaç gün düşünmek iyidir`,
      suggestions: [],
      listingCount: listings.length,
    };
  }

  // ── Marka analizi ────────────────────────────────────────────────────────
  if (intent.type === 'question' && intent.questionTopic === 'brand' && intent.brandFilter) {
    const brand = intent.brandFilter;
    const brandListings = listings.filter(l => (l.vehicleDetails?.brand ?? '').toLowerCase().includes(brand));
    if (brandListings.length === 0) {
      return {
        message: `**${brand[0].toUpperCase() + brand.slice(1)}** markası için platformda henüz aktif ilan yok. Bu marka için karar verirken ikinci el değer kaybı, yedek parça bulunabilirliği ve servis ücretleri önemli.`,
        suggestions: [],
        listingCount: listings.length,
      };
    }
    const avg = Math.round(brandListings.reduce((s, l) => s + l.estimatedValue, 0) / brandListings.length);
    return {
      message: `**${brand[0].toUpperCase() + brand.slice(1)}** markası özet:\n\n- Platformda **${brandListings.length} aktif ilan**\n- Ortalama değer: **${fmt(avg)}**\n- En popüler modeller: ${[...new Set(brandListings.map(l => l.vehicleDetails?.model).filter(Boolean))].slice(0, 3).join(', ')}\n\nGüvenilirlik, yedek parça ve servis maliyeti açısından genelde başarılı bir marka.`,
      suggestions: brandListings.slice(0, 3).map(l => source ? scoreOne(source, l) : ({
        listingId: l.id, title: l.title, estimatedValue: l.estimatedValue, city: l.city,
        image: l.images[0] ?? '', ownerName: l.ownerName,
        compatibilityScore: 75, reasons: [`${brand} markası`], priceDiff: 0, negotiationTip: '',
      })),
      listingCount: listings.length,
    };
  }

  // ── Refinement (önceki adaylar üzerinde) ─────────────────────────────────
  if (intent.type === 'refine') {
    let pool: AIListing[];
    let isOnPrev = false;
    if (previousCandidates.length > 0) {
      pool = previousCandidates;
      isOnPrev = true;
    } else if (source) {
      pool = listings.filter(l => l.id !== source.id && l.ownerId !== source.ownerId);
    } else {
      pool = listings;
    }

    // ⚠ KRİTİK FIX: Kaynak ilan varsa, aynı KATEGORİDE olanları öncelendir
    // (Tesla'ya PS5 önerme absürdlüğünü engelle)
    if (source) {
      const sameCategory = pool.filter(l => l.category === source.category);
      if (sameCategory.length > 0) {
        pool = sameCategory;
      }

      // ⚠ MAKUL FİYAT ARALIĞI: source değerinin %30 - %200 aralığı
      // (Çok düşük ya da çok yüksek = absürt eşleşme)
      const minPrice = source.estimatedValue * PRICE_FILTER.minRatio;
      const maxPrice = source.estimatedValue * PRICE_FILTER.maxRatio;
      const inRange  = pool.filter(l => l.estimatedValue >= minPrice && l.estimatedValue <= maxPrice);
      if (inRange.length > 0) {
        pool = inRange;
      }
    }

    let filtered = pool;
    if (intent.refineFilter) filtered = filtered.filter(intent.refineFilter);
    if (intent.refineSort)   filtered = [...filtered].sort(intent.refineSort);
    filtered = filtered.slice(0, 5);

    if (filtered.length === 0) {
      const altMsg = source
        ? `**${source.title}** kategorisinde (${source.category}) ve makul fiyat aralığında bu kritere uyan ilan yok.`
        : 'Bu kritere uyan ilan bulamadım.';
      return {
        message: `${intent.prefix}\n\n${altMsg} ${isOnPrev ? 'Önceki sonuçlardan filtrelendi.' : 'Farklı bir kriter dene.'}`,
        suggestions: [],
        listingCount: listings.length,
      };
    }

    const suggestions = source
      ? filtered.map(l => scoreOne(source, l))
      : filtered.map(l => ({
          listingId: l.id, title: l.title, estimatedValue: l.estimatedValue, city: l.city,
          image: l.images[0] ?? '', ownerName: l.ownerName,
          compatibilityScore: 70, reasons: ['Kriter uyumu'],
          priceDiff: 0, negotiationTip: 'Önce kaynak araç bilgisi gir.',
        }));

    const ctxHint = source
      ? `${source.category} kategorisinde, ${fmt(source.estimatedValue * PRICE_FILTER.minRatio)} – ${fmt(source.estimatedValue * PRICE_FILTER.maxRatio)} aralığında.`
      : '';

    return {
      message: `${intent.prefix}\n\n${filtered.length} ilan bulundu${isOnPrev ? ' (önceki sonuçlardan)' : ''}. ${ctxHint}`,
      suggestions,
      listingCount: listings.length,
    };
  }

  // ── Yardım soruları ──────────────────────────────────────────────────────
  if (intent.type === 'question' && intent.helpTopic === 'general') {
    return {
      message:
        `🤖 **TakaslAI Nasıl Çalışır?**\n\n` +
        `Sana 4 şekilde yardımcı olabilirim:\n\n` +
        `**1. 🎯 Eşleştirme** — Aracını/ürününü söyle, sana uygun takas önerileri bulayım\n` +
        `   *Örn: "Toyota Corolla için takas bul"*\n\n` +
        `**2. 🔍 Filtreleme** — Mevcut önerileri daraltayım\n` +
        `   *Örn: "daha ucuz", "Ankara'da olanlar", "hibrit"*\n\n` +
        `**3. 💬 Soru-Cevap** — Marka analizi, fiyat görüşü, pazarlık tavsiyesi\n` +
        `   *Örn: "BMW iyi mi?", "fiyat analizi", "pazarlık taktikleri"*\n\n` +
        `**4. 📋 Detay** — Önceki önerilere referans verebilirsin\n` +
        `   *Örn: "ilkini anlat", "ikincisini detaylandır"*`,
      suggestions:  [],
      listingCount: listings.length,
    };
  }
  if (intent.type === 'question' && intent.helpTopic === 'how-to-list') {
    return {
      message: `📋 **İlan Vermek için:**\n\n1. Sağ üstteki **"İlan Ver"** butonuna tıkla\n2. Kategorini seç (Araç / Elektronik / Gayrimenkul / Diğer)\n3. Bilgileri doldur — kolaylık için **şablonlardan** başlayabilirsin\n4. ✦ **AI ile yaz** butonu açıklamayı senin yerine yazar\n5. 💰 **AI ile hesapla** ile fiyat önerisi alabilirsin\n\nİlanın yayınlanır yayınlanmaz teklif alabilirsin!`,
      suggestions:  [],
      listingCount: listings.length,
    };
  }
  if (intent.type === 'question' && intent.helpTopic === 'safety') {
    return {
      message: `🔒 **Takaslat'ta Güvenli Takas İçin:**\n\n• **Tüm görüşmeler platform üzerinden** olsun — dış mesajlaşma açma\n• **Ödeme/transfer talep eden** kullanıcılara karşı dikkatli ol\n• **Belgeleri yerinde gör** — ekspertiz, ruhsat, fatura\n• **Açık alanda buluş** — AVM, kafe, polis merkezi yakını\n• **Şüpheli ilan** gördüğünde 🚩 şikayet et\n• **Karşı tarafın profili** ve geçmiş takasları kontrol et\n\nSorun yaşarsan ekibimize ulaşmaktan çekinme!`,
      suggestions:  [],
      listingCount: listings.length,
    };
  }

  // ── Showcase: kategori / popüler / yeni gösterimi ────────────────────────
  if (intent.type === 'search' && (intent.showcaseCategory || intent.showcaseKind)) {
    let pool = listings;
    let categoryLabel = '';

    if (intent.showcaseCategory) {
      pool = listings.filter(l => l.category === intent.showcaseCategory);
      categoryLabel = intent.showcaseCategory.toLowerCase();
    }

    if (pool.length === 0) {
      return {
        message: `Üzgünüm, ${categoryLabel ? `${categoryLabel} kategorisinde` : 'platformda'} henüz aktif ilan yok. Yeni eklemeler için tekrar uğra!`,
        suggestions: [],
        listingCount: listings.length,
      };
    }

    // Sıralama
    let sorted: AIListing[] = [...pool];
    let intro = '';
    if (intent.showcaseKind === 'popular') {
      // viewCount yok bu listede, ama estimated value ve son aktivite proxy olabilir
      sorted = sorted.sort((a, b) => b.estimatedValue - a.estimatedValue);
      intro = `🏆 **En popüler ${categoryLabel ? categoryLabel : 'ilanlar'}** (${pool.length} adetten ilk 5):`;
    } else if (intent.showcaseKind === 'recent') {
      sorted = sorted.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      intro = `🆕 **Yeni eklenen ${categoryLabel ? categoryLabel : 'ilanlar'}** (${pool.length} adet):`;
    } else if (intent.showcaseKind === 'cheap') {
      sorted = sorted.sort((a, b) => a.estimatedValue - b.estimatedValue);
      intro = `💰 **En ekonomik ${categoryLabel ? categoryLabel : 'ilanlar'}**:`;
    } else if (intent.showcaseKind === 'premium') {
      sorted = sorted.sort((a, b) => b.estimatedValue - a.estimatedValue);
      intro = `✨ **Premium ${categoryLabel ? categoryLabel : 'ilanlar'}**:`;
    } else {
      intro = categoryLabel
        ? `Platformda **${pool.length} ${categoryLabel} ilanı** var. İşte sana birkaç öneri:`
        : `Platformda toplam **${pool.length} aktif ilan** var. Öne çıkan birkaçı:`;
    }

    const top = sorted.slice(0, 5).map(l => toSuggestion(l, intent.showcaseCategory ?? 'Yeni ilan'));

    // Hint kuyruğu
    const hint = categoryLabel
      ? `\n\n💡 İpucu: *"daha ucuz olanlar"*, *"Ankara'dakiler"*, *"yeni model"* gibi sorularla daraltabilirsin.`
      : `\n\n💡 İpucu: Belirli bir araç/ürün ara ya da kategori söyle — *"BMW"*, *"telefon"*, *"daire"*.`;

    return {
      message:      intro + hint,
      suggestions:  top,
      listingCount: listings.length,
    };
  }

  // ── Default: standart arama ──────────────────────────────────────────────
  if (!source) {
    // Source bulunamadıysa bile yine bir şeyler göster — boş "ilan ver" yerine
    const top = listings.slice(0, 5).map(l => toSuggestion(l, 'Öne çıkan'));
    if (top.length > 0) {
      return {
        message: `Aramana net bir eşleşme bulamadım ama platformdan **${listings.length} ilan** var. İşte sana birkaç öneri:\n\n💡 *"BMW"*, *"hibrit"*, *"Ankara"* gibi spesifik kelimeler ekleyerek daraltabilirsin.`,
        suggestions:  top,
        listingCount: listings.length,
      };
    }
    return {
      message:      buildMessage(query, null, [], listings.length),
      suggestions:  [],
      listingCount: listings.length,
    };
  }

  // Kategori + fiyat aralığı uyumu (PS5'i Tesla'ya önerme)
  let candPool = listings.filter(l => l.id !== source.id && l.ownerId !== source.ownerId);
  const sameCat2 = candPool.filter(l => l.category === source.category);
  if (sameCat2.length > 0) candPool = sameCat2;
  candPool = candPool.filter(l =>
    l.estimatedValue >= source.estimatedValue * PRICE_FILTER.minRatio &&
    l.estimatedValue <= source.estimatedValue * PRICE_FILTER.maxRatio
  );

  const candidates = candPool
    .map(l => scoreOne(source, l))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 5);

  return {
    message:      buildMessage(query, source, candidates, listings.length),
    suggestions:  candidates,
    listingCount: listings.length,
  };
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}
function pct(r: number): string {
  return `%${Math.round(r * 100)}`;
}
