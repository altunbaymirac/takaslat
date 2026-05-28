/**
 * aiWeights.ts — Takas AI puanlama ağırlıkları
 *
 * Bu dosyadaki sayıları değiştirerek AI önerilerinin davranışını
 * kod değişikliği olmadan ayarlayabilirsiniz.
 * Her kategori toplamı ~100 pt olacak şekilde tasarlanmıştır.
 */

export const PRICE_WEIGHTS = {
  /** Fiyat farkı <= %4  → tam puan */
  exact:       40,
  /** Fiyat farkı <= %10 */
  veryClose:   35,
  /** Fiyat farkı <= %20 */
  close:       28,
  /** Fiyat farkı <= %30 */
  acceptable:  16,
  /** Fiyat farkı <= %45 */
  loose:        7,
  /** %45 üzeri */
  tooDifferent: 0,
} as const;

export const PREFERENCE_WEIGHTS = {
  /** Aranan kategori tam eşleşmesi */
  exactMatch:   25,
  /** Aranan kategori kısmi eşleşmesi */
  partialMatch: 12,
  /** Fiyat aralığı eşleşmesi */
  priceRange:   10,
  /** Şehir eşleşmesi */
  cityMatch:      5,
} as const;

export const LOCATION_WEIGHTS = {
  /** Aynı şehir */
  sameCity:      15,
  /** Komşu il (önyüklü liste) */
  nearbyCity:     7,
  /** Farklı bölge */
  different:      0,
} as const;

export const VEHICLE_WEIGHTS = {
  /** Kaza kaydı yok */
  noAccident:    10,
  /** Düşük km (< 80.000) */
  lowKm:          8,
  /** Otomatik şanzıman bonus */
  automatic:      4,
  /** Yeni model (son 5 yıl) */
  recentYear:     5,
} as const;

/** Sonuç normalizasyon çarpanı (ham puanı biraz şişir) */
export const SCORE_BOOST = 1.1;

/** Fiyat filtresi alt/üst sınırı — bu aralık dışındaki ilanlar havuza girmez */
export const PRICE_FILTER = {
  minRatio: 0.30,  // en az kaynağın %30'u
  maxRatio: 2.00,  // en fazla kaynağın 200'ü
} as const;
