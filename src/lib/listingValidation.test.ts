import { describe, expect, it } from 'vitest';
import { validateListingDraft, validateListingValue } from './listingValidation';

describe('listing validation', () => {
  it('rejects zero and unrealistic low listing values', () => {
    expect(validateListingValue(0)).toContain('en az');
    expect(validateListingValue(999)).toContain('en az');
    expect(validateListingValue(1_000)).toBeNull();
  });

  it('accepts complete listing content', () => {
    expect(validateListingDraft({
      title: '2010 Renault Fluence',
      description: 'Bakımları düzenli yapılmış, detaylı ve gerçek bir ilan açıklaması.',
      wantedFor: 'Sedan veya hatchback araçlarla takas düşünüyorum.',
      images: ['https://example.com/car.jpg'],
      estimatedValue: 600_000,
    })).toBeNull();
  });
});
