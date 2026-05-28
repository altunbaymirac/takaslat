/**
 * Başarım rozetleri sistemi
 * Kullanıcının store durumunu izleyerek kazandığı rozetleri hesaplar.
 */

import type { Listing, SwapOffer } from '../types';

export interface Achievement {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  tier:        'bronze' | 'silver' | 'gold' | 'platinum';
  earned:      boolean;
  progress?:   { current: number; target: number };
}

export function computeAchievements(params: {
  currentUserId: string;
  listings: Listing[];
  offers:   SwapOffer[];
  favorites: string[];
  compareList: string[];
  recentlyViewed: string[];
  savedSearches: number;
  ratings:  number;
}): Achievement[] {
  const { currentUserId, listings, offers, favorites, compareList, recentlyViewed, savedSearches, ratings } = params;

  const myListings    = listings.filter((l) => l.ownerId === currentUserId);
  const completedSwaps = offers.filter(
    (o) => (o.fromUserId === currentUserId || o.toUserId === currentUserId) && o.status === 'Tamamlandı'
  ).length;
  const sentOffers     = offers.filter((o) => o.fromUserId === currentUserId).length;
  const myMessages = offers.flatMap((o) => o.messages ?? []).filter((m) => m.fromUserId === currentUserId).length;

  const list: Achievement[] = [
    // Listing başarımları
    {
      id: 'first-listing',
      name: 'İlk Adım',
      description: 'İlk ilanını oluştur',
      icon: '🎉',
      tier: 'bronze',
      earned: myListings.length >= 1,
      progress: { current: Math.min(myListings.length, 1), target: 1 },
    },
    {
      id: 'five-listings',
      name: 'Aktif Satıcı',
      description: '5 ilan oluştur',
      icon: '📋',
      tier: 'silver',
      earned: myListings.length >= 5,
      progress: { current: Math.min(myListings.length, 5), target: 5 },
    },
    {
      id: 'ten-listings',
      name: 'Profesyonel',
      description: '10 ilan oluştur',
      icon: '🏪',
      tier: 'gold',
      earned: myListings.length >= 10,
      progress: { current: Math.min(myListings.length, 10), target: 10 },
    },

    // Takas başarımları
    {
      id: 'first-swap',
      name: 'İlk Takas',
      description: 'İlk takasını tamamla',
      icon: '🤝',
      tier: 'bronze',
      earned: completedSwaps >= 1,
      progress: { current: Math.min(completedSwaps, 1), target: 1 },
    },
    {
      id: 'five-swaps',
      name: 'Takas Uzmanı',
      description: '5 takas tamamla',
      icon: '⭐',
      tier: 'silver',
      earned: completedSwaps >= 5,
      progress: { current: Math.min(completedSwaps, 5), target: 5 },
    },
    {
      id: 'ten-swaps',
      name: 'Takas Efendisi',
      description: '10 takas tamamla',
      icon: '👑',
      tier: 'gold',
      earned: completedSwaps >= 10,
      progress: { current: Math.min(completedSwaps, 10), target: 10 },
    },
    {
      id: 'twenty-five-swaps',
      name: 'Takaslat Elçisi',
      description: '25 takas tamamla',
      icon: '💎',
      tier: 'platinum',
      earned: completedSwaps >= 25,
      progress: { current: Math.min(completedSwaps, 25), target: 25 },
    },

    // İletişim başarımları
    {
      id: 'first-offer',
      name: 'Pazarlıkçı',
      description: 'İlk teklifini gönder',
      icon: '📤',
      tier: 'bronze',
      earned: sentOffers >= 1,
      progress: { current: Math.min(sentOffers, 1), target: 1 },
    },
    {
      id: 'social',
      name: 'Sosyal',
      description: '20 mesaj gönder',
      icon: '💬',
      tier: 'silver',
      earned: myMessages >= 20,
      progress: { current: Math.min(myMessages, 20), target: 20 },
    },

    // Keşif başarımları
    {
      id: 'curator',
      name: 'Kürator',
      description: '10 favori ekle',
      icon: '❤️',
      tier: 'bronze',
      earned: favorites.length >= 10,
      progress: { current: Math.min(favorites.length, 10), target: 10 },
    },
    {
      id: 'analyst',
      name: 'Analiz Etmeyi Seven',
      description: '3 ilanı karşılaştır',
      icon: '⚖️',
      tier: 'bronze',
      earned: compareList.length >= 3,
      progress: { current: Math.min(compareList.length, 3), target: 3 },
    },
    {
      id: 'explorer',
      name: 'Kâşif',
      description: '12 ilan görüntüle',
      icon: '🔭',
      tier: 'silver',
      earned: recentlyViewed.length >= 12,
      progress: { current: Math.min(recentlyViewed.length, 12), target: 12 },
    },
    {
      id: 'searcher',
      name: 'Akıllı Arayıcı',
      description: '3 arama kaydet',
      icon: '🔖',
      tier: 'bronze',
      earned: savedSearches >= 3,
      progress: { current: Math.min(savedSearches, 3), target: 3 },
    },
    {
      id: 'reviewer',
      name: 'Değerlendirici',
      description: '5 takas değerlendir',
      icon: '⭐',
      tier: 'silver',
      earned: ratings >= 5,
      progress: { current: Math.min(ratings, 5), target: 5 },
    },
  ];

  return list;
}

export function tierColor(tier: Achievement['tier']): string {
  // Solid renkler — daha iyi kontrast
  return tier === 'platinum' ? 'from-cyan-500 to-blue-600'
       : tier === 'gold'     ? 'from-amber-500 to-yellow-600'
       : tier === 'silver'   ? 'from-slate-400 to-slate-600'
       :                       'from-amber-600 to-orange-700';
}
