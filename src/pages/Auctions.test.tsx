import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Auctions from './Auctions';
import { useAppStore, type AuthUser } from '../store/useAppStore';
import type { Listing } from '../types';

const createAuction = vi.hoisted(() => vi.fn());
const submitAuctionRequest = vi.hoisted(() => vi.fn());
const fetchMyAuctionRequests = vi.hoisted(() => vi.fn());

vi.mock('../services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/api')>(),
  createAuctionApi: createAuction,
  fetchAuctions: vi.fn(async () => []),
  subscribeAuctionStream: () => () => undefined,
  submitAuctionRequest,
  fetchMyAuctionRequests,
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

function signIn(user: AuthUser) {
  useAppStore.setState({
    listings: [listing],
    auctions: [],
    currentUser: user,
    currentUserId: user.id,
    currentUserName: user.name,
  });
}

beforeEach(() => {
  createAuction.mockReset();
  submitAuctionRequest.mockReset();
  fetchMyAuctionRequests.mockReset();
  fetchMyAuctionRequests.mockResolvedValue([]);
  submitAuctionRequest.mockImplementation(async (payload: Record<string, unknown>) => ({
    id: 'req-1', listingId: payload.listingId, ownerId: owner.id,
    expectedPrice: payload.expectedPrice ?? null, note: payload.note ?? null,
    status: 'pending', reviewNote: null, auctionId: null, createdAt: new Date().toISOString(),
  }));
  createAuction.mockImplementation(async (auction: Record<string, unknown>) => ({
    ...auction, id: 'auction-1', bids: [], currentBid: auction.startingPrice, watcherCount: 0,
  }));
  signIn(owner);
});

describe('Mezat başvurusu', () => {
  it('kullanıcıya tek bir başvuru butonu gösterir', () => {
    renderAuctions();

    expect(screen.getByRole('button', { name: 'Aracımı açık artırmaya sunmak istiyorum' })).toBeInTheDocument();
    // Doğrudan mezat açma yalnızca yönetimde.
    expect(screen.queryByRole('button', { name: 'Mezadı başlat' })).not.toBeInTheDocument();
  });

  it('seçilen ilan ve beklenen fiyatla başvuru gönderir', async () => {
    renderAuctions();
    fireEvent.click(screen.getByRole('button', { name: 'Aracımı açık artırmaya sunmak istiyorum' }));

    fireEvent.change(screen.getByRole('combobox'), { target: { value: listing.id } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '450000' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Ekspertizi temiz.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Başvuruyu gönder' }));

    await waitFor(() => expect(submitAuctionRequest).toHaveBeenCalledTimes(1));
    expect(submitAuctionRequest.mock.calls[0][0]).toMatchObject({
      listingId: listing.id,
      expectedPrice: 450_000,
      note: 'Ekspertizi temiz.',
    });
    expect(await screen.findByText(/Başvurun alındı/)).toBeInTheDocument();
  });
});

describe('Yönetim mezat formu', () => {
  beforeEach(() => signIn({ ...owner, role: 'admin' }));

  it('fiyat, artış, rezerv ve süre alanlarını sunar', () => {
    renderAuctions();

    expect(screen.getByText('Başlangıç fiyatı (₺)')).toBeInTheDocument();
    expect(screen.getByText('Minimum artış (₺)')).toBeInTheDocument();
    expect(screen.getByText(/Rezerv fiyat/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 gün' })).toBeInTheDocument();
  });

  it('girilen değerlerle mezat açar', async () => {
    const { container } = renderAuctions();
    const numbers = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];

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
    const numbers = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];

    fireEvent.change(numbers[0], { target: { value: '450000' } });
    fireEvent.change(numbers[2], { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mezadı başlat' }));

    expect(await screen.findByText('Rezerv fiyat, başlangıç fiyatından düşük olamaz.')).toBeInTheDocument();
    expect(createAuction).not.toHaveBeenCalled();
  });
});
