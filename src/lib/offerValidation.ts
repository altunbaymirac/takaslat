export const MIN_OFFER_MESSAGE_LENGTH = 10;
export const MAX_OFFER_MESSAGE_LENGTH = 2000;
export const MAX_OFFER_VALUE = 2_000_000_000;

type OfferDraft = {
  actorId?: string;
  targetOwnerId: string;
  targetListingId: string;
  offeredListingId?: string;
  message: string;
  offeredValue?: number;
};

export function validateOfferDraft(draft: OfferDraft): string | null {
  if (!draft.actorId) return 'Teklif göndermek için giriş yapmalısınız';
  if (draft.actorId === draft.targetOwnerId) return 'Kendi ilanınıza teklif veremezsiniz';
  if (draft.offeredListingId === draft.targetListingId) return 'Aynı ilan takas teklifi olarak kullanılamaz';

  const messageLength = draft.message.trim().length;
  if (messageLength < MIN_OFFER_MESSAGE_LENGTH) {
    return `Teklif mesajı en az ${MIN_OFFER_MESSAGE_LENGTH} karakter olmalıdır`;
  }
  if (messageLength > MAX_OFFER_MESSAGE_LENGTH) {
    return `Teklif mesajı en fazla ${MAX_OFFER_MESSAGE_LENGTH} karakter olabilir`;
  }

  if (draft.offeredValue !== undefined) {
    if (!Number.isSafeInteger(draft.offeredValue) || draft.offeredValue < 0 || draft.offeredValue > MAX_OFFER_VALUE) {
      return 'Teklif değeri geçersiz';
    }
  }

  if (!draft.offeredListingId && (!draft.offeredValue || draft.offeredValue <= 0)) {
    return 'Bir ilan seçin veya geçerli bir teklif değeri girin';
  }

  return null;
}
