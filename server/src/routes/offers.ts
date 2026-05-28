import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { sendMail } from '../lib/mailer';
import { createNotification, broadcastMessage, broadcastOfferStatus } from '../lib/notifications';

const router = Router();

// ─── Status akış kuralları ────────────────────────────────────────────────────
// Beklemede → Görüşülüyor → Onaylandı → Tamamlandı
//          ↘              ↘             ↘  (herhangi noktada Reddedilebilir)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Beklemede:   ['Görüşülüyor', 'Reddedildi'],
  Görüşülüyor: ['Onaylandı',   'Reddedildi'],
  Onaylandı:   ['Tamamlandı',  'Reddedildi'],
  Tamamlandı:  [],
  Reddedildi:  [],
};

const offerSelect = {
  id: true, message: true, status: true, offeredValue: true,
  listingId: true, fromUserId: true, toUserId: true,
  offeredListingId: true, offeredListingTitle: true,
  fromConfirmed: true, toConfirmed: true,
  counterMessage: true, meetingNote: true,
  fromRated: true, toRated: true,
  createdAt: true, updatedAt: true,
  listing:  { select: { id: true, title: true, estimatedValue: true, images: true, city: true } },
  from:     { select: { id: true, name: true, avatar: true } },
  to:       { select: { id: true, name: true, avatar: true } },
  messages: { orderBy: { createdAt: 'asc' as const }, include: { from: { select: { id: true, name: true } } } },
};

function formatOffer(o: Record<string, unknown>) {
  const listing = o.listing as Record<string, unknown>;
  const from = o.from as Record<string, unknown> | undefined;
  const to = o.to as Record<string, unknown> | undefined;
  return {
    ...o,
    listingTitle: listing?.title ?? '',
    fromUserName: from?.name ?? 'Kullanıcı',
    toUserName: to?.name ?? 'Kullanıcı',
    listing: listing ? {
      ...listing,
      images: (() => { try { return JSON.parse(listing.images as string); } catch { return []; } })(),
    } : undefined,
  };
}

// ─── GET /offers ──────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const offers = await prisma.offer.findMany({
    where: { OR: [{ fromUserId: req.userId }, { toUserId: req.userId }] },
    orderBy: { updatedAt: 'desc' },
    select: offerSelect,
  });
  res.json(offers.map(o => formatOffer(o as unknown as Record<string, unknown>)));
});

// ─── GET /offers/:id ──────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  const offer = await prisma.offer.findUnique({ where: { id: req.params.id }, select: offerSelect });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  const o = offer as unknown as Record<string, unknown>;
  const from = o.from as Record<string, unknown>;
  const to   = o.to   as Record<string, unknown>;
  if (from.id !== req.userId && to.id !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }
  res.json(formatOffer(o));
});

// ─── POST /offers ─────────────────────────────────────────────────────────────

const CreateOfferSchema = z.object({
  listingId:           z.string(),
  message:             z.string().min(10, 'Mesaj en az 10 karakter olmalı'),
  offeredValue:        z.number().positive().optional(),
  offeredListingId:    z.string().optional(),
  offeredListingTitle: z.string().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateOfferSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const listing = await prisma.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!listing) { res.status(404).json({ error: 'İlan bulunamadı' }); return; }
  if (listing.ownerId === req.userId) { res.status(400).json({ error: 'Kendi ilanınıza teklif gönderemezsiniz' }); return; }

  const offer = await prisma.offer.create({
    data: { ...parsed.data, fromUserId: req.userId!, toUserId: listing.ownerId },
    select: offerSelect,
  });

  await sendMail({
    to: listing.owner.email,
    subject: 'Takaslat: Yeni takas teklifi',
    text: `${listing.title} ilanınıza yeni bir takas teklifi geldi.`,
  });
  await createNotification({
    userId: listing.ownerId, type: 'offer',
    title: 'Yeni takas teklifi', body: listing.title, href: '/conversations',
  });

  res.status(201).json(formatOffer(offer as unknown as Record<string, unknown>));
});

// ─── PATCH /offers/:id/status — Alıcı veya gönderici durum değiştirir ─────────

const StatusSchema = z.object({
  status:      z.enum(['Görüşülüyor', 'Onaylandı', 'Reddedildi']),
  meetingNote: z.string().max(500).optional(),
});

