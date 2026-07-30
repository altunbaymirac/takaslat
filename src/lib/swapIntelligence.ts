import type {
  Listing,
  ListingVerification,
  SwapOffer,
  SwapProcessStep,
  VerificationState,
} from '../types';

export interface PassportItem {
  id: keyof ListingVerification | 'contact';
  label: string;
  state: VerificationState;
  detail: string;
}

export interface VehiclePassport {
  score: number;
  verifiedCount: number;
  items: PassportItem[];
  label: 'Yüksek güven' | 'Gelişiyor' | 'Temel';
}

const stateWeight: Record<VerificationState, number> = {
  verified: 1,
  pending: 0.45,
  not_started: 0,
};

export function getVehiclePassport(listing: Listing): VehiclePassport {
  const verification = listing.verification ?? {};
  const vehicle = listing.vehicleDetails;
  const hasExpertiseDocument = Boolean(
    vehicle?.hasExpertise &&
    listing.attachments?.some(
      (attachment) => attachment.kind === 'expertise' && !attachment.url.startsWith('blob:'),
    ),
  );

  const contactState: VerificationState =
    listing.ownerEmailVerified && listing.ownerPhoneVerified
      ? 'verified'
      : listing.ownerEmailVerified || listing.ownerPhoneVerified
        ? 'pending'
        : 'not_started';
  const identityState = verification.identity ?? 'not_started';

  const items: PassportItem[] = [
    {
      id: 'contact',
      label: 'İletişim',
      state: contactState,
      detail: contactState === 'verified' ? 'E-posta ve telefon doğrulandı' : 'İletişim doğrulaması tamamlanmadı',
    },
    {
      id: 'identity',
      label: 'Kimlik',
      state: identityState,
      detail: identityState === 'verified' ? 'Kimlik doğrulandı' : 'Kimlik doğrulaması yapılmadı',
    },
    {
      id: 'ownership',
      label: 'İlan verme yetkisi',
      state: verification.ownership ?? 'not_started',
      detail: verification.ownership === 'verified' ? 'Araç sahipliği doğrulandı' : 'EİDS doğrulaması bekleniyor',
    },
    {
      id: 'vin',
      label: 'Şasi bilgisi',
      state: verification.vin ?? 'not_started',
      detail: verification.vin === 'verified' ? 'Şasi bilgisi eşleşti' : 'Şasi doğrulaması yapılmadı',
    },
    {
      id: 'mileage',
      label: 'Kilometre geçmişi',
      state: verification.mileage ?? (vehicle?.km ? 'pending' : 'not_started'),
      detail: verification.mileage === 'verified' ? 'Kilometre kaydı doğrulandı' : vehicle?.km ? 'Satıcı beyanı mevcut' : 'Bilgi girilmedi',
    },
    {
      id: 'damage',
      label: 'Hasar geçmişi',
      state: verification.damage ?? (vehicle ? 'pending' : 'not_started'),
      detail: verification.damage === 'verified' ? 'Hasar kaydı doğrulandı' : vehicle ? 'Satıcı beyanı mevcut' : 'Bilgi girilmedi',
    },
    {
      id: 'expertise',
      label: 'Ekspertiz',
      state: verification.expertise ?? (hasExpertiseDocument ? 'pending' : 'not_started'),
      detail: verification.expertise === 'verified'
        ? 'Ekspertiz belgesi doğrulandı'
        : hasExpertiseDocument
          ? 'Belge yüklendi, doğrulama bekliyor'
          : 'Ekspertiz belgesi yok',
    },
  ];

  const score = Math.round(
    items.reduce((total, item) => total + stateWeight[item.state], 0) / items.length * 100,
  );
  const verifiedCount = items.filter((item) => item.state === 'verified').length;

  return {
    score,
    verifiedCount,
    items,
    label: score >= 75 ? 'Yüksek güven' : score >= 40 ? 'Gelişiyor' : 'Temel',
  };
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ğüşöçı\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listingTerms(listing: Listing) {
  const vehicle = listing.vehicleDetails;
  return [
    listing.category,
    listing.title,
    vehicle?.brand,
    vehicle?.model,
    vehicle?.bodyType,
    listing.propertyDetails?.type,
  ]
    .filter(Boolean)
    .flatMap((value) => normalize(String(value)).split(' '))
    .filter((value) => value.length >= 3);
}

export function wantsListing(source: Listing, target: Listing) {
  const wanted = normalize(source.wantedFor);
  if (!wanted) return false;

  const terms = listingTerms(target);
  const termMatch = terms.some((term) => wanted.includes(term));
  const categoryMatch = wanted.includes(normalize(target.category));
  const valueRatio = Math.abs(source.estimatedValue - target.estimatedValue) /
    Math.max(source.estimatedValue, target.estimatedValue, 1);

  return (termMatch || categoryMatch) && valueRatio <= 0.45;
}

export interface SwapChain {
  id: string;
  kind: 'direct' | 'three_way';
  listings: Listing[];
  maxCashGap: number;
}

export function findSwapChains(listings: Listing[], sourceId: string, limit = 3): SwapChain[] {
  const source = listings.find((listing) => listing.id === sourceId);
  if (!source) return [];

  const others = listings.filter((listing) => listing.id !== sourceId && listing.ownerId !== source.ownerId);
  const chains: SwapChain[] = [];

  for (const second of others) {
    if (!wantsListing(source, second)) continue;

    if (wantsListing(second, source)) {
      chains.push({
        id: `${source.id}:${second.id}`,
        kind: 'direct',
        listings: [source, second],
        maxCashGap: Math.abs(source.estimatedValue - second.estimatedValue),
      });
    }

    for (const third of others) {
      if (third.id === second.id || third.ownerId === second.ownerId) continue;
      if (!wantsListing(second, third) || !wantsListing(third, source)) continue;

      const values = [source.estimatedValue, second.estimatedValue, third.estimatedValue];
      chains.push({
        id: `${source.id}:${second.id}:${third.id}`,
        kind: 'three_way',
        listings: [source, second, third],
        maxCashGap: Math.max(...values) - Math.min(...values),
      });
    }
  }

  return chains
    .sort((a, b) => a.maxCashGap - b.maxCashGap || a.listings.length - b.listings.length)
    .filter((chain, index, all) => all.findIndex((item) => item.id === chain.id) === index)
    .slice(0, limit);
}

export interface OfferDecision {
  score: number;
  verdict: 'Güçlü aday' | 'İncelenmeli' | 'Riskli';
  valueGap: number | null;
  valueGapPercent: number | null;
  positives: string[];
  risks: string[];
  nextSteps: string[];
}

export function analyzeOffer(
  offer: SwapOffer,
  targetListing?: Listing,
  offeredListing?: Listing,
): OfferDecision {
  const offeredValue = offeredListing?.estimatedValue ?? offer.offeredValue;
  const targetValue = targetListing?.estimatedValue;
  const valueGap = offeredValue !== undefined && targetValue !== undefined
    ? offeredValue - targetValue
    : null;
  const valueGapPercent = valueGap !== null && targetValue
    ? Math.round(Math.abs(valueGap) / targetValue * 100)
    : null;

  let score = 55;
  const positives: string[] = [];
  const risks: string[] = [];
  const nextSteps: string[] = [];

  if (valueGapPercent !== null && valueGapPercent <= 10) {
    score += 24;
    positives.push('Değer farkı makul aralıkta');
  } else if (valueGapPercent !== null && valueGapPercent <= 20) {
    score += 10;
    positives.push('Değer farkı pazarlıkla kapanabilir');
  } else if (valueGapPercent !== null) {
    score -= 20;
    risks.push(valueGapPercent > 1000
      ? 'Değer farkı 10 kattan fazla'
      : `Değer farkı yaklaşık %${valueGapPercent}`);
    nextSteps.push('Nakit farkı ve piyasa değerini netleştirin');
  } else {
    score -= 10;
    risks.push('Teklif değeri net değil');
    nextSteps.push('Karşı taraftan net araç ve nakit farkı isteyin');
  }

  if (offeredListing?.attachments?.length) {
    score += 10;
    positives.push('Teklif edilen ilanda belge var');
  } else if (offeredListing) {
    score -= 8;
    risks.push('Teklif edilen ilanda belge görünmüyor');
    nextSteps.push('Ekspertiz ve servis belgelerini isteyin');
  }

  if (offeredListing?.ownerEmailVerified && offeredListing.ownerPhoneVerified) {
    score += 8;
    positives.push('Teklif sahibi iletişim bilgilerini doğrulamış');
  } else {
    risks.push('Teklif sahibinin doğrulamaları eksik olabilir');
  }

  if (offer.message.trim().length >= 80) {
    score += 5;
    positives.push('Teklif açıklaması detaylı');
  } else {
    score -= 5;
    risks.push('Teklif açıklaması kısa');
  }

  if (targetListing?.vehicleDetails && !targetListing.vehicleDetails.hasExpertise) {
    nextSteps.push('Kendi aracınız için de güncel ekspertiz planlayın');
  }
  nextSteps.push('Anlaşmadan önce güvenli ödeme ve noter adımlarını planlayın');

  score = Math.max(5, Math.min(100, score));
  return {
    score,
    verdict: score >= 78 ? 'Güçlü aday' : score >= 50 ? 'İncelenmeli' : 'Riskli',
    valueGap,
    valueGapPercent,
    positives,
    risks,
    nextSteps: [...new Set(nextSteps)].slice(0, 3),
  };
}

export const SWAP_PROCESS_STEPS: {
  id: SwapProcessStep;
  label: string;
  description: string;
}[] = [
  { id: 'identity', label: 'Taraf doğrulama', description: 'Kimlik ve ilan verme yetkisi kontrol edilir.' },
  { id: 'expertise', label: 'Ekspertiz', description: 'Güncel raporlar paylaşılır ve karşılaştırılır.' },
  { id: 'agreement', label: 'Takas protokolü', description: 'Araçlar, nakit fark ve teslim koşulları netleşir.' },
  { id: 'secure_payment', label: 'Güvenli ödeme', description: 'Nakit fark için güvenli ödeme hazırlığı yapılır.' },
  { id: 'notary', label: 'Noter ve teslim', description: 'Devir, anahtar ve belge teslimi tamamlanır.' },
];
