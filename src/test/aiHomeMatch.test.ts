import { describe, expect, it } from 'vitest';
import { sampleListings } from './fixtures/listings';
import { aiHomeMatch } from '../services/api';

// Ağ testlerde kapalı (bkz. src/test/setup.ts), bu yüzden yerel eşleştirme
// fallback'i çalışır — ölçtüğümüz de bu.

describe('AI home match fallback', () => {
  it('interprets compact vehicle mileage and returns local matches', async () => {
    const result = await aiHomeMatch(
      {
        query: '500km altı otomatik sedan',
        sourceListingId: sampleListings[0].id,
        cashDirection: 'any',
      },
      sampleListings,
      sampleListings[0].ownerId,
    );

    expect(result.interpreted.maxKm).toBe(500_000);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((suggestion) => suggestion.listingId !== sampleListings[0].id)).toBe(true);
  });
});