router.patch('/:id/status', requireAuth, async (req: AuthRequest, res) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true } },
      from: { select: { id: true, email: true, name: true } },
      to:   { select: { id: true, email: true, name: true } },
    },
  });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  if (offer.fromUserId !== req.userId && offer.toUserId !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }

  const allowed = ALLOWED_TRANSITIONS[offer.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    res.status(400).json({ error: `${offer.status} → ${parsed.data.status} geçişine izin verilmiyor` });
    return;
  }

  const updateData: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.meetingNote) updateData.meetingNote = parsed.data.meetingNote;

  const updated = await prisma.offer.update({
    where: { id: req.params.id },
    data: updateData,
    select: offerSelect,
  });

  // Real-time push + bildirim — karşı tarafa gönder
  const otherUserId = offer.fromUserId === req.userId ? offer.toUserId : offer.fromUserId;
  broadcastOfferStatus(otherUserId, req.params.id, parsed.data.status);
  const statusLabels: Record<string, string> = {
    Görüşülüyor: 'Görüşme başladı',
    Onaylandı:   'Teklif onaylandı! 🎉',
    Reddedildi:  'Teklif reddedildi',
  };
  await createNotification({
    userId: otherUserId, type: 'status',
    title: statusLabels[parsed.data.status] ?? parsed.data.status,
    body: offer.listing.title, href: '/conversations',
  });

  res.json(formatOffer(updated as unknown as Record<string, unknown>));
});

// ─── PATCH /offers/:id/confirm — Takas tamamlandı çift onayı ─────────────────
// Her iki taraf da confirm'lediğinde status otomatik Tamamlandı olur.

router.patch('/:id/confirm', requireAuth, async (req: AuthRequest, res) => {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true } },
      from: { select: { id: true, email: true } },
      to:   { select: { id: true, email: true } },
    },
  });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  if (offer.fromUserId !== req.userId && offer.toUserId !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }
  if (offer.status !== 'Onaylandı') {
    res.status(400).json({ error: 'Tamamlama onayı yalnızca Onaylandı aşamasında yapılabilir' }); return;
  }

  const isFrom = offer.fromUserId === req.userId;
  const updateData: Record<string, unknown> = isFrom
    ? { fromConfirmed: true }
    : { toConfirmed: true };

  const newFromConfirmed = isFrom ? true : offer.fromConfirmed;
  const newToConfirmed   = isFrom ? offer.toConfirmed : true;

  // Her ikisi de onayladıysa → Tamamlandı
  if (newFromConfirmed && newToConfirmed) {
    updateData.status = 'Tamamlandı';
    // Takas sayaçlarını artır
    await prisma.user.updateMany({
      where: { id: { in: [offer.fromUserId, offer.toUserId] } },
      data:  { totalSwaps: { increment: 1 } },
    });
    await createNotification({
      userId: isFrom ? offer.toUserId : offer.fromUserId,
      type: 'status',
      title: 'Takas tamamlandı! 🎉 Lütfen puanlayın.',
      body: offer.listing.title, href: '/conversations',
    });
    await sendMail({
      to: isFrom ? offer.to.email : offer.from.email,
      subject: 'Takaslat: Takas tamamlandı',
      text: `${offer.listing.title} takası tamamlandı. Karşı tarafı puanlamayı unutmayın!`,
    });
  } else {
    // Sadece bir taraf onayladı, diğerine bildir
    const otherUserId = isFrom ? offer.toUserId : offer.fromUserId;
    await createNotification({
      userId: otherUserId, type: 'status',
      title: 'Takas onayı bekleniyor',
      body: `${isFrom ? offer.from.email : offer.to.email} tarafı takas tamamlandığını onayladı. Siz de onaylayın.`,
      href: '/conversations',
    });
  }

  const updated = await prisma.offer.update({
    where: { id: req.params.id },
    data: updateData,
    select: offerSelect,
  });
  res.json(formatOffer(updated as unknown as Record<string, unknown>));
});

// ─── PATCH /offers/:id/revision — Karşı teklif ───────────────────────────────

const RevisionSchema = z.object({
  offeredValue:        z.number().positive().optional(),
  offeredListingId:    z.string().optional(),
  offeredListingTitle: z.string().optional(),
  counterMessage:      z.string().max(500).optional(),
});

router.patch('/:id/revision', requireAuth, async (req: AuthRequest, res) => {
  const parsed = RevisionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true } },
      from: { select: { email: true } },
      to:   { select: { email: true } },
    },
  });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  if (offer.fromUserId !== req.userId && offer.toUserId !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }
  if (offer.status === 'Tamamlandı' || offer.status === 'Reddedildi') {
    res.status(400).json({ error: 'Kapalı teklif revize edilemez' }); return;
  }

  await prisma.offer.update({
    where: { id: req.params.id },
    data: {
      offeredValue:        parsed.data.offeredValue,
      offeredListingId:    parsed.data.offeredListingId,
      offeredListingTitle: parsed.data.offeredListingTitle,
      counterMessage:      parsed.data.counterMessage,
      status:              'Görüşülüyor',
      fromConfirmed:       false,
      toConfirmed:         false,
    },
  });

  const valueText = parsed.data.offeredValue
    ? `${parsed.data.offeredValue.toLocaleString('tr-TR')} TL`
    : 'değer belirtilmedi';
  const itemText = parsed.data.offeredListingTitle ? ` · ${parsed.data.offeredListingTitle}` : '';
  await prisma.message.create({
    data: {
      text: `Karşı teklif: ${valueText}${itemText}${parsed.data.counterMessage ? ` — "${parsed.data.counterMessage}"` : ''}`,
      offerId: req.params.id, fromUserId: req.userId!,
    },
  });

  const targetUserId = offer.fromUserId === req.userId ? offer.toUserId : offer.fromUserId;
  await createNotification({
    userId: targetUserId, type: 'status',
    title: 'Karşı teklif geldi',
    body: offer.listing.title, href: '/conversations',
  });
  await sendMail({
    to: offer.fromUserId === req.userId ? offer.to.email : offer.from.email,
    subject: 'Takaslat: Karşı teklif',
    text: `${offer.listing.title} görüşmesinde karşı teklif geldi: ${valueText}${itemText}`,
  });

  const updated = await prisma.offer.findUnique({ where: { id: req.params.id }, select: offerSelect });
  res.json(formatOffer(updated as unknown as Record<string, unknown>));
});

