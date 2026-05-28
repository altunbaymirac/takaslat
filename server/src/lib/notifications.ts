import { prisma } from './prisma';

interface NotificationInput {
  userId: string;
  type: 'offer' | 'message' | 'status' | 'system' | 'moderation' | 'wishlist';
  title: string;
  body: string;
  href: string;
}

// ─── In-memory SSE pub/sub (shared across notification & message events) ──────

const listeners = new Map<string, Set<(payload: unknown) => void>>();

function broadcastToUser(userId: string, payload: unknown) {
  const userListeners = listeners.get(userId);
  if (userListeners) {
    for (const send of userListeners) send(payload);
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function createNotification(input: NotificationInput) {
  const notification = await prisma.notification.create({ data: input });
  broadcastToUser(input.userId, notification);
  return notification;
}

// ─── Real-time message push ───────────────────────────────────────────────────
// Sends a raw message object to the recipient's SSE stream.
// The frontend distinguishes by checking payload._event === 'newMessage'.

export function broadcastMessage(recipientId: string, message: {
  _event: 'newMessage';
  offerId: string;
  id: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  createdAt: string;
}) {
  broadcastToUser(recipientId, message);
}

// ─── Offer status push ────────────────────────────────────────────────────────

export function broadcastOfferStatus(recipientId: string, offerId: string, status: string) {
  broadcastToUser(recipientId, { _event: 'offerStatus', offerId, status });
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function subscribeNotifications(userId: string, send: (payload: unknown) => void) {
  const userListeners = listeners.get(userId) ?? new Set<(payload: unknown) => void>();
  userListeners.add(send);
  listeners.set(userId, userListeners);

  return () => {
    userListeners.delete(send);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}
