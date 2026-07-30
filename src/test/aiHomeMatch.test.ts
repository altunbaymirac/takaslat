import { describe, expect, it } from 'vitest';
import { mockListings } from '../data/mockListings';
import { aiHomeMatch } from '../services/api';

describe('AI home match fallback', () => {
  it('interprets compact vehicle mileage and returns local matches', async () => {
    const result = await aiHomeMatch(
      {
        query: '500km altı otomatik sedan',
        sourceListingId: mockListings[0].id,
        cashDirection: 'any',
      },
      mockListings,
      mockListings[0].ownerId,
    );

    expect(result.interpreted.maxKm).toBe(500_000);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.every((suggestion) => suggestion.listingId !== mockListings[0].id)).toBe(true);
  });
});