// ─── POST /offers/:id/messages ────────────────────────────────────────────────

const MessageSchema = z.object({ text: z.string().min(1).max(2000) });

router.post('/:id/messages', requireAuth, async (req: AuthRequest, res) => {
  const parsed = MessageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Mesaj boş olamaz' }); return; }

  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: {
      listing: { select: { title: true } },
      from: { select: { email: true } },
      to:   { select: { email: true } },
    },
  });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  if (offer.fromUserId !== req.userId && offer.toUserId !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }
  if (offer.status === 'Tamamlandı' || offer.status === 'Reddedildi') {
    res.status(400).json({ error: 'Kapalı görüşmeye mesaj gönderilemez' }); return;
  }

  const message = await prisma.message.create({
    data: { text: parsed.data.text, offerId: req.params.id, fromUserId: req.userId! },
    include: { from: { select: { id: true, name: true } } },
  });

  const recipientId = offer.fromUserId === req.userId ? offer.toUserId : offer.fromUserId;

  // Real-time SSE push to recipient
  broadcastMessage(recipientId, {
    _event:       'newMessage',
    offerId:      req.params.id,
    id:           message.id,
    text:         message.text,
    fromUserId:   message.fromUserId,
    fromUserName: message.from.name,
    createdAt:    message.createdAt.toISOString(),
  });

  await createNotification({
    userId: recipientId,
    type: 'message', title: 'Yeni mesaj', body: parsed.data.text.slice(0, 80), href: '/conversations',
  });
  await sendMail({
    to: offer.fromUserId === req.userId ? offer.to.email : offer.from.email,
    subject: 'Takaslat: Yeni mesaj',
    text: `${offer.listing.title} görüşmesinde yeni mesaj: ${parsed.data.text}`,
  });

  if (offer.status === 'Beklemede') {
    await prisma.offer.update({ where: { id: req.params.id }, data: { status: 'Görüşülüyor' } });
  }

  res.status(201).json(message);
});

// ─── POST /offers/:id/rate — Tamamlanan takasta puanlama ──────────────────────

const RateSchema = z.object({
  score:   z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

router.post('/:id/rate', requireAuth, async (req: AuthRequest, res) => {
  const parsed = RateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { from: { select: { id: true, rating: true, totalSwaps: true } }, to: { select: { id: true, rating: true, totalSwaps: true } } },
  });
  if (!offer) { res.status(404).json({ error: 'Teklif bulunamadı' }); return; }
  if (offer.status !== 'Tamamlandı') { res.status(400).json({ error: 'Sadece tamamlanan takaslar puanlanabilir' }); return; }
  if (offer.fromUserId !== req.userId && offer.toUserId !== req.userId) {
    res.status(403).json({ error: 'Yetkisiz' }); return;
  }

  const isFrom = offer.fromUserId === req.userId;

  // Daha önce puanladı mı?
  if (isFrom && offer.fromRated) { res.status(400).json({ error: 'Zaten puanladınız' }); return; }
  if (!isFrom && offer.toRated)  { res.status(400).json({ error: 'Zaten puanladınız' }); return; }

  // Puanlanan kullanıcı
  const ratedUser = isFrom ? offer.to : offer.from;
  const currentRating = ratedUser.rating ?? 5.0;
  const swapCount = ratedUser.totalSwaps ?? 1;
  // Kayan ortalama güncelle
  const newRating = Math.round(((currentRating * (swapCount - 1) + parsed.data.score) / swapCount) * 10) / 10;

  await prisma.user.update({
    where: { id: ratedUser.id },
    data: { rating: Math.min(5, Math.max(1, newRating)) },
  });

  // Puanlama flag'i güncelle
  await prisma.offer.update({
    where: { id: req.params.id },
    data: isFrom ? { fromRated: true } : { toRated: true },
  });

  await createNotification({
    userId: ratedUser.id, type: 'system',
    title: `${parsed.data.score}/5 yıldız aldınız`,
    body: parsed.data.comment ?? 'Takas sonrası değerlendirme yapıldı.',
    href: `/profile/${ratedUser.id}`,
  });

  res.json({ success: true, newRating });
});

export default router;
