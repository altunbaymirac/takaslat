import type { AuthUser } from '../store/useAppStore';
import { isPlatformAdmin } from './roles';

/**
 * Ücretli özellikler.
 *
 * Ödeme sistemi bağlanana kadar hiçbiri kullanıcıya açık değil. Ödeme akışı
 * geldiğinde tek yapılacak şey, satın alınan özellikleri `user.entitlements`
 * içine yazmak veya aşağıdaki anahtarı açmak — arayüz zaten hazır.
 */
export type PaidFeature =
  | 'listing_analytics'   // İlan analizi: görüntülenme, teklif ve 7 günlük grafik
  | 'listing_boost';      // İlanı öne çıkarma

/** Genel açma anahtarı: ödeme entegrasyonu tamamlanınca true yapılacak. */
const RELEASED: Record<PaidFeature, boolean> = {
  listing_analytics: false,
  listing_boost:     false,
};

export const FEATURE_LABELS: Record<PaidFeature, { title: string; description: string }> = {
  listing_analytics: {
    title: 'İlan analizi',
    description: 'Kaç kişi görüntüledi, kaç teklif geldi ve son 7 günün grafiği.',
  },
  listing_boost: {
    title: 'İlanı öne çıkar',
    description: 'İlanın arama sonuçlarının en üstünde 7 gün boyunca görünür.',
  },
};

/** Kullanıcının bu özelliğe erişimi var mı? */
export function hasPaidFeature(feature: PaidFeature, user?: AuthUser | null) {
  if (RELEASED[feature]) return true;
  // Yönetim ekibi, satışa açılmadan önce özelliği görebilsin.
  if (isPlatformAdmin(user?.role)) return true;
  return Boolean(user?.entitlements?.includes(feature));
}
