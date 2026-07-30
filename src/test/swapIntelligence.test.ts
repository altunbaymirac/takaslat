import { describe, expect, it } from 'vitest';
import type { Listing, SwapOffer } from '../types';
import {
  analyzeOffer,
  findSwapChains,
  getVehiclePassport,
} from '../lib/swapIntelligence';

function listing(
  id: string,
  ownerId: string,
  title: string,
  brand: string,
  model: string,
  wantedFor: string,
  estimatedValue: number,
): Listing {
  return {
    id,
    title,
    category: 'Araç',
    estimatedValue,
    description: 'Bakımları düzenli yapılmış, belgeleri mevcut ve takasa açık araç.',
    wantedFor,
    city: 'İstanbul',
    images: ['/car.jpg'],
    ownerId,
    ownerName: ownerId,
    ownerAvatar: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    condition: 'İyi',
    tags: [],
    vehicleDetails: {
      brand,
      model,
      year: 2021,
      km: 60_000,
      fuel: 'Benzin',
      transmission: 'Otomatik',
      color: 'Beyaz',
      hasAccidentRecord: false,
    },
  };
}

describe('swap intelligence', () => {
  it('finds a three-way chain when every owner wants the next listing', () => {
    const a = listing('a', 'owner-a', 'Renault Megane', 'Renault', 'Megane', 'BMW 3 Serisi istiyorum', 1_000_000);
    const b = listing('b', 'owner-b', 'BMW 3 Serisi', 'BMW', '3 Serisi', 'Toyota Corolla düşünüyorum', 1_100_000);
    const c = listing('c', 'owner-c', 'Toyota Corolla', 'Toyota', 'Corolla', 'Renault Megane ile takas', 950_000);

    const chains = findSwapChains([a, b, c], a.id);

    expect(chains).toHaveLength(1);
    expect(chains[0].kind).toBe('three_way');
    expect(chains[0].listings.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not label seller declarations as verified records', () => {
    const vehicle = listing('a', 'owner-a', 'Renault Megane', 'Renault', 'Megane', 'BMW', 1_000_000);
    vehicle.ownerEmailVerified = true;
    vehicle.ownerPhoneVerified = true;
    vehicle.vehicleDetails = { ...vehicle.vehicleDetails!, hasExpertise: true };
    vehicle.attachments = [{
      id: 'expertise',
      name: 'rapor.pdf',
      url: '/rapor.pdf',
      mimeType: 'application/pdf',
      kind: 'expertise',
      size: 1_000,
      createdAt: '2026-01-01T00:00:00.000Z',
    }];

    const passport = getVehiclePassport(vehicle);

    expect(passport.verifiedCount).toBe(1);
    expect(passport.items.find((item) => item.id === 'expertise')?.state).toBe('pending');
    expect(passport.items.find((item) => item.id === 'ownership')?.state).toBe('not_started');
  });

  it('scores a close-value documented offer as a strong candidate', () => {
    const target = listing('a', 'owner-a', 'Renault Megane', 'Renault', 'Megane', 'BMW', 1_000_000);
    const offered = listing('b', 'owner-b', 'BMW 3 Serisi', 'BMW', '3 Serisi', 'Renault', 1_050_000);
    offered.ownerEmailVerified = true;
    offered.ownerPhoneVerified = true;
    offered.attachments = [{
      id: 'service',
      name: 'servis.pdf',
      url: '/servis.pdf',
      mimeType: 'application/pdf',
      kind: 'document',
      size: 1_000,
      createdAt: '2026-01-01T00:00:00.000Z',
    }];
    const offer: SwapOffer = {
      id: 'offer-1',
      fromUserId: offered.ownerId,
      fromUserName: 'Teklif Sahibi',
      toUserId: target.ownerId,
      listingId: target.id,
      listingTitle: target.title,
      offeredListingId: offered.id,
      offeredListingTitle: offered.title,
      message: 'Merhaba, aracımın servis ve ekspertiz belgeleri hazır. Uygun görürseniz nakit farkı birlikte netleştirebiliriz.',
      status: 'Beklemede',
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    const analysis = analyzeOffer(offer, target, offered);

    expect(analysis.verdict).toBe('Güçlü aday');
    expect(analysis.valueGapPercent).toBe(5);
    expect(analysis.risks).toHaveLength(0);
  });
});
