import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ListingDetail from './ListingDetail';
import { useAppStore, type AuthUser } from '../store/useAppStore';
import type { Listing } from '../types';

const fetchListingVerification = vi.hoisted(() => vi.fn());

vi.mock('../services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/api')>(),
  fetchListingVerification,
}));

const LISTING_ID = 'listing-1';

const listing: Listing = {
  id: LISTING_ID,
  title: 'Takas için temiz araç',
  category: 'Araç',
  estimatedValue: 750_000,
  description: 'Test ilanı için yeterli uzunlukta bir açıklama metni burada duruyor.',
  wantedFor: 'Benzer değerde aktif bir araç ilanı arıyorum, nakit fark konuşulabilir.',
  city: 'İstanbul',
  images: ['https://example.com/image.jpg'],
  ownerId: 'owner-1',
  ownerName: 'İlan Sahibi',
  ownerAvatar: '',
  createdAt: new Date().toISOString(),
  condition: 'İyi',
  tags: [],
  isActive: true,
  moderationStatus: 'approved',
};

const visitor: AuthUser = {
  id: 'visitor-1',
  name: 'Ziyaretçi',
  email: 'ziyaretci@takaslat.com',
  role: 'user',
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/listing/${LISTING_ID}`]}>
      <Routes>
        <Route path="/listing/:id" element={<ListingDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchListingVerification.mockReset();
  fetchListingVerification.mockResolvedValue(null);
  useAppStore.setState({
    listings: [listing],
    offers: [],
    favorites: [],
    currentUser: visitor,
    currentUserId: visitor.id,
  });
});

describe('İlan detayı aksiyonları', () => {
  it('favoriye ekleme bağlantısı sunar ve favoriyi günceller', async () => {
    renderDetail();

    const favoriteButtons = await screen.findAllByRole('button', { name: /Favorilere ekle/ });
    fireEvent.click(favoriteButtons[0]);

    await waitFor(() => expect(useAppStore.getState().favorites).toContain(LISTING_ID));
    expect(screen.getAllByRole('button', { name: /Favorilerde/ }).length).toBeGreaterThan(0);
  });

  it('paylaşım bağlantısı gösterir', async () => {
    renderDetail();
    expect((await screen.findAllByRole('button', { name: /Paylaş/ })).length).toBeGreaterThan(0);
  });

  it('şikayet bağlantısı sunar ve modalı açar', async () => {
    renderDetail();

    const reportButtons = await screen.findAllByRole('button', { name: 'Bu ilanı bildir' });
    fireEvent.click(reportButtons[0]);

    expect(await screen.findByRole('heading', { name: 'İlanı Şikayet Et' })).toBeInTheDocument();
  });

  it('ilan sahibine şikayet bağlantısı göstermez', async () => {
    useAppStore.setState({
      currentUser: { ...visitor, id: listing.ownerId },
      currentUserId: listing.ownerId,
    });
    renderDetail();

    await screen.findAllByRole('button', { name: /Paylaş/ });
    expect(screen.queryByRole('button', { name: 'Bu ilanı bildir' })).not.toBeInTheDocument();
  });
});
