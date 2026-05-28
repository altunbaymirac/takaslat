/**
 * Kişiselleştirilmiş öneri motoru
 *
 * Kullanıcının davranışlarından (görüntülenen, favoriler, aramalar)
 * profil çıkarır ve listingleri skorlar.
 */

import type { Listing } from '../types';

interface UserProfile {
  preferredCategories: Map<string, number>; // category → skor
  preferredBrands:     Map<string, number>;
  preferredCities:     Map<string, number>;
  preferredFuels:      Map<string, number>;
  avgPrice:            number | null;
  priceRange:          { min: number; max: number } | null;
}

export function buildProfile(params: {
  listings:       Listing[];
  recentlyViewed: string[];   // listing id'leri
  favorites:      string[];
  searchTerms:    string[];   // son aramalar
}): UserProfile {
  const { listings, recentlyViewed, favorites, searchTerms } = params;

  const cats   = new Map<string, number>();
  const brands = new Map<string, number>();
  const cities = new Map<string, number>();
  const fuels  = new Map<string, number>();
  const prices: number[] = [];

  const inc = (map: Map<string, number>, key: string | undefined, weight: number) => {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + weight);
  };

  // Viewed: weight 1 (ama yeni viewed daha yüksek)
  recentlyViewed.forEach((id, i) => {
    const l = listings.find((x) => x.id === id);
    if (!l) return;
    const w = 1 + (recentlyViewed.length - i) * 0.1; // 1.0 → 2.2
    inc(cats,   l.category, w);
    inc(brands, l.vehicleDetails?.brand,    w);
    inc(brands, l.electronicDetails?.brand, w);
    inc(cities, l.city, w * 0.7);
    inc(fuels,  l.vehicleDetails?.fuel, w);
    prices.push(l.estimatedValue);
  });

  // Favorites: weight 3 (daha güçlü sinyal)
  for (const id of favorites) {
    const l = listings.find((x) => x.id === id);
    if (!l) continue;
    inc(cats,   l.category, 3);
    inc(brands, l.vehicleDetails?.brand,    3);
    inc(brands, l.electronicDetails?.brand, 3);
    inc(cities, l.city, 2);
    inc(fuels,  l.vehicleDetails?.fuel, 3);
    prices.push(l.estimatedValue * 1.2); // favori = bütçe esnek
  }

  // Arama terimleri: kategori/marka yakalama
  for (const term of searchTerms) {
    const t = term.toLowerCase();
    for (const l of listings) {
      const brand = (l.vehicleDetails?.brand ?? l.electronicDetails?.brand ?? '').toLowerCase();
      if (brand && t.includes(brand)) inc(brands, brand, 1.5);
      if (t.includes(l.city.toLowerCase())) inc(cities, l.city, 1);
    }
  }

  const avgPrice = prices.length > 0
    ? prices.reduce((s, p) => s + p, 0) / prices.length
    : null;

  const priceRange = avgPrice !== null
    ? { min: avgPrice * 0.5, max: avgPrice * 1.7 }
    : null;

  return {
    preferredCategories: cats,
    preferredBrands:     brands,
    preferredCities:     cities,
    preferredFuels:      fuels,
    avgPrice,
    priceRange,
  };
}

export function scoreListing(l: Listing, profile: UserProfile): number {
  let score = 0;

  // Kategori (en güçlü sinyal)
  score += (profile.preferredCategories.get(l.category) ?? 0) * 10;

  // Marka
  const brand = l.vehicleDetails?.brand ?? l.electronicDetails?.brand;
  if (brand) score += (profile.preferredBrands.get(brand) ?? 0) * 8;

  // Şehir
  score += (profile.preferredCities.get(l.city) ?? 0) * 5;

  // Yakıt (araç ise)
  if (l.vehicleDetails?.fuel) {
    score += (profile.preferredFuels.get(l.vehicleDetails.fuel) ?? 0) * 4;
  }

  // Fiyat aralığı uyumu
  if (profile.priceRange) {
    if (l.estimatedValue >= profile.priceRange.min && l.estimatedValue <= profile.priceRange.max) {
      score += 8;
    } else {
      // Aralık dışıysa azalan etki
      const dist = Math.min(
        Math.abs(l.estimatedValue - profile.priceRange.min),
        Math.abs(l.estimatedValue - profile.priceRange.max),
      );
      score -= dist / (profile.avgPrice ?? 1_000_000) * 3;
    }
  }

  // Yeni ilan + popüler ilan bonusu
  const ageMs = Date.now() - new Date(l.createdAt).getTime();
  if (ageMs < 7 * 86_400_000) score += 2;
  if ((l.viewCount ?? 0) > 5)  score += 1;

  return score;
}

export function personalize(params: {
  listings:       Listing[];
  recentlyViewed: string[];
  favorites:      string[];
  searchTerms:    string[];
  excludeOwnerId?: string;     // kendi ilanlarını öneride gösterme
  limit?:         number;
}): Listing[] {
  const profile = buildProfile(params);

  // Profil boşsa (yeni kullanıcı) — popülere göre sırala
  const hasSignals =
    profile.preferredCategories.size > 0 ||
    profile.preferredBrands.size     > 0 ||
    profile.preferredCities.size     > 0;

  let pool = params.listings;
  if (params.excludeOwnerId) {
    pool = pool.filter((l) => l.ownerId !== params.excludeOwnerId);
  }
  // recentlyViewed'da olan zaten gördüğü ilanlar — bu listeden hariç tut
  pool = pool.filter((l) => !params.recentlyViewed.includes(l.id));

  if (!hasSignals) {
    return pool
      .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
      .slice(0, params.limit ?? 8);
  }

  return pool
    .map((l) => ({ listing: l, score: scoreListing(l, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? 8)
    .map((x) => x.listing);
}
