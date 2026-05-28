import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { createNotification, subscribeNotifications } from '../lib/notifications';
import { requireAuth, verifyToken, type AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.post('/read', requireAuth, async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId, read: false },
    data: { read: true },
  });
  res.json({ success: true });
});

router.get('/stream', async (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  const userId = verifyToken(token);
  if (!userId) {
    res.status(401).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ type: 'connected', ts: new Date().toISOString() });
  const unsubscribe = subscribeNotifications(userId, send);
  const ping = setInterval(() => send({ type: 'ping', ts: new Date().toISOString() }), 25_000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

router.post('/test', requireAuth, async (req: AuthRequest, res) => {
  const notification = await createNotification({
    userId: req.userId!,
    type: 'system',
    title: 'Canlı bildirim testi',
    body: 'SSE bağlantısı ve kalıcı bildirim kaydı çalışıyor.',
    href: '/dashboard',
  });
  res.status(201).json(notification);
});

export default router;
