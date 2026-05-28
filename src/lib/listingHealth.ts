import type { Listing } from '../types';

export interface ListingHealth {
  score: number;
  grade: 'çok iyi' | 'iyi' | 'geliştirilmeli' | 'zayıf';
  missing: string[];
  strengths: string[];
  trustBadges: { label: string; tone: 'blue' | 'emerald' | 'amber' | 'slate' }[];
}

export function getListingHealth(listing: Listing): ListingHealth {
  const missing: string[] = [];
  const strengths: string[] = [];
  const imageCount = Array.isArray(listing.images) ? listing.images.length : 0;
  const attachmentCount = Array.isArray(listing.attachments) ? listing.attachments.length : 0;
  let score = 100;

  if (listing.title.trim().length < 12) {
    score -= 10;
    missing.push('Başlık kısa');
  }
  if (listing.description.trim().length < 140) {
    score -= 16;
    missing.push('Açıklama kısa');
  } else {
    strengths.push('Detaylı açıklama');
  }
  if (listing.wantedFor.trim().length < 24) {
    score -= 12;
    missing.push('Takas beklentisi belirsiz');
  }
  if (imageCount < 4) {
    score -= 14;
    missing.push('Fotoğraf az');
  } else {
    strengths.push('Yeterli fotoğraf');
  }
  if (attachmentCount === 0) {
    score -= listing.category === 'Araç' ? 12 : 6;
    missing.push(listing.category === 'Araç' ? 'Ekspertiz/servis belgesi yok' : 'Belge eki yok');
  } else {
    strengths.push('Belge eki var');
  }

  const v = listing.vehicleDetails;
  if (v) {
    if (!v.km) { score -= 10; missing.push('KM eksik'); }
    if (!v.color) { score -= 4; missing.push('Renk eksik'); }
    if (!v.bodyType) { score -= 4; missing.push('Kasa tipi eksik'); }
    if (!v.hasAccidentRecord) strengths.push('Hasar kaydı yok');
  }

  const e = listing.electronicDetails;
  if (e) {
    if (!e.storage && ['Telefon', 'Laptop', 'Tablet'].includes(e.type)) { score -= 6; missing.push('Depolama eksik'); }
    if (!e.warranty) { score -= 5; missing.push('Garanti durumu eksik'); }
    if ((e.batteryHealth ?? 100) >= 90) strengths.push('Batarya güçlü');
  }

  const p = listing.propertyDetails;
  if (p) {
    if (!p.netSqm) { score -= 8; missing.push('Net m² eksik'); }
    if (!p.titleDeed) { score -= 7; missing.push('Tapu durumu eksik'); }
    if (p.parking || p.elevator || p.balcony) strengths.push('Olanak bilgisi var');
  }

  const trustBadges: ListingHealth['trustBadges'] = [];
  if (listing.ownerEmailVerified) trustBadges.push({ label: 'E-posta doğrulandı', tone: 'emerald' });
  if (listing.ownerPhoneVerified) trustBadges.push({ label: 'Telefon doğrulandı', tone: 'emerald' });
  if ((listing.ownerTotalSwaps ?? 0) > 0) trustBadges.push({ label: `${listing.ownerTotalSwaps} takas`, tone: 'blue' });
  if ((listing.ownerRating ?? 0) >= 4.7) trustBadges.push({ label: `${listing.ownerRating?.toFixed(1)} puan`, tone: 'amber' });
  if (trustBadges.length === 0) trustBadges.push({ label: 'Yeni satıcı', tone: 'slate' });

  score = Math.max(5, Math.min(100, score));
  const grade: ListingHealth['grade'] =
    score >= 85 ? 'çok iyi' :
    score >= 68 ? 'iyi' :
    score >= 45 ? 'geliştirilmeli' :
    'zayıf';

  return { score, grade, missing, strengths, trustBadges };
}

export function toneForScore(score: number) {
  if (score >= 85) return 'emerald';
  if (score >= 68) return 'blue';
  if (score >= 45) return 'amber';
  return 'red';
}

export function getOfferTone(message: string) {
  const text = message.toLowerCase();
  let score = 50;
  const notes: string[] = [];

  if (message.trim().length >= 120) { score += 18; notes.push('Detay iyi'); }
  else if (message.trim().length < 40) { score -= 16; notes.push('Mesaj kısa'); }
  if (/(ekspertiz|bakım|servis|fatura|ruhsat|belge)/i.test(message)) { score += 14; notes.push('Güven sinyali var'); }
  if (/(fark|nakit|üste|tamamlarım|pazarlık)/i.test(message)) { score += 12; notes.push('Fiyat farkı konuşuluyor'); }
  if (/(acil|son fiyat|hemen|olmazsa olmaz|kesin)/i.test(text)) { score -= 12; notes.push('Baskıcı ton olabilir'); }
  if (/(merhaba|selam|teşekkür|uygun görürseniz|detay paylaşabilirim)/i.test(message)) { score += 10; notes.push('Nazik ton'); }

  score = Math.max(5, Math.min(100, score));
  return {
    score,
    label: score >= 80 ? 'güçlü teklif' : score >= 60 ? 'iyi' : score >= 40 ? 'geliştirilmeli' : 'zayıf',
    notes,
  };
}
