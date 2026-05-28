import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { optionalAuth } from '../middleware/auth';
import { runSwapAI, runConversationalAI, type AIListing, type ConversationTurn } from '../lib/swapAI';

const router = Router();

// ─── POST /api/ai/describe ────────────────────────────────────────────────────
// Araç bilgilerinden otomatik açıklama metni üretir.

const DescribeSchema = z.object({
  brand:             z.string().min(1),
  model:             z.string().min(1),
  year:              z.number().int().min(1990).max(new Date().getFullYear()),
  km:                z.number().int().min(0).optional(),
  fuel:              z.string().optional(),
  transmission:      z.string().optional(),
  color:             z.string().optional(),
  bodyType:          z.string().optional(),
  hasAccidentRecord: z.boolean().default(false),
  condition:         z.string().optional(),
  city:              z.string().optional(),
});

function describeAccidentLine(b: boolean): string {
  return b
    ? 'Hasar kaydı bulunmakta — ekspertiz raporu mevcut, detaylar mesajla paylaşılır.'
    : 'Hasar kaydı bulunmamakta — temiz geçmiş ile güven veren bir araç.';
}

function describeKmLine(km?: number, year?: number): string {
  if (km === undefined) return '';
  if (year) {
    const yearsOld   = new Date().getFullYear() - year;
    const avgPerYear = yearsOld > 0 ? km / yearsOld : km;
    if (km < 50_000)             return `Sadece ${km.toLocaleString('tr-TR')} km'de — son derece düşük kilometre.`;
    if (avgPerYear < 12_000)     return `${km.toLocaleString('tr-TR')} km — yıllık ortalama ${Math.round(avgPerYear).toLocaleString('tr-TR')} km, oldukça az kullanılmış.`;
    if (avgPerYear < 20_000)     return `${km.toLocaleString('tr-TR')} km — normal kullanım profili.`;
    return `${km.toLocaleString('tr-TR')} km — yüksek kullanım, ancak bakımlı.`;
  }
  return `${km.toLocaleString('tr-TR')} km bilgisiyle.`;
}

function describeConditionLine(condition?: string): string {
  switch (condition) {
    case 'Mükemmel': return 'Genel durumu mükemmel; iç ve dış aksamları kusursuz.';
    case 'İyi':      return 'Genel durumu iyi; titizlikle korunmuş.';
    case 'Orta':     return 'Genel durumu kabul edilebilir seviyede.';
    case 'Yıpranmış':return 'Yıpranma izleri mevcut, ancak teknik aksam çalışır durumda.';
    default:         return '';
  }
}

router.post('/describe', optionalAuth, async (req, res) => {
  const parsed = DescribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const d = parsed.data;

  // ─── Benzer ilanları çek (aynı marka+model) — fiyat referansı için ─────────
  const similar = await prisma.listing.findMany({
    where:   { isActive: true, brand: d.brand, model: { contains: d.model.split(' ')[0] } },
    select:  { estimatedValue: true, year: true },
    take:    20,
  });

  let priceHint = '';
  if (similar.length >= 2) {
    const avg = Math.round(similar.reduce((s, l) => s + l.estimatedValue, 0) / similar.length);
    priceHint = ` Platformdaki benzer ${d.brand} ${d.model} ilanlarının ortalama değeri ₺${avg.toLocaleString('tr-TR')} civarındadır.`;
  }

  // ─── Açıklama metnini topla ────────────────────────────────────────────────
  const lines: string[] = [];
  const headline = `${d.year} model ${d.brand} ${d.model}${d.color ? ` (${d.color})` : ''}`;
  lines.push(`${headline}, takaslat için sahibinden satılıktır.`);

  const techParts: string[] = [];
  if (d.fuel)         techParts.push(d.fuel.toLowerCase());
  if (d.transmission) techParts.push(d.transmission.toLowerCase());
  if (d.bodyType)     techParts.push(d.bodyType.toLowerCase());
  if (techParts.length > 0) {
    lines.push(`${techParts.join(', ').replace(/^\w/, (c) => c.toUpperCase())} özellikleriyle donatılmış.`);
  }

  const kmLine = describeKmLine(d.km, d.year);
  if (kmLine) lines.push(kmLine);

  const condLine = describeConditionLine(d.condition);
  if (condLine) lines.push(condLine);

  lines.push(describeAccidentLine(d.hasAccidentRecord));

  if (d.city) lines.push(`${d.city}'da yerinde görülebilir.`);

  lines.push(`Takasa açığım, fiyat farkı konusunda esneklik gösterebilirim.${priceHint}`);

  res.json({
    description:    lines.join(' '),
    basedOnSimilar: similar.length,
  });
});

// ─── POST /api/ai/estimate-value ──────────────────────────────────────────────
// Benzer ilanlardan ortalama değer hesaplar.

const EstimateSchema = z.object({
  brand:             z.string().min(1),
  model:             z.string().optional(),
  year:              z.number().int().optional(),
  km:                z.number().int().optional(),
  hasAccidentRecord: z.boolean().default(false),
});

router.post('/estimate-value', optionalAuth, async (req, res) => {
  const parsed = EstimateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const d = parsed.data;

  const where: Record<string, unknown> = { isActive: true, brand: d.brand };
  if (d.model) where.model = { contains: d.model.split(' ')[0] };

  const similar = await prisma.listing.findMany({
    where,
    select: { estimatedValue: true, year: true, km: true, hasAccidentRecord: true },
    take:   50,
  });

  if (similar.length === 0) {
    res.json({
      estimated: null,
      low:       null,
      high:      null,
      basedOn:   0,
      message:   'Bu marka/model için henüz yeterli ilan verisi yok.',
    });
    return;
  }

  // Yıl yakınlığı ile ağırlıklı ortalama
  const weighted = similar.map((l) => {
    let weight = 1;
    if (d.year && l.year) {
      const diff = Math.abs(l.year - d.year);
      weight = Math.max(0.2, 1 - diff * 0.1);
    }
    return { value: l.estimatedValue, weight };
  });

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  const weightedAvg = weighted.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight;

  // Hasar varsa %15 indir
  let adjusted = weightedAvg;
  if (d.hasAccidentRecord) adjusted *= 0.85;

  // Çok yüksek/düşük km için ufak ayarlama
  if (d.km !== undefined) {
    const kmValues = similar.map((l) => l.km ?? 0).filter((k) => k > 0);
    if (kmValues.length > 0) {
      const avgKm = kmValues.reduce((s, k) => s + k, 0) / kmValues.length;
      if (d.km < avgKm * 0.7)      adjusted *= 1.08;
      else if (d.km > avgKm * 1.4) adjusted *= 0.92;
    }
  }

  const estimated = Math.round(adjusted / 5000) * 5000;
  const low       = Math.round(estimated * 0.9 / 5000) * 5000;
  const high      = Math.round(estimated * 1.1 / 5000) * 5000;

  res.json({
    estimated,
    low,
    high,
    basedOn: similar.length,
    message: `Platformdaki ${similar.length} benzer ilanın ortalama değeri ${estimated.toLocaleString('tr-TR')}₺ olarak hesaplandı.`,
  });
});

const VisualDescriptionSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(3),
  size:     z.number().nonnegative(),
});

router.post('/visual-description', optionalAuth, async (req, res) => {
  const parsed = VisualDescriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { fileName, mimeType, size } = parsed.data;
  const lower = fileName.toLowerCase();
  const isPdf = mimeType === 'application/pdf';
  const risks: string[] = [];
  const checks = isPdf
    ? ['Ekspertiz tarihini kontrol et', 'Şasi/plaka bilgisinin ilanla uyumunu doğrula', 'Boya-değişen ve tramer satırlarını karşılaştır']
    : ['Kaput/çamurluk panel aralıkları', 'Far ve tampon hizası', 'Lastik diş durumu', 'İç trim aşınması'];

  if (size < 80_000 && !isPdf) risks.push('Görsel çözünürlüğü düşük olabilir; detay fotoğrafı istenmeli.');
  if (/hasar|kaza|boya|tramer/.test(lower)) risks.push('Dosya adı hasar/boya bilgisi içeriyor; ekspertizle netleştirilmeli.');

  res.json({
    summary: isPdf
      ? 'Ekspertiz/belge dosyası algılandı. İlan detayında güven kanıtı olarak gösterilebilir.'
      : 'Araç/ürün fotoğrafı algılandı. Görsel incelemede özellikle hizalama, boya tonu ve aşınma detayları kontrol edilmeli.',
    checks,
    risks,
  });
});

type ListingLike = {
  id: string;
  title: string;
  category: string;
  estimatedValue: number;
  description: string;
  wantedFor: string;
  city: string;
  images: string;
  condition: string;
  tags: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  km: number | null;
  fuel: string | null;
  transmission: string | null;
  color: string | null;
  hasAccidentRecord: boolean;
  bodyType: string | null;
  engineCC: number | null;
  attachments: string | null;
  viewCount: number;
  createdAt: Date;
};

function asArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function words(text: string): string[] {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function listingText(l: ListingLike): string {
  return [
    l.title, l.category, l.description, l.wantedFor, l.city,
    l.brand ?? '', l.model ?? '', l.fuel ?? '', l.bodyType ?? '',
    ...asArray(l.tags).map(String),
  ].join(' ').toLocaleLowerCase('tr-TR');
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} TL`;
}

function scoreSwap(source: ListingLike, target: ListingLike) {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const diff = Math.abs(source.estimatedValue - target.estimatedValue);
  const avgValue = Math.max(1, (source.estimatedValue + target.estimatedValue) / 2);
  const diffRatio = diff / avgValue;
  const priceScore = Math.max(0, Math.round(35 - diffRatio * 90));
  if (diffRatio <= 0.15) reasons.push('Fiyat aralığı oldukça yakın.');
  else if (diffRatio <= 0.3) reasons.push('Fiyat farkı pazarlıkla kapanabilir.');
  else warnings.push('Fiyat farkı yüksek; nakit fark net konuşulmalı.');

  const categoryScore = source.category === target.category ? 18 : 8;
  if (source.category === target.category) reasons.push('Kategori aynı olduğu için takas niyeti daha net.');

  const sourceWant = source.wantedFor.toLocaleLowerCase('tr-TR');
  const targetPool = listingText(target);
  const wantHits = words(sourceWant).filter((w) => targetPool.includes(w)).slice(0, 6);
  let preferenceScore = Math.min(22, wantHits.length * 5);
  if (/suv|crossover|4x4/.test(sourceWant) && /suv|crossover|4x4/.test(targetPool)) preferenceScore += 8;
  if (target.brand && sourceWant.includes(target.brand.toLocaleLowerCase('tr-TR'))) preferenceScore += 6;
  preferenceScore = Math.min(25, preferenceScore);
  if (preferenceScore > 10) reasons.push('Satıcının istek metni hedef ilanla örtüşüyor.');

  const cityScore = source.city === target.city ? 12 : 5;
  if (source.city === target.city) reasons.push('Aynı şehirde ekspertiz ve görüşme daha kolay.');

  let qualityScore = 10;
  if (target.category === 'Araç') {
    const age = target.year ? new Date().getFullYear() - target.year : 8;
    if (age <= 4) qualityScore += 5;
    if ((target.km ?? 999_999) < 80_000) qualityScore += 5;
    if (!target.hasAccidentRecord) qualityScore += 4;
    if (target.hasAccidentRecord) warnings.push('Hedef ilanda hasar kaydı var; ekspertiz şart.');
  } else {
    qualityScore += target.description.length > 120 ? 6 : 0;
  }
  qualityScore = Math.min(20, qualityScore);

  const total = Math.max(1, Math.min(98, priceScore + categoryScore + preferenceScore + cityScore + qualityScore));
  return {
    listingId: target.id,
    title: target.title,
    city: target.city,
    value: target.estimatedValue,
    compatibilityScore: total,
    priceDiff: target.estimatedValue - source.estimatedValue,
    breakdown: { priceScore, categoryScore, preferenceScore, cityScore, qualityScore },
    reasons,
    warnings,
    negotiationTip: diffRatio > 0.25
      ? `Fark yüksek. ${money(Math.abs(target.estimatedValue - source.estimatedValue) * 0.9)} - ${money(Math.abs(target.estimatedValue - source.estimatedValue) * 1.1)} bandında konuş.`
      : 'Fiyat yakın. Önce ekspertiz ve belge üzerinden güven oluştur, sonra farkı netleştir.',
  };
}

async function getListingOr404(id: string, res: import('express').Response) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing) {
    res.status(404).json({ error: 'İlan bulunamadı' });
    return null;
  }
  return listing as unknown as ListingLike;
}

const SwapScoreSchema = z.object({
  sourceListingId: z.string(),
  targetListingId: z.string().optional(),
});

router.post('/swap-score', optionalAuth, async (req, res) => {
  const parsed = SwapScoreSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const source = await getListingOr404(parsed.data.sourceListingId, res);
  if (!source) return;
  const targets = parsed.data.targetListingId
    ? await prisma.listing.findMany({ where: { id: parsed.data.targetListingId, isActive: true } })
    : await prisma.listing.findMany({ where: { isActive: true, id: { not: source.id } }, take: 80 });
  const suggestions = (targets as unknown as ListingLike[])
    .map((target) => scoreSwap(source, target))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, parsed.data.targetListingId ? 1 : 8);
  res.json({ source: { id: source.id, title: source.title, value: source.estimatedValue }, suggestions });
});

const PriceGapSchema = z.object({
  sourceListingId: z.string().optional(),
  targetListingId: z.string().optional(),
  sourceValue: z.number().positive().optional(),
  targetValue: z.number().positive().optional(),
});

router.post('/price-gap', optionalAuth, async (req, res) => {
  const parsed = PriceGapSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const source = parsed.data.sourceListingId ? await getListingOr404(parsed.data.sourceListingId, res) : null;
  if (parsed.data.sourceListingId && !source) return;
  const target = parsed.data.targetListingId ? await getListingOr404(parsed.data.targetListingId, res) : null;
  if (parsed.data.targetListingId && !target) return;
  const sourceValue = source?.estimatedValue ?? parsed.data.sourceValue;
  const targetValue = target?.estimatedValue ?? parsed.data.targetValue;
  if (!sourceValue || !targetValue) { res.status(400).json({ error: 'Kaynak ve hedef değer gerekli' }); return; }
  const rawDiff = targetValue - sourceValue;
  const abs = Math.abs(rawDiff);
  const fairMin = Math.round(abs * 0.85 / 5000) * 5000;
  const fairMax = Math.round(abs * 1.12 / 5000) * 5000;
  const ratio = abs / Math.max(sourceValue, targetValue);
  res.json({
    rawDiff,
    payer: rawDiff > 0 ? 'sourceUser' : rawDiff < 0 ? 'targetUser' : 'none',
    fairRange: { min: fairMin, max: fairMax },
    verdict: ratio <= 0.12 ? 'mantıklı' : ratio <= 0.28 ? 'pazarlık gerekli' : 'yüksek fark',
    explanation: ratio <= 0.12
      ? 'Değerler yakın; ekspertiz sonucu küçük farklarla kapanabilir.'
      : ratio <= 0.28
        ? 'Fark makul ama ödeme şekli ve ekspertiz sonucuna göre yeniden konuşulmalı.'
        : 'Fark yüksek. Teklif mesajında nakit fark, ödeme zamanı ve belgeler net yazılmalı.',
  });
});

const OfferQualitySchema = z.object({
  message: z.string().min(1).max(1200),
  listingId: z.string().optional(),
  offeredListingId: z.string().optional(),
  offeredValue: z.number().positive().optional(),
});

router.post('/offer-quality', optionalAuth, async (req, res) => {
  const parsed = OfferQualitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const msg = parsed.data.message;
  const lower = msg.toLocaleLowerCase('tr-TR');
  let score = 45;
  const positives: string[] = [];
  const issues: string[] = [];
  if (msg.length >= 80) { score += 12; positives.push('Mesaj yeterince detaylı.'); } else { issues.push('Mesaj kısa; ürün detayı ve fark bilgisi eklenmeli.'); }
  if (/merhaba|selam|iyi günler|teşekkür/.test(lower)) { score += 8; positives.push('Nazik bir giriş var.'); } else issues.push('Nazik bir açılış ekle.');
  if (/ekspertiz|servis|bakım|fatura|belge/.test(lower)) { score += 14; positives.push('Güven veren belge/ekspertiz vurgusu var.'); } else issues.push('Ekspertiz, bakım veya belge önerisi yok.');
  if (/fark|nakit|tl|₺/.test(lower) || parsed.data.offeredValue) { score += 12; positives.push('Fiyat farkı konuşmaya açık.'); } else issues.push('Fiyat farkı belirsiz.');
  if (/hemen|son fiyat|olmaz|kesin/.test(lower)) { score -= 12; issues.push('Baskıcı ifade karşı tarafı kapatabilir.'); }
  score = Math.max(10, Math.min(98, score));
  res.json({
    score,
    positives,
    issues,
    improvedMessage: `Merhaba, ilanınızla ilgileniyorum. Kendi aracım/ürünüm için bakım, hasar ve belge detaylarını paylaşabilirim. Ekspertiz sonrası makul fiyat farkını birlikte netleştirebiliriz. Uygunsa görüşmek isterim.`,
  });
});

const AutoMessageSchema = z.object({
  sourceListingId: z.string().optional(),
  targetListingId: z.string(),
  tone: z.enum(['samimi', 'profesyonel', 'kısa']).default('profesyonel'),
});

router.post('/auto-message', optionalAuth, async (req, res) => {
  const parsed = AutoMessageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const target = await getListingOr404(parsed.data.targetListingId, res);
  if (!target) return;
  const source = parsed.data.sourceListingId ? await getListingOr404(parsed.data.sourceListingId, res) : null;
  if (parsed.data.sourceListingId && !source) return;
  const diff = source ? target.estimatedValue - source.estimatedValue : null;
  const sourceLine = source ? `${source.title} ilanımla takas değerlendirmek isterim` : 'takas teklifimi değerlendirmek isterim';
  const diffLine = diff === null ? 'Fiyat farkını ilan detaylarına göre konuşabiliriz.' : diff > 0 ? `${money(diff)} civarı fark ödemeyi değerlendirebilirim.` : `${money(Math.abs(diff))} civarı fark talep edebilirim.`;
  const message = parsed.data.tone === 'kısa'
    ? `Merhaba, ${target.title} için ${sourceLine}. ${diffLine}`
    : `Merhaba, ${target.title} ilanınızla ilgileniyorum. ${sourceLine}. Bakım/ekspertiz ve belge detaylarını karşılıklı paylaşabiliriz. ${diffLine} Uygunsa kısa bir görüşme planlayalım.`;
  res.json({ message, diff });
});

const FeedSchema = z.object({
  favoriteIds: z.array(z.string()).default([]),
  searchHistory: z.array(z.string()).default([]),
  wishlistTerms: z.array(z.string()).default([]),
});

router.post('/personal-feed', optionalAuth, async (req, res) => {
  const parsed = FeedSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const all = await prisma.listing.findMany({ where: { isActive: true, moderationStatus: 'approved' }, take: 120 });
  const favorites = parsed.data.favoriteIds.length
    ? await prisma.listing.findMany({ where: { id: { in: parsed.data.favoriteIds } } })
    : [];
  const profileText = [
    ...favorites.map((l) => `${l.title} ${l.category} ${l.brand ?? ''} ${l.model ?? ''} ${l.city}`),
    ...parsed.data.searchHistory,
    ...parsed.data.wishlistTerms,
  ].join(' ').toLocaleLowerCase('tr-TR');
  const profileWords = words(profileText);
  const items = (all as unknown as ListingLike[])
    .map((l) => {
      const pool = listingText(l);
      const hits = profileWords.filter((w) => pool.includes(w));
      const score = Math.min(95, 35 + hits.length * 7 + (parsed.data.favoriteIds.includes(l.id) ? -30 : 0));
      return { listingId: l.id, title: l.title, city: l.city, value: l.estimatedValue, score, reasons: hits.slice(0, 4) };
    })
    .filter((i) => i.score > 38)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  res.json({ items, profileSignals: profileWords.slice(0, 10) });
});

const ConversationCoachSchema = z.object({
  lastMessage: z.string().min(1).max(1200),
  listingId: z.string().optional(),
});

router.post('/conversation-coach', optionalAuth, async (req, res) => {
  const parsed = ConversationCoachSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const lower = parsed.data.lastMessage.toLocaleLowerCase('tr-TR');
  const intent = /fark|para|nakit|tl|₺/.test(lower) ? 'fiyat farkı' : /ekspertiz|belge|hasar|tramer/.test(lower) ? 'güven/belge' : /ne zaman|buluş|görüş/.test(lower) ? 'randevu' : 'genel pazarlık';
  const caution = /son|hemen|kesin|olmaz/.test(lower) ? 'Ton biraz sert; cevabı yumuşat.' : 'Ton normal; net ve kısa cevap ver.';
  res.json({
    intent,
    caution,
    replies: [
      'Haklısınız, ekspertiz sonucuna göre fiyat farkını netleştirebiliriz. Belgeleri karşılıklı paylaşalım.',
      'Benim için de uygun. Önce araç/ürün detaylarını netleştirip ardından yüz yüze görüşme planlayabiliriz.',
      'Fark konusunda makul bir aralıkta konuşabilirim; bakım ve hasar durumuna göre son rakamı belirleyelim.',
    ],
    nextBestAction: intent === 'randevu' ? 'Net gün/saat ve güvenli buluşma noktası öner.' : 'Belge ve fiyat farkı bilgisini aynı mesajda netleştir.',
  });
});

const RiskSchema = z.object({ listingId: z.string() });

router.post('/risk', optionalAuth, async (req, res) => {
  const parsed = RiskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const listing = await getListingOr404(parsed.data.listingId, res);
  if (!listing) return;
  let riskScore = 12;
  const risks: string[] = [];
  const positives: string[] = [];
  const images = asArray(listing.images);
  const attachments = asArray(listing.attachments);
  if (images.length < 3) { riskScore += 14; risks.push('Fotoğraf sayısı az.'); } else positives.push('Fotoğraf sayısı iyi.');
  if (listing.description.length < 120) { riskScore += 12; risks.push('Açıklama kısa.'); }
  if (listing.category === 'Araç') {
    if (listing.hasAccidentRecord) { riskScore += 18; risks.push('Hasar kaydı var.'); } else positives.push('Hasar kaydı yok olarak girilmiş.');
    if ((listing.km ?? 0) > 160_000) { riskScore += 12; risks.push('Kilometre yüksek.'); }
    if (attachments.length === 0) { riskScore += 10; risks.push('Ekspertiz/belge eklenmemiş.'); } else positives.push('Belge/ekspertiz eki var.');
  }
  if (listing.estimatedValue < 100_000) { riskScore += 5; risks.push('Fiyat çok düşük; açıklama ve belge kontrol edilmeli.'); }
  riskScore = Math.max(1, Math.min(95, riskScore));
  res.json({
    riskScore,
    level: riskScore < 30 ? 'düşük' : riskScore < 60 ? 'orta' : 'yüksek',
    risks,
    positives,
    checklist: ['Ekspertiz raporu iste', 'Ruhsat/seri no bilgisini doğrula', 'Güvenli yerde yüz yüze görüş', 'Kapora göndermeden önce kimlik ve belge kontrolü yap'],
  });
});

const ListingQualitySchema = z.object({
  listingId: z.string().optional(),
  draft: z.record(z.unknown()).optional(),
});

router.post('/listing-quality', optionalAuth, async (req, res) => {
  const parsed = ListingQualitySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const dbListing = parsed.data.listingId ? await getListingOr404(parsed.data.listingId, res) : null;
  if (parsed.data.listingId && !dbListing) return;
  const d = (dbListing ?? parsed.data.draft ?? {}) as Record<string, unknown>;
  let score = 100;
  const fixes: string[] = [];
  const title = String(d.title ?? '');
  const description = String(d.description ?? '');
  const wantedFor = String(d.wantedFor ?? '');
  const category = String(d.category ?? '');
  const vehicleDetails = d.vehicleDetails as Record<string, unknown> | undefined;
  const isVehicle = category === 'Araç' || category.toLowerCase().startsWith('ara') || Boolean(d.brand) || Boolean(vehicleDetails?.brand);
  const images = Array.isArray(d.images) ? d.images : asArray(d.images as string | null);
  const attachments = Array.isArray(d.attachments) ? d.attachments : asArray(d.attachments as string | null);
  if (title.length < 12) { score -= 12; fixes.push('Başlığı marka/model/yıl içerecek şekilde güçlendir.'); }
  if (description.length < 160) { score -= 18; fixes.push('Açıklamaya bakım, kusur, donanım ve takas sebebi ekle.'); }
  if (wantedFor.length < 30) { score -= 14; fixes.push('Ne istediğini ve fiyat farkı sınırını açık yaz.'); }
  if (images.length < 4) { score -= 16; fixes.push('En az 4 fotoğraf ekle: ön, arka, iç, km/ekran.'); }
  if (isVehicle && attachments.length === 0) { score -= 10; fixes.push('Ekspertiz/servis belgesi ekle.'); }
  score = Math.max(5, score);
  res.json({
    score,
    grade: score >= 85 ? 'çok iyi' : score >= 65 ? 'iyi' : score >= 45 ? 'geliştirilmeli' : 'zayıf',
    fixes,
    improvedDescription: `${title || 'İlan'} için bakım, kullanım durumu, varsa kusurlar ve takas beklentileri net şekilde belirtilmiştir. Ekspertiz ve ek fotoğraflar mesajla paylaşılabilir.`,
  });
});

router.get('/market-insights', async (_req, res) => {
  const listings = await prisma.listing.findMany({ where: { isActive: true, moderationStatus: 'approved' } });
  const byBrand = new Map<string, { count: number; value: number; views: number }>();
  const byCity = new Map<string, { count: number; value: number }>();
  for (const l of listings) {
    if (l.brand) {
      const b = byBrand.get(l.brand) ?? { count: 0, value: 0, views: 0 };
      byBrand.set(l.brand, { count: b.count + 1, value: b.value + l.estimatedValue, views: b.views + l.viewCount });
    }
    const c = byCity.get(l.city) ?? { count: 0, value: 0 };
    byCity.set(l.city, { count: c.count + 1, value: c.value + l.estimatedValue });
  }
  res.json({
    hotBrands: Array.from(byBrand.entries()).map(([brand, s]) => ({ brand, count: s.count, avgValue: Math.round(s.value / s.count), demandScore: s.count * 3 + s.views })).sort((a, b) => b.demandScore - a.demandScore).slice(0, 6),
    cityPremiums: Array.from(byCity.entries()).map(([city, s]) => ({ city, count: s.count, avgValue: Math.round(s.value / s.count) })).sort((a, b) => b.avgValue - a.avgValue).slice(0, 6),
    insight: listings.length < 10 ? "Daha iyi pazar tahmini icin platformda daha fazla ilan birikmeli." : "Platformdaki aktif ilanlardan marka talebi ve sehir fiyat farki hesaplandi.",
  });
});

const ScenariosSchema = z.object({
  sourceListingId: z.string().optional(),
  targetText: z.string().min(3).max(500),
  maxCashDiff: z.number().nonnegative().optional(),
});

router.post('/scenarios', optionalAuth, async (req, res) => {
  const parsed = ScenariosSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const source = parsed.data.sourceListingId ? await getListingOr404(parsed.data.sourceListingId, res) : null;
  if (parsed.data.sourceListingId && !source) return;
  const baseValue = source?.estimatedValue ?? 0;
  const maxDiff = parsed.data.maxCashDiff ?? Math.round(baseValue * 0.2);
  res.json({
    scenarios: [
      { name: 'Direkt hedefe git', difficulty: 'orta', plan: `Hedef ilana doğrudan teklif ver. ${money(maxDiff)} civarı fark bütçesini net belirt.`, bestFor: 'Hızlı sonuç almak' },
      { name: 'Ara takas basamağı', difficulty: 'düşük', plan: 'Önce daha yakın fiyatlı ve talebi yüksek bir ilanla takas yap, sonra hedef segmente geç.', bestFor: 'Nakit farkı azaltmak' },
      { name: 'İlanı güçlendir + bekle', difficulty: 'düşük', plan: 'Fotoğraf, ekspertiz ve açıklamayı güçlendirip 7-10 gün teklif topla; sonra en güçlü adayla pazarlık yap.', bestFor: 'Daha iyi teklif almak' },
    ],
    summary: `${parsed.data.targetText} hedefi için ${source ? source.title : 'mevcut varlık'} üzerinden 3 yol çıkarıldı.`,
  });
});

const QuerySchema = z.object({
  query:            z.string().min(1).max(500),
  currentListingId: z.string().optional().nullable(),
  conversation:     z.array(z.object({
    role:         z.enum(['user', 'assistant']),
    content:      z.string(),
    candidateIds: z.array(z.string()).optional(),
  })).optional(),
});

// ─── POST /api/ai/match ───────────────────────────────────────────────────────

const AdviceSchema = z.object({
  listingId: z.string().optional(),
  userText:  z.string().min(3).max(1000),
});

router.post('/advice', optionalAuth, async (req, res) => {
  const parsed = AdviceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const listing = parsed.data.listingId
    ? await prisma.listing.findUnique({ where: { id: parsed.data.listingId } })
    : null;
  const all = await prisma.listing.findMany({
    where: { isActive: true, moderationStatus: 'approved' },
    orderBy: { updatedAt: 'desc' },
    take: 80,
  });
  const text = parsed.data.userText.toLowerCase();
  const budgetMatch = text.match(/(\d[\d\.\s]{3,})/);
  const mentionedValue = budgetMatch ? Number(budgetMatch[1].replace(/[^\d]/g, '')) : null;
  const targetValue = listing?.estimatedValue ?? mentionedValue;

  const candidates = all
    .filter((l) => !listing || l.id !== listing.id)
    .map((l) => {
      let score = 40;
      if (targetValue) {
        const diffRatio = Math.abs(l.estimatedValue - targetValue) / targetValue;
        score += Math.max(0, 35 - Math.round(diffRatio * 100));
      }
      if (listing && l.category === listing.category) score += 15;
      if (listing && l.city === listing.city) score += 10;
      if (l.brand && text.includes(l.brand.toLowerCase())) score += 12;
      return { listingId: l.id, title: l.title, city: l.city, value: l.estimatedValue, score: Math.min(96, score) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  res.json({
    message: listing
      ? `${listing.title} için platforma kayıtlı aktif ilanlara göre en uygun takas adayları çıkarıldı.`
      : 'Yazdığın ihtiyaca göre fiyat ve kategori uyumlu seçenekler çıkarıldı.',
    candidates,
    tips: [
      'Teklifte kendi ürününün hasar/bakım/garanti bilgisini net yaz.',
      'Fiyat farkını tek rakam yerine pazarlık payı olan aralıkla belirt.',
      'Aynı şehirde ekspertiz ve yüz yüze kontrol önermek güveni artırır.',
    ],
    suggestedMessage: listing
      ? `Merhaba, ${listing.title} ilanınızla ilgileniyorum. Kendi aracım/ürünüm için detayları paylaşabilirim; ekspertiz ve fiyat farkını birlikte netleştirebiliriz.`
      : 'Merhaba, ilanınızla ilgileniyorum. Takas için ürünümün detaylarını ve olası fiyat farkını paylaşabilirim.',
  });
});

router.post('/match', optionalAuth, async (req, res) => {
  const parsed = QuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { query, currentListingId, conversation } = parsed.data;

  // Tüm aktif ilanları DB'den çek (sınır yok — AI tüm veriyi görür)
  const dbListings = await prisma.listing.findMany({
    where:   { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { owner: { select: { id: true, name: true, avatar: true } } },
  });

  // AI formatına dönüştür
  const listings: AIListing[] = dbListings.map(l => {
    const images = (() => { try { return JSON.parse(l.images as string) as string[]; } catch { return [l.images as string]; } })();
    const tags   = (() => { try { return JSON.parse(l.tags   as string) as string[]; } catch { return []; } })();
    const owner  = l.owner as { id: string; name: string; avatar?: string | null } | undefined;

    return {
      id:             l.id,
      title:          l.title,
      category:       l.category,
      estimatedValue: l.estimatedValue,
      description:    l.description,
      wantedFor:      l.wantedFor,
      city:           l.city,
      images,
      tags,
      condition:      l.condition,
      ownerId:        owner?.id      ?? l.ownerId,
      ownerName:      owner?.name    ?? 'Kullanıcı',
      ownerAvatar:    owner?.avatar  ?? '',
      createdAt:      l.createdAt,
      vehicleDetails: l.brand ? {
        brand:             l.brand        ?? undefined,
        model:             l.model        ?? undefined,
        year:              l.year         ?? undefined,
        km:                l.km           ?? undefined,
        fuel:              l.fuel         ?? undefined,
        transmission:      l.transmission ?? undefined,
        color:             l.color        ?? undefined,
        hasAccidentRecord: l.hasAccidentRecord,
        bodyType:          l.bodyType     ?? undefined,
        engineCC:          l.engineCC     ?? undefined,
      } : null,
    };
  });

  const result = runConversationalAI({
    query,
    currentListingId,
    listings,
    history: (conversation as ConversationTurn[] | undefined) ?? [],
  });

  res.json(result);
});

// ─── POST /api/ai/negotiate ───────────────────────────────────────────────────
// Negosiasyon simülasyonu: kullanıcı mesajını analiz et + karşı tarafın olası yanıtlarını öngör

const NegotiateSchema = z.object({
  myMessage:        z.string().min(5).max(1000),
  listingId:        z.string().optional(),
  offeredValue:     z.number().optional(),
  scenario:         z.enum(['öneri', 'değer-pazarlığı', 'fark-talebi', 'red']).optional(),
});

router.post('/negotiate', optionalAuth, async (req, res) => {
  const parsed = NegotiateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const { myMessage, listingId, offeredValue } = parsed.data;

  const listing = listingId
    ? await prisma.listing.findUnique({ where: { id: listingId } })
    : null;

  const lower = myMessage.toLowerCase();
  const wordCount = myMessage.split(/\s+/).length;

  // ── Tonu analiz et ─────────────────────────────────────────────────────────
  const tone: { type: 'agresif' | 'pasif' | 'dengeli'; reason: string } = (() => {
    if (/(hemen|şimdi|kesin|olmaz|asla|kabul etmem|son fiyat)/.test(lower)) {
      return { type: 'agresif', reason: 'Kesin/baskıcı ifadeler kullanılmış' };
    }
    if (wordCount < 8 || /(olabilir mi|acaba|mümkün mü|izin verirseniz)/.test(lower)) {
      return { type: 'pasif', reason: 'Çok kısa veya çekingen ifade' };
    }
    return { type: 'dengeli', reason: 'Profesyonel ve dengeli ton' };
  })();

  // ── Mesaj uzunluğu skoru ──────────────────────────────────────────────────
  const lengthScore =
    wordCount < 5  ? { score: 30, note: 'Çok kısa — daha açıklayıcı olabilirsin' } :
    wordCount < 15 ? { score: 55, note: 'Kısa ama yeterli — biraz detay eklenebilir' } :
    wordCount < 50 ? { score: 90, note: 'İdeal uzunlukta' } :
                     { score: 65, note: 'Çok uzun — kısalt' };

  // ── Olumlu/olumsuz işaretler ───────────────────────────────────────────────
  const positives: string[] = [];
  const negatives: string[] = [];

  if (/teşekkür|sağol/.test(lower)) positives.push('Nezaket göstermişsin (+10 puan)');
  if (/ekspertiz|servis|bakım|fatura/.test(lower)) positives.push('Belge önerisi — güven veriyor');
  if (/buluşalım|görüşelim|yerinde/.test(lower)) positives.push('Yüz yüze öneri — ciddiyet katıyor');
  if (/esnek|pazarlık|fark/.test(lower)) positives.push('Esneklik sinyali');
  if (myMessage.includes('!')) negatives.push('Ünlem işareti agresif gelebilir');
  if (/hemen|şimdi|son fiyat|olmaz|kesin/.test(lower)) negatives.push('Baskı ifadeleri karşı tarafı kapatabilir');
  if (wordCount < 5) negatives.push('Çok kısa — ciddiyet eksikliği izlenimi verebilir');

  // ── Karşı tarafın olası yanıtları (3 senaryo) ─────────────────────────────
  type Possibility = { probability: number; type: 'kabul' | 'pazarlık' | 'red'; message: string; reason: string };
  const possibilities: Possibility[] = [];

  if (tone.type === 'agresif') {
    possibilities.push({ probability: 50, type: 'red', message: 'Bu fiyata olmaz, başka teklif bekliyorum.', reason: 'Baskıcı ton savunma refleksi yaratır' });
    possibilities.push({ probability: 35, type: 'pazarlık', message: 'Önerinizi düşüneyim, ama mesajınızda biraz daha esnek olmanızı isterim.', reason: 'Esneklik ister' });
    possibilities.push({ probability: 15, type: 'kabul', message: 'Olur, bu şartlarda kabul.', reason: 'Düşük olasılık' });
  } else if (tone.type === 'pasif') {
    possibilities.push({ probability: 50, type: 'pazarlık', message: 'Daha detaylı bilgi verebilir misiniz? Aracınızın durumu hakkında.', reason: 'Belirsizliği gidermek ister' });
    possibilities.push({ probability: 30, type: 'red', message: 'Sanırım kararsızsınız. Başka takasları da değerlendireceğim.', reason: 'Kararsızlık güvensizlik verir' });
    possibilities.push({ probability: 20, type: 'kabul', message: 'Tamam, buluşalım.', reason: 'Şanslı atış' });
  } else {
    possibilities.push({ probability: 45, type: 'pazarlık', message: 'Önerinizi dikkate aldım, ufak bir fark talep ediyorum.', reason: 'Profesyonel ton karşılıklı görüşmeye açar' });
    possibilities.push({ probability: 35, type: 'kabul', message: 'Mantıklı bir teklif, kabul ediyorum. Belgeleri inceleyelim.', reason: 'Dengeli ton güven verir' });
    possibilities.push({ probability: 20, type: 'red', message: 'Şu an için uygun bulmuyorum, başka takas seçeneklerim var.', reason: 'Düşük olasılık' });
  }

  // ── Tavsiyeler ─────────────────────────────────────────────────────────────
  const tips: string[] = [];
  if (tone.type === 'agresif') tips.push('Daha yumuşak başla — "şu fiyat aralığında konuşabilir miyiz?" gibi açık uçlu sorular sor');
  if (tone.type === 'pasif')    tips.push('Daha kararlı bir dil kullan — talep ettiğin şeyi açıkça belirt');
  if (!positives.length)        tips.push('Belge/servis kaydından bahset — güven verir');
  if (offeredValue && listing && offeredValue < listing.estimatedValue * 0.85)
    tips.push(`Önerin ilan değerinden %${Math.round((1 - offeredValue / listing.estimatedValue) * 100)} düşük — kabul oranı azalır`);
  tips.push('Aynı şehirde buluşma teklif et — ciddiyet katar');

  res.json({
    analysis: {
      tone:          tone.type,
      toneReason:    tone.reason,
      length:        lengthScore,
      positives,
      negatives,
      overallScore:  Math.max(0, Math.min(100, Math.round(
        lengthScore.score +
        positives.length * 5 -
        negatives.length * 8 +
        (tone.type === 'dengeli' ? 10 : tone.type === 'pasif' ? -5 : -10)
      ))),
    },
    possibilities: possibilities.sort((a, b) => b.probability - a.probability),
    tips,
  });
});

// ─── GET /api/ai/deals ────────────────────────────────────────────────────────
// Aynı kategori+marka+model bazında ortalamadan ucuz olan ilanları "fırsat" olarak işaretler

router.get('/deals', async (_req, res) => {
  const listings = await prisma.listing.findMany({
    where:  { isActive: true },
    include: { owner: { select: { id: true, name: true, avatar: true } } },
  });

  // Marka + model bazlı ortalama
  const groups = new Map<string, { sum: number; count: number; items: typeof listings }>();
  for (const l of listings) {
    const key = `${l.category}|${l.brand ?? ''}|${l.model ?? ''}`;
    const g = groups.get(key) ?? { sum: 0, count: 0, items: [] };
    g.sum   += l.estimatedValue;
    g.count += 1;
    g.items.push(l);
    groups.set(key, g);
  }

  // Fırsatlar: ortalamadan ≥ %15 ucuz olanlar (grup en az 2 ilan içermeli)
  const deals: Array<{ listing: typeof listings[0]; avgPrice: number; saving: number; savingPct: number }> = [];
  for (const g of groups.values()) {
    if (g.count < 2) continue;
    const avg = g.sum / g.count;
    for (const l of g.items) {
      if (l.estimatedValue < avg * 0.85) {
        deals.push({
          listing:    l,
          avgPrice:   Math.round(avg),
          saving:     Math.round(avg - l.estimatedValue),
          savingPct:  Math.round((1 - l.estimatedValue / avg) * 100),
        });
      }
    }
  }

  // En yüksek tasarrufa göre sırala
  deals.sort((a, b) => b.savingPct - a.savingPct);

  res.json({
    deals: deals.slice(0, 12).map((d) => {
      const owner = d.listing.owner as { id: string; name: string; avatar?: string | null } | null;
      const images = (() => { try { return JSON.parse(d.listing.images) as string[]; } catch { return []; } })();
      return {
        listingId:  d.listing.id,
        title:      d.listing.title,
        city:       d.listing.city,
        category:   d.listing.category,
        image:      images[0] ?? '',
        price:      d.listing.estimatedValue,
        avgPrice:   d.avgPrice,
        saving:     d.saving,
        savingPct:  d.savingPct,
        ownerName:  owner?.name ?? 'Kullanıcı',
      };
    }),
    totalAnalyzed: listings.length,
  });
});

// ─── POST /api/ai/budget ──────────────────────────────────────────────────────
// "X TL bütçem var" — bütçeye uygun ilanları kategori bazlı önerir

const BudgetSchema = z.object({
  budget:   z.number().positive(),
  category: z.enum(['Araç', 'Elektronik', 'Gayrimenkul', 'Diğer']).optional(),
  city:     z.string().optional(),
});

router.post('/budget', optionalAuth, async (req, res) => {
  const parsed = BudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const { budget, category, city } = parsed.data;

  const where: Record<string, unknown> = {
    isActive: true,
    estimatedValue: { lte: budget * 1.1 },        // bütçenin %10 üstüne kadar
  };
  if (category) where.category = category;
  if (city)     where.city     = { contains: city };

  const listings = await prisma.listing.findMany({
    where,
    orderBy: { estimatedValue: 'desc' },
    take:    20,
    include: { owner: { select: { id: true, name: true, avatar: true } } },
  });

  // Bütçe analizi
  const inBudget    = listings.filter((l) => l.estimatedValue <= budget);
  const stretch     = listings.filter((l) => l.estimatedValue > budget && l.estimatedValue <= budget * 1.1);

  // Kategori dağılımı
  const byCat = new Map<string, number>();
  for (const l of inBudget) byCat.set(l.category, (byCat.get(l.category) ?? 0) + 1);

  res.json({
    budget,
    inBudgetCount:  inBudget.length,
    stretchCount:   stretch.length,
    byCategory:     Array.from(byCat.entries()).map(([name, count]) => ({ name, count })),
    inBudget: inBudget.slice(0, 8).map((l) => {
      const owner = l.owner as { id: string; name: string; avatar?: string | null } | null;
      const images = (() => { try { return JSON.parse(l.images) as string[]; } catch { return []; } })();
      return {
        listingId:  l.id,
        title:      l.title,
        city:       l.city,
        category:   l.category,
        image:      images[0] ?? '',
        price:      l.estimatedValue,
        utilization: Math.round((l.estimatedValue / budget) * 100), // bütçenin yüzde kaçı
        ownerName:  owner?.name ?? 'Kullanıcı',
      };
    }),
    stretch: stretch.slice(0, 4).map((l) => {
      const images = (() => { try { return JSON.parse(l.images) as string[]; } catch { return []; } })();
      return {
        listingId: l.id,
        title:     l.title,
        city:      l.city,
        image:     images[0] ?? '',
        price:     l.estimatedValue,
        overBy:    l.estimatedValue - budget,
      };
    }),
  });
});

// ─── POST /api/ai/forecast ────────────────────────────────────────────────────
// Değer tahmini — 12 ay üzerine değer kaybı projeksiyonu

const ForecastSchema = z.object({
  listingId: z.string(),
});

router.post('/forecast', optionalAuth, async (req, res) => {
  const parsed = ForecastSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } });
  if (!listing) {
    res.status(404).json({ error: 'İlan bulunamadı' });
    return;
  }

  const isVehicle = listing.category === 'Araç';
  const isElectronic = listing.category === 'Elektronik';

  // Aylık değer kaybı oranı
  let monthlyDepreciation = 0.005; // varsayılan %0.5/ay
  let inflationAdjust     = 0.025; // aylık inflasyon ~%2.5 (TL'de değer korur)
  let factors: string[] = [];

  if (isVehicle) {
    monthlyDepreciation = 0.010; // %1/ay araçlar
    const age = listing.year ? new Date().getFullYear() - listing.year : 5;
    if (age < 3)       { monthlyDepreciation = 0.015; factors.push('Yeni araç — daha hızlı kayıp'); }
    else if (age > 10) { monthlyDepreciation = 0.005; factors.push('Eski araç — değer kaybı yavaş'); }

    if (listing.fuel === 'Elektrik')       { monthlyDepreciation += 0.003; factors.push('Elektrikli — teknoloji eskimesi'); }
    else if (listing.fuel === 'Hibrit')    { monthlyDepreciation -= 0.002; factors.push('Hibrit — talep yüksek, değer korur'); }

    if (listing.hasAccidentRecord) { monthlyDepreciation += 0.003; factors.push('Hasar kaydı — değer kaybı hızlanır'); }

    if ((listing.km ?? 0) > 150_000) { monthlyDepreciation += 0.003; factors.push('Yüksek km — değer kaybı hızlı'); }
  } else if (isElectronic) {
    monthlyDepreciation = 0.020; // %2/ay elektronik
    factors.push('Elektronik — hızlı değer kaybı');
  } else if (listing.category === 'Gayrimenkul') {
    monthlyDepreciation = -0.005; // değer kazanır
    inflationAdjust     = 0.030;
    factors.push('Gayrimenkul — değer kazanır (enflasyon koruması)');
  }

  // 12 aylık projeksiyon
  const months: { month: number; value: number; label: string }[] = [];
  for (let i = 0; i <= 12; i++) {
    // Önce nominal değer kaybı, sonra enflasyon düzeltme
    const realValue = listing.estimatedValue * Math.pow(1 - monthlyDepreciation, i);
    const inflated  = realValue * Math.pow(1 + inflationAdjust, i);

    const date = new Date();
    date.setMonth(date.getMonth() + i);
    months.push({
      month: i,
      value: Math.round(inflated / 5000) * 5000,
      label: date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' }),
    });
  }

  const currentValue   = listing.estimatedValue;
  const after6m        = months[6].value;
  const after12m       = months[12].value;
  const totalChange6m  = ((after6m  - currentValue) / currentValue) * 100;
  const totalChange12m = ((after12m - currentValue) / currentValue) * 100;

  // Tavsiye
  let recommendation = '';
  if (totalChange12m > 5) {
    recommendation = `📈 Değerini koruyor — beklemek değer kazanabilir`;
  } else if (totalChange12m > -10) {
    recommendation = `📊 Normal değer kaybı — şu an satmak için iyi bir zaman`;
  } else {
    recommendation = `📉 Hızlı değer kaybı — kısa sürede takas yapmak avantajlı`;
  }

  res.json({
    listingId:        listing.id,
    title:            listing.title,
    currentValue,
    months,
    summary: {
      after6m,
      after12m,
      totalChange6m,
      totalChange12m,
      monthlyDepreciation: monthlyDepreciation * 100,
      inflationAdjust:     inflationAdjust * 100,
    },
    factors,
    recommendation,
  });
});

// ─── GET /api/ai/trends ───────────────────────────────────────────────────────
// DB analitiği — en popüler markalar, kategoriler, şehirler, ortalama fiyatlar.

router.get('/trends', async (_req, res) => {
  const listings = await prisma.listing.findMany({
    where:  { isActive: true },
    select: {
      category: true, city: true, brand: true, fuel: true,
      estimatedValue: true, viewCount: true, createdAt: true,
    },
  });

  // ── Marka popülerlik (görüntülenme + ilan sayısı) ─────────────────────────
  const brandStats = new Map<string, { count: number; totalViews: number; totalValue: number }>();
  for (const l of listings) {
    if (!l.brand) continue;
    const cur = brandStats.get(l.brand) ?? { count: 0, totalViews: 0, totalValue: 0 };
    brandStats.set(l.brand, {
      count:      cur.count + 1,
      totalViews: cur.totalViews + (l.viewCount ?? 0),
      totalValue: cur.totalValue + l.estimatedValue,
    });
  }

  const topBrands = Array.from(brandStats.entries())
    .map(([brand, s]) => ({
      brand,
      count:    s.count,
      views:    s.totalViews,
      avgPrice: Math.round(s.totalValue / s.count),
      // Popülerlik skoru: ilan sayısı * 2 + görüntülenme
      score:    s.count * 2 + s.totalViews,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // ── Kategori dağılımı ───────────────────────────────────────────────────────
  const byCategory = new Map<string, number>();
  for (const l of listings) {
    byCategory.set(l.category, (byCategory.get(l.category) ?? 0) + 1);
  }
  const categories = Array.from(byCategory.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Şehir dağılımı ──────────────────────────────────────────────────────────
  const byCity = new Map<string, number>();
  for (const l of listings) byCity.set(l.city, (byCity.get(l.city) ?? 0) + 1);
  const topCities = Array.from(byCity.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // ── Yakıt dağılımı (araç) ───────────────────────────────────────────────────
  const byFuel = new Map<string, number>();
  for (const l of listings) {
    if (!l.fuel) continue;
    byFuel.set(l.fuel, (byFuel.get(l.fuel) ?? 0) + 1);
  }
  const fuels = Array.from(byFuel.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Genel istatistikler ─────────────────────────────────────────────────────
  const totalValue = listings.reduce((s, l) => s + l.estimatedValue, 0);
  const avgPrice   = listings.length > 0 ? Math.round(totalValue / listings.length) : 0;

  const recent7d = listings.filter(
    (l) => Date.now() - new Date(l.createdAt).getTime() < 7 * 86_400_000
  ).length;

  res.json({
    totalListings: listings.length,
    avgPrice,
    totalValue,
    recent7d,
    topBrands,
    categories,
    topCities,
    fuels,
  });
});

export default router;
