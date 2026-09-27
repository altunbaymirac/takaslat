/**
 * Form doldurma botlarına karşı ucuz, hesap gerektirmeyen ilk savunma katmanı.
 *
 * 2026 Ağustos–Eylül'de kayıt formu otomatik doldurularak yüzlerce sahte hesap
 * açıldı: rastgele harf dizisi isimler, Gmail "nokta hilesi" adresleri ve
 * hepsinde listenin ilk ili (Adana). Asıl koruma sunucuda doğrulanan
 * Turnstile'dır (components/Turnstile); bu katman onsuz da basit botları
 * durdurur.
 *
 *  - Bal küpü: insanın görmediği bir alan. Bot tüm alanları doldurur.
 *  - Süre tuzağı: insan bir kayıt formunu 2,5 saniyede dolduramaz.
 */

export const MIN_FILL_MS = 2500;

export type BotSignal = 'honeypot' | 'too_fast';

export function detectBot(input: { honeypot: string; startedAt: number; now?: number }): BotSignal | null {
  if (input.honeypot.trim() !== '') return 'honeypot';
  if ((input.now ?? Date.now()) - input.startedAt < MIN_FILL_MS) return 'too_fast';
  return null;
}
