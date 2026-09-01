import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';
import type { Listing, LiveAuction } from '../types';

function listing(id: string, ownerId: string): Listing {
  return {
    id,
    title: `İlan ${id}`,
    category: 'Araç',
    estimatedValue: 500_000,
    description: 'Test ilanı için yeterli uzunlukta açıklama metni.',
    wantedFor: 'Benzer değerde aktif bir araç ilanı arıyorum.',
    city: 'İstanbul',
    images: ['https://example.com/image.jpg'],
    ownerId,
    ownerName: 'Test Kullanıcı',
    ownerAvatar: '',
    createdAt: new Date().toISOString(),
    condition: 'İyi',
    tags: [],
    isActive: true,
    moderationStatus: 'approved',
  };
}

beforeEach(() => {
  useAppStore.setState({
    favorites: [],
    compareList: [],
    darkMode: false,
    offers: [],
    auctions: [],
    swapProcesses: {},
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
});

describe('store - secure swap process', () => {
  it('tracks and untracks a completed process step', () => {
    useAppStore.getState().toggleSwapProcessStep('offer-1', 'identity');
    expect(useAppStore.getState().swapProcesses['offer-1'].completedSteps).toEqual(['identity']);

    useAppStore.getState().toggleSwapProcessStep('offer-1', 'identity');
    expect(useAppStore.getState().swapProcesses['offer-1'].completedSteps).toEqual([]);
  });
});

describe('store - favorites', () => {
  it('toggleFavorite adds listing', () => {
    useAppStore.getState().toggleFavorite('listing-1');
    expect(useAppStore.getState().favorites).toContain('listing-1');
  });

  it('toggleFavorite removes listing when called again', () => {
    useAppStore.getState().toggleFavorite('listing-1');
    useAppStore.getState().toggleFavorite('listing-1');
    expect(useAppStore.getState().favorites).not.toContain('listing-1');
  });

  it('isFavorite returns the right value', () => {
    useAppStore.getState().toggleFavorite('listing-2');
    expect(useAppStore.getState().isFavorite('listing-2')).toBe(true);
    expect(useAppStore.getState().isFavorite('listing-99')).toBe(false);
  });
});

describe('store - compare', () => {
  it('toggleCompare adds listing', () => {
    useAppStore.getState().toggleCompare('listing-A');
    expect(useAppStore.getState().compareList).toContain('listing-A');
  });

  it('clearCompare clears the list', () => {
    useAppStore.getState().toggleCompare('listing-A');
    useAppStore.getState().toggleCompare('listing-B');
    useAppStore.getState().clearCompare();
    expect(useAppStore.getState().compareList).toHaveLength(0);
  });

  it('keeps at most three listings', () => {
    useAppStore.getState().toggleCompare('A');
    useAppStore.getState().toggleCompare('B');
    useAppStore.getState().toggleCompare('C');
    useAppStore.getState().toggleCompare('D');
    expect(useAppStore.getState().compareList.length).toBeLessThanOrEqual(3);
  });
});

describe('store - dark mode', () => {
  it('toggleDarkMode toggles the value', () => {
    expect(useAppStore.getState().darkMode).toBe(false);
    useAppStore.getState().toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(true);
    useAppStore.getState().toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(false);
  });

  it('setDarkMode assigns the value directly', () => {
    useAppStore.getState().setDarkMode(true);
    expect(useAppStore.getState().darkMode).toBe(true);
  });
});

describe('store - offer integrity', () => {
  it('blocks offering on the current user own listing before the API call', async () => {
    const ownListing = listing('target', 'user-1');
    useAppStore.setState({ currentUserId: 'user-1', listings: [ownListing] });

    await expect(useAppStore.getState().sendOffer({
      fromUserId: 'user-1',
      fromUserName: 'Kullanıcı',
      toUserId: 'user-1',
      listingId: ownListing.id,
      listingTitle: ownListing.title,
      message: 'Kendi ilanıma teklif göndermeyi deniyorum.',
      status: 'Beklemede',
      offeredValue: 100_000,
    })).rejects.toThrow('Kendi ilanınıza teklif veremezsiniz');
  });

  it('blocks using another user listing as the offered asset', async () => {
    const target = listing('target', 'seller');
    const foreignListing = listing('foreign', 'someone-else');
    useAppStore.setState({ currentUserId: 'buyer', listings: [target, foreignListing] });

    await expect(useAppStore.getState().sendOffer({
      fromUserId: 'buyer',
      fromUserName: 'Alıcı',
      toUserId: 'seller',
      listingId: target.id,
      listingTitle: target.title,
      offeredListingId: foreignListing.id,
      offeredListingTitle: foreignListing.title,
      message: 'Başkasının ilanını teklif etmeyi deniyorum.',
      status: 'Beklemede',
      offeredValue: foreignListing.estimatedValue,
    })).rejects.toThrow('Yalnızca kendi aktif ilanınızı teklif edebilirsiniz');
  });

  it('blocks bidding on the current user own auction before optimistic state changes', async () => {
    const auction: LiveAuction = {
      id: 'auction-1',
      listingId: 'listing-1',
      ownerId: 'user-1',
      title: 'Test mezadı',
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      startingPrice: 100_000,
      currentBid: 100_000,
      bidIncrement: 5_000,
      status: 'live',
      bids: [],
      watcherCount: 0,
      createdAt: new Date().toISOString(),
    };
    useAppStore.setState({ currentUserId: 'user-1', auctions: [auction] });

    await expect(useAppStore.getState().placeAuctionBid(auction.id, 105_000)).rejects.toThrow('Kendi mezadınıza teklif veremezsiniz');
    expect(useAppStore.getState().auctions[0].bids).toHaveLength(0);
  });
});

describe('store - report integrity', () => {
  it('blocks reporting the current user own listing', async () => {
    const ownListing = listing('own-listing', 'user-1');
    useAppStore.setState({ currentUserId: 'user-1', listings: [ownListing], reports: [] });

    await expect(
      useAppStore.getState().addReport(ownListing.id, 'misleading', 'Test şikayeti'),
    ).rejects.toThrow('Kendi ilanınızı şikayet edemezsiniz');
    expect(useAppStore.getState().reports).toHaveLength(0);
  });
});

describe('store - live auction', () => {
  it('createAuction creates an auction and accepts a valid bid', async () => {
    const now = Date.now();
    useAppStore.setState({ currentUserId: 'auction-owner', currentUserName: 'Mezat Sahibi' });
    const auctionId = await useAppStore.getState().createAuction({
      listingId: 'listing-auction-1',
      title: 'Test auction',
      startsAt: new Date(now - 1_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      startingPrice: 100_000,
      bidIncrement: 10_000,
      status: 'live',
    });

    useAppStore.setState({ currentUserId: 'auction-bidder', currentUserName: 'Teklif Veren' });
    await useAppStore.getState().placeAuctionBid(auctionId, 110_000);

    const auction = useAppStore.getState().auctions.find((item) => item.id === auctionId);
    expect(auction?.currentBid).toBe(110_000);
    expect(auction?.bids).toHaveLength(1);
    expect(auction?.watcherCount).toBe(0);
  });

  it('rejects bids below the minimum increment', async () => {
    const now = Date.now();
    useAppStore.setState({ currentUserId: 'auction-owner', currentUserName: 'Mezat Sahibi' });
    const auctionId = await useAppStore.getState().createAuction({
      listingId: 'listing-auction-2',
      title: 'Low bid test',
      startsAt: new Date(now - 1_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      startingPrice: 100_000,
      bidIncrement: 10_000,
      status: 'live',
    });

    useAppStore.setState({ currentUserId: 'auction-bidder', currentUserName: 'Teklif Veren' });
    await expect(
      useAppStore.getState().placeAuctionBid(auctionId, 105_000),
    ).rejects.toThrow('Minimum teklif');

    const auction = useAppStore.getState().auctions.find((item) => item.id === auctionId);
    expect(auction?.currentBid).toBe(100_000);
    expect(auction?.bids).toHaveLength(0);
  });
});
