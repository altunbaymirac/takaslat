import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';

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

describe('store - live auction', () => {
  it('createAuction creates an auction and accepts a valid bid', async () => {
    const now = Date.now();
    const auctionId = await useAppStore.getState().createAuction({
      listingId: 'listing-auction-1',
      title: 'Test auction',
      startsAt: new Date(now - 1_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      startingPrice: 100_000,
      bidIncrement: 10_000,
      status: 'live',
    });

    await useAppStore.getState().placeAuctionBid(auctionId, 110_000);

    const auction = useAppStore.getState().auctions.find((item) => item.id === auctionId);
    expect(auction?.currentBid).toBe(110_000);
    expect(auction?.bids).toHaveLength(1);
    expect(auction?.watcherCount).toBe(0);
  });

  it('rejects bids below the minimum increment', async () => {
    const now = Date.now();
    const auctionId = await useAppStore.getState().createAuction({
      listingId: 'listing-auction-2',
      title: 'Low bid test',
      startsAt: new Date(now - 1_000).toISOString(),
      endsAt: new Date(now + 60_000).toISOString(),
      startingPrice: 100_000,
      bidIncrement: 10_000,
      status: 'live',
    });

    await expect(
      useAppStore.getState().placeAuctionBid(auctionId, 105_000),
    ).rejects.toThrow('Minimum teklif');

    const auction = useAppStore.getState().auctions.find((item) => item.id === auctionId);
    expect(auction?.currentBid).toBe(100_000);
    expect(auction?.bids).toHaveLength(0);
  });
});
