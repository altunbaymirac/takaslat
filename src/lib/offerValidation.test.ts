import { describe, expect, it } from 'vitest';
import { validateOfferDraft } from './offerValidation';

const validOffer = {
  actorId: 'buyer',
  targetOwnerId: 'seller',
  targetListingId: 'target-listing',
  offeredListingId: 'buyer-listing',
  message: 'İlanımla takas teklif etmek istiyorum.',
  offeredValue: 500_000,
};

describe('validateOfferDraft', () => {
  it('rejects an offer to the actor own listing', () => {
    expect(validateOfferDraft({ ...validOffer, targetOwnerId: 'buyer' })).toBe('Kendi ilanınıza teklif veremezsiniz');
  });

  it('rejects using the target listing as the offered listing', () => {
    expect(validateOfferDraft({ ...validOffer, offeredListingId: 'target-listing' })).toBe('Aynı ilan takas teklifi olarak kullanılamaz');
  });

  it('rejects an empty offer without a listing or value', () => {
    expect(validateOfferDraft({ ...validOffer, offeredListingId: undefined, offeredValue: undefined })).toBe('Bir ilan seçin veya geçerli bir teklif değeri girin');
  });

  it('accepts a valid offer', () => {
    expect(validateOfferDraft(validOffer)).toBeNull();
  });

  it('accepts an offer without a message', () => {
    expect(validateOfferDraft({ ...validOffer, message: '' })).toBeNull();
    expect(validateOfferDraft({ ...validOffer, message: undefined })).toBeNull();
  });

  it('rejects a message over the length limit', () => {
    expect(validateOfferDraft({ ...validOffer, message: 'a'.repeat(2001) }))
      .toBe('Teklif mesajı en fazla 2000 karakter olabilir');
  });
});
