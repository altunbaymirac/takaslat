import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auctions from './Auctions';
import { useAppStore, type AuthUser } from '../store/useAppStore';
import type { Listing } from '../types';

const createAuction = vi.hoisted(() => vi.fn());

vi.mock('../services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/api')>(),
  createAuctionApi: createAuction,
  fetchAuctions: vi.fn(async () => []),
  subscribeAuctionStream: () => () => undefined,
}));

const owner: AuthUser = { id: 'owner-1', name: 'Mezat Sahibi', email: 'sahip@takaslat.com', role: 'user' };

const listing: Listing = {
  id: 'listing-1',
  title: 'Takas için temiz araç',
  category: 'Araç',
  estimatedValue: 600_000,
  description: 'Test ilanı için yeterli uzunlukta bir açıklama metni burada duruyor.',
  wantedFor: 'Benzer değerde bir araç arıyorum.',
  city: 'Kayseri',
  images: ['https://example.com/image.jpg'],
  ownerId: owner.id,
  ownerName: owner.name,
  ownerAvatar: '',
  createdAt: new Date().toISOString(),
  condition: 'İyi',
  tags: [],
  isActive: true,
  moderationStatus: 'approved',
};

function renderAuctions() {
  return render(
    <MemoryRouter>
      <Auctions />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  createAuction.mockReset();
  createAuction.mockImplementation(async (auction: Record<string, unknown>) => ({
    ...auction,
    id: 'auction-1',
    bids: [],
    currentBid: auction.startingPrice,
    watcherCount: 0,
  }));
  useAppStore.setState({
    listings: [listing],
    auctions: [],
    currentUser: owner,
    currentUserId: owner.id,
    currentUserName: owner.name,
  });
});

describe('Mezat açma formu', () => {
  it('fiyat, artış, rezerv ve süre alanlarını sunar', () => {
    renderAuctions();

    expect(screen.getByText('Mezata çıkacak ilan')).toBeInTheDocument();
    expect(screen.getByText('Başlangıç fiyatı (₺)')).toBeInTheDocument();
    expect(screen.getByText('Minimum artış (₺)')).toBeInTheDocument();
    expect(screen.getByText(/Rezerv fiyat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 gün' })).toBeInTheDocument();
  });

  it('girilen değerlerle mezat açar', async () => {
    const { container } = renderAuctions();
    const numbers = container.querySelectorAll<HTMLInputElement>('input[type="number"]');

    fireEvent.change(numbers[0], { target: { value: '450000' } });
    fireEvent.change(numbers[1], { target: { value: '9000' } });
    fireEvent.change(numbers[2], { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: '1 gün' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mezadı başlat' }));

    await waitFor(() => expect(createAuction).toHaveBeenCalledTimes(1));
    const sent = createAuction.mock.calls[0][0];
    expect(sent.startingPrice).toBe(450_000);
    expect(sent.bidIncrement).toBe(9_000);
    expect(sent.reservePrice).toBe(500_000);
    const durationMinutes = (new Date(sent.endsAt).getTime() - new Date(sent.startsAt).getTime()) / 60_000;
    expect(Math.round(durationMinutes)).toBe(1_440);
  });

  it('rezerv fiyat başlangıcın altındaysa mezat açmaz', async () => {
    const { container } = renderAuctions();
    const numbers = container.querySelectorAll<HTMLInputElement>('input[type="number"]');

    fireEvent.change(numbers[0], { target: { value: '450000' } });
    fireEvent.change(numbers[2], { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mezadı başlat' }));

    expect(await screen.findByText('Rezerv fiyat, başlangıç fiyatından düşük olamaz.')).toBeInTheDocument();
    expect(createAuction).not.toHaveBeenCalled();
  });
});
