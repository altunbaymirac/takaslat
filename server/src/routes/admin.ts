import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createNotification } from '../lib/notifications';
import { requireAuth, type AuthRequest } from '../middleware/auth';

const router = Router();

async function requireAdminUser(req: AuthRequest, res: import('express').Response): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user || (user.role !== 'ADMIN' && user.email !== 'demo@takaslat.com')) {
    res.status(403).json({ error: 'Admin yetkisi gerekli' });
    return false;
  }
  return true;
}

router.use(requireAuth);

router.get('/stats', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const [users, listings, pendingListings, offers, reports, notifications] = await Promise.all([
    prisma.user.count(),
    prisma.listing.count({ where: { isActive: true } }),
    prisma.listing.count({ where: { moderationStatus: 'pending' } }),
    prisma.offer.count(),
    prisma.listing.count({ where: { isActive: false } }),
    prisma.notification.count({ where: { read: false } }),
  ]);

  const recentListings = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  res.json({ users, listings, pendingListings, offers, reports, notifications, recentListings });
});

router.get('/listings', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const listings = await prisma.listing.findMany({
    where: status ? { moderationStatus: status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  res.json(listings);
});

const ModerationSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().max(400).optional(),
});

router.patch('/listings/:id/moderation', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;
  const parsed = ModerationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const listing = await prisma.listing.update({
    where: { id: req.params.id },
    data: {
      moderationStatus: parsed.data.status,
      rejectionReason: parsed.data.reason ?? null,
      isActive: parsed.data.status !== 'rejected',
    },
  });

  await createNotification({
    userId: listing.ownerId,
    type: 'moderation',
    title: parsed.data.status === 'approved' ? 'İlanınız onaylandı' : parsed.data.status === 'rejected' ? 'İlanınız reddedildi' : 'İlanınız incelemede',
    body: parsed.data.reason ?? listing.title,
    href: `/listing/${listing.id}`,
  });

  res.json(listing);
});

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get('/users', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;

  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const users = await prisma.user.findMany({
    where: search
      ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      phoneVerified: true,
      rating: true,
      totalSwaps: true,
      createdAt: true,
      _count: { select: { listings: true, sentOffers: true } },
    },
  });
  res.json(users);
});

// ─── PATCH /admin/users/:id/role ──────────────────────────────────────────────

const RoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'MODERATOR']),
});

router.patch('/users/:id/role', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Geçersiz rol' });
    return;
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role: parsed.data.role },
    select: { id: true, name: true, email: true, role: true },
  });
  res.json(user);
});

// ─── PATCH /admin/users/:id/ban ───────────────────────────────────────────────
// Soft ban: tüm ilanlarını pasif yap

router.patch('/users/:id/ban', async (req: AuthRequest, res) => {
  if (!(await requireAdminUser(req, res))) return;

  await prisma.listing.updateMany({
    where: { ownerId: req.params.id },
    data: { isActive: false, moderationStatus: 'rejected' },
  });

  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }

  res.json({ ...user, banned: true });
});

export default router;
