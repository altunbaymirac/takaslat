import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export function usePriceDropAlerts() {
  const { currentUser, favorites, listings, pushNotification } = useAppStore();
  const prevPricesRef = useRef<Record<string, number>>({});
  const permissionRequestedRef = useRef(false);

  // Request browser notification permission once when user logs in
  useEffect(() => {
    if (!currentUser || permissionRequestedRef.current) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      permissionRequestedRef.current = true;
      Notification.requestPermission();
    }
  }, [currentUser]);

  // Track price changes for favorited listings
  useEffect(() => {
    if (!currentUser || favorites.length === 0) return;

    const prevPrices = prevPricesRef.current;

    favorites.forEach((id) => {
      const listing = listings.find((l) => l.id === id);
      if (!listing) return;

      const prev = prevPrices[id];
      const curr = listing.estimatedValue;

      if (prev !== undefined && curr < prev) {
        const drop = prev - curr;
        const formatted = new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          maximumFractionDigits: 0,
        }).format(drop);

        // In-app notification
        pushNotification({
          id: `price-drop-${id}-${Date.now()}`,
          type: 'system',
          title: '📉 Fiyat Düştü!',
          body: `${listing.title} için fiyat ${formatted} düştü.`,
          href: `/listing/${id}`,
          createdAt: new Date().toISOString(),
          read: false,
        });

        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('📉 Fiyat Düştü — Takaslat', {
            body: `${listing.title}\nFiyat ${formatted} düştü!`,
            icon: '/icon-192.svg',
            tag: `price-drop-${id}`,
          });
        }
      }

      prevPrices[id] = curr;
    });

    prevPricesRef.current = prevPrices;
  }, [listings, favorites, currentUser, pushNotification]);
}
