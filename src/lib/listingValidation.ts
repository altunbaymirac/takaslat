import type { Listing } from '../types';

export const MIN_LISTING_VALUE = 1_000;
export const MAX_LISTING_VALUE = 2_000_000_000;

export function validateListingValue(value: number): string | null {
  if (!Number.isFinite(value)) return 'Geçerli bir tahmini değer gir';
  if (value < MIN_LISTING_VALUE) return 'İlan değeri en az ₺1.000 olmalı';
  if (value > MAX_LISTING_VALUE) return 'İlan değeri ₺2 milyarı aşamaz';
  return null;
}

export function validateListingDraft(listing: Pick<Listing, 'title' | 'description' | 'wantedFor' | 'images' | 'estimatedValue'>): string | null {
  const valueError = validateListingValue(listing.estimatedValue);
  if (valueError) return valueError;
  if (listing.title.trim().length < 5 || listing.title.trim().length > 120) {
    return 'İlan başlığı 5 ile 120 karakter arasında olmalı';
  }
  if (listing.description.trim().length < 30 || listing.description.trim().length > 5_000) {
    return 'İlan açıklaması 30 ile 5.000 karakter arasında olmalı';
  }
  if (listing.wantedFor.trim().length < 20 || listing.wantedFor.trim().length > 500) {
    return 'Takas beklentisi 20 ile 500 karakter arasında olmalı';
  }
  if (listing.images.length < 1 || listing.images.length > 8) {
    return 'İlanda 1 ile 8 arasında fotoğraf bulunmalı';
  }
  return null;
}
