import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

// ─── İlan kodu üretici: TKS-XXXXXXX (7 basamak) ──────────────────────────────

const CODE_PATTERN = /^TKS-\d{7}$/i;

async function generateListingCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const num  = Math.floor(Math.random() * 9_000_000) + 1_000_000; // 1000000–9999999
    const code = `TKS-${num}`;
    const exists = await prisma.listing.findUnique({ where: { listingCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  // Yedek: timestamp tabanlı (olasılık çok düşük ama güvence için)
  return `TKS-${Date.now().toString().slice(-7)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseImages(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return [raw]; }
}
function parseTags(raw: string): string[] {
  try { return JSON.parse(raw); } catch { return []; }
}
function parseAttachments(raw: unknown): unknown[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function parseExtra(raw: unknown): { electronicDetails?: unknown; propertyDetails?: unknown } {
  if (!raw || typeof raw !== 'string') return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return {
      electronicDetails: obj.electronicDetails,
      propertyDetails:   obj.propertyDetails,
    };
  } catch { return {}; }
}

function formatListing(l: Record<string, unknown>) {
  const owner = l.owner as {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
    totalSwaps?: number;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  } | undefined;
  const extra = parseExtra(l.extraDetails);
  return {
    ...l,
    owner:        undefined,
    images:       parseImages(l.images as string),
    tags:         parseTags(l.tags as string),
    attachments:  parseAttachments(l.attachments),
    extraDetails: undefined,                      // raw JSON'u dışarı verme
    ownerId:      owner?.id      ?? (l.ownerId as string) ?? '',
    ownerName:    owner?.name    ?? 'Kullanıcı',
    ownerAvatar:  owner?.avatar  ?? '',
    ownerRating:  owner?.rating,
    ownerTotalSwaps: owner?.totalSwaps,
    ownerEmailVerified: owner?.emailVerified,
    ownerPhoneVerified: owner?.phoneVerified,
    vehicleDetails: l.brand ? {
      brand: l.brand, model: l.model, year: l.year, km: l.km,
      fuel: l.fuel, transmission: l.transmission, color: l.color,
      hasAccidentRecord: l.hasAccidentRecord, bodyType: l.bodyType, engineCC: l.engineCC,
    } : undefined,
    electronicDetails: extra.electronicDetails,
    propertyDetails:   extra.propertyDetails,
  };
}

// ─── GET /listings ────────────────────────────────────────────────────────────

router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      category, city, minValue, maxValue, q,
      page = '1', limit = '20',
      sort = 'newest',
      brand, fuel, minYear, maxYear, minKm, maxKm, noAccidentOnly,
    } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { isActive: true };
    if (category && category !== 'Tümü') where.category = category;
    if (city) where.city = city;
    if (minValue || maxValue) {
      where.estimatedValue = {
        gte: minValue ? parseInt(minValue) : 0,
        lte: maxValue ? parseInt(maxValue) : 99_999_999,
      };
    }
    if (q) {
      // TKS-XXXXXXX formatındaysa sadece koda göre tam eşleşme ara
      if (CODE_PATTERN.test(q.trim())) {
        where.listingCode = q.trim().toUpperCase();
        delete where.isActive; // kod aramasında aktif/pasif fark etmez
      } else {
        where.OR = [
          { listingCode:  { contains: q } },
          { title:        { contains: q } },
          { description:  { contains: q } },
          { brand:        { contains: q } },
          { model:        { contains: q } },
          { city:         { contains: q } },
          { tags:         { contains: q } },
        ];
      }
    }
    // Araç filtreleri
    if (brand)          where.brand = { contains: brand };
    if (fuel)           where.fuel  = fuel;
    if (noAccidentOnly === 'true') where.hasAccidentRecord = false;
    if (minYear || maxYear) {
      where.year = {
        ...(minYear ? { gte: parseInt(minYear) } : {}),
        ...(maxYear ? { lte: parseInt(maxYear) } : {}),
      };
    }
    if (minKm || maxKm) {
      where.km = {
        ...(minKm ? { gte: parseInt(minKm) } : {}),
        ...(maxKm ? { lte: parseInt(maxKm) } : {}),
      };
    }

    // Sıralama
    type OrderBy = Record<string, 'asc' | 'desc'>;
    const orderByMap: Record<string, OrderBy> = {
      newest:     { createdAt: 'desc' },
      oldest:     { createdAt: 'asc'  },
      price_asc:  { estimatedValue: 'asc'  },
      price_desc: { estimatedValue: 'desc' },
      popular:    { viewCount: 'desc' },
    };
    const orderBy: OrderBy = orderByMap[sort] ?? orderByMap.newest;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: { owner: { select: { id: true, name: true, avatar: true, rating: true, totalSwaps: true, emailVerified: true, phoneVerified: true } } },
      }),
      prisma.listing.count({ where }),
    ]);

    res.json({
      listings: listings.map(formatListing),
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: pageNum * limitNum < total,
    });
  } catch (err) {
    console.error('[GET /listings]', err);
    res.status(500).json({ error: 'İlanlar yüklenirken hata oluştu' });
  }
});

// ─── GET /listings/code/:code — ilan koduna göre getir ───────────────────────

router.get('/code/:code', optionalAuth, async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    if (!CODE_PATTERN.test(code)) {
      res.status(400).json({ error: 'Geçersiz ilan kodu formatı' });
      return;
    }
    const listing = await prisma.listing.findUnique({
      where: { listingCode: code },
      include: { owner: { select: { id: true, name: true, avatar: true, rating: true, totalSwaps: true, emailVerified: true, phoneVerified: true } } },
    });
    if (!listing) { res.status(404).json({ error: 'İlan bulunamadı' }); return; }
    prisma.listing.update({ where: { id: listing.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    res.json(formatListing(listing as unknown as Record<string, unknown>));
  } catch (err) {
    console.error('[GET /listings/code/:code]', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// ─── GET /listings/:id ────────────────────────────────────────────────────────

router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, name: true, avatar: true, rating: true, totalSwaps: true, emailVerified: true, phoneVerified: true } } },
    });
    if (!listing) { res.status(404).json({ error: 'İlan bulunamadı' }); return; }

    // Increment view count (fire & forget — don't block response)
    prisma.listing.update({ where: { id: req.params.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);

    res.json(formatListing(listing as unknown as Record<string, unknown>));
  } catch (err) {
    console.error('[GET /listings/:id]', err);
    res.status(500).json({ error: 'İlan yüklenirken hata oluştu' });
  }
});

// ─── POST /listings ───────────────────────────────────────────────────────────

const ListingSchema = z.object({
  title:          z.string().min(3),
  category:       z.enum(['Araç', 'Elektronik', 'Gayrimenkul', 'Diğer']),
  estimatedValue: z.number().positive(),
  description:    z.string().min(10),
  wantedFor:      z.string().min(5),
  city:           z.string().min(2),
  images:         z.array(z.string()).min(1),
  condition:      z.enum(['Mükemmel', 'İyi', 'Orta', 'Yıpranmış']),
  tags:           z.array(z.string()).default([]),
  attachments:    z.array(z.record(z.unknown())).default([]),
  videoUrl:       z.string().url().optional().or(z.literal('')),
  // Vehicle optional fields
  brand:             z.string().optional(),
  model:             z.string().optional(),
  year:              z.number().int().optional(),
  km:                z.number().int().optional(),
  fuel:              z.string().optional(),
  transmission:      z.string().optional(),
  color:             z.string().optional(),
  hasAccidentRecord: z.boolean().default(false),
  bodyType:          z.string().optional(),
  engineCC:          z.number().int().optional(),
  // Diğer kategoriler — generic JSON (frontend serialize eder)
  electronicDetails: z.record(z.unknown()).optional(),
  propertyDetails:   z.record(z.unknown()).optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = ListingSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { images, tags, attachments, electronicDetails, propertyDetails, ...rest } = parsed.data;

    const extraDetails =
      (electronicDetails || propertyDetails)
        ? JSON.stringify({ electronicDetails, propertyDetails })
        : null;

    const listingCode = await generateListingCode();

    const listing = await prisma.listing.create({
      data: {
        ...rest,
        listingCode,
        images: JSON.stringify(images),
        tags:   JSON.stringify(tags),
        attachments: JSON.stringify(attachments),
        extraDetails,
        ownerId: req.userId!,
      },
      include: { owner: { select: { id: true, name: true, avatar: true, rating: true, totalSwaps: true, emailVerified: true, phoneVerified: true } } },
    });
    res.status(201).json(formatListing(listing as unknown as Record<string, unknown>));
  } catch (err) {
    console.error('[POST /listings]', err);
    res.status(500).json({ error: 'İlan oluşturulurken hata oluştu' });
  }
});

// ─── PATCH /listings/:id ──────────────────────────────────────────────────────

router.patch('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) { res.status(404).json({ error: 'İlan bulunamadı' }); return; }
    if (listing.ownerId !== req.userId) { res.status(403).json({ error: 'Yetkisiz' }); return; }

    const {
      electronicDetails, propertyDetails, vehicleDetails, images, tags, attachments,
      ownerId, ownerName, ownerAvatar, id, createdAt, updatedAt, listingCode, ...rest
    } = req.body as Record<string, unknown>;
    void vehicleDetails; void ownerId; void ownerName; void ownerAvatar; void id; void createdAt; void updatedAt; void listingCode; // listingCode değiştirilemez
    const extraDetails =
      (electronicDetails || propertyDetails)
        ? JSON.stringify({ electronicDetails, propertyDetails })
        : undefined;

    const updated = await prisma.listing.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        images:       images ? JSON.stringify(images) : undefined,
        tags:         tags   ? JSON.stringify(tags)   : undefined,
        attachments:  attachments ? JSON.stringify(attachments) : undefined,
        extraDetails,
      },
      include: { owner: { select: { id: true, name: true, avatar: true, rating: true, totalSwaps: true, emailVerified: true, phoneVerified: true } } },
    });
    res.json(formatListing(updated as unknown as Record<string, unknown>));
  } catch (err) {
    console.error('[PATCH /listings/:id]', err);
    res.status(500).json({ error: 'İlan güncellenirken hata oluştu' });
  }
});

// ─── DELETE /listings/:id ─────────────────────────────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) { res.status(404).json({ error: 'İlan bulunamadı' }); return; }
    if (listing.ownerId !== req.userId) { res.status(403).json({ error: 'Yetkisiz' }); return; }

    await prisma.listing.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /listings/:id]', err);
    res.status(500).json({ error: 'İlan kaldırılırken hata oluştu' });
  }
});

export default router;
