import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore, type AuthUser } from '../store/useAppStore';
import type { AdminReport } from '../services/api';

const pendingReport: AdminReport = {
  id: 'r1',
  listingId: 'l1',
  reason: 'scam',
  details: 'Kapora istiyor, aracı göstermiyor.',
  status: 'pending',
  createdAt: '2026-09-20T10:00:00.000Z',
  listing: { id: 'l1', title: '2010 Renault Fluence', city: 'Kayseri', isActive: true, moderationStatus: 'approved' },
  reporter: { id: 'u2', name: 'Ayşe', email: 'ayse@example.com' },
};

const fetchAdminReports = vi.fn(async () => [pendingReport]);
const reviewReport = vi.fn(async () => undefined);

vi.mock('../services/api', () => ({
  fetchAdminReports: (...a: unknown[]) => fetchAdminReports(...(a as [])),
  reviewReport: (...a: unknown[]) => reviewReport(...(a as [])),
  fetchAdminStats: vi.fn(async () => ({
    users: 30, listings: 2, pendingListings: 0, offers: 1, reports: 1, notifications: 0, recentListings: [],
  })),
  fetchAdminListings: vi.fn(async () => []),
  fetchAdminUsers: vi.fn(async () => []),
  fetchAuctionRequests: vi.fn(async () => []),
  reviewAuctionRequest: vi.fn(),
  moderateListing: vi.fn(),
  setUserRole: vi.fn(),
  banUser: vi.fn(),
  sendTestNotification: vi.fn(),
}));

vi.mock('../components/Toast', () => ({ showToast: vi.fn() }));

import Admin from './Admin';

const admin: AuthUser = { id: 'a1', name: 'Yönetici', email: 'admin@takaslat.com', role: 'admin' };

function renderAdmin() {
  return render(
    <MemoryRouter>
      <Admin />
    </MemoryRouter>,
  );
}

async function openReportsTab() {
  renderAdmin();
  const tab = await screen.findByRole('button', { name: /Şikayetler/ });
  fireEvent.click(tab);
  return tab;
}

beforeEach(() => {
  fetchAdminReports.mockClear();
  reviewReport.mockClear();
  useAppStore.setState({ currentUser: admin, currentUserId: admin.id });
  // happy-dom bu ikisini uygulamıyor, doğrudan yerine koyuyoruz.
  vi.stubGlobal('confirm', vi.fn(() => true));
  vi.stubGlobal('prompt', vi.fn(() => 'Dolandırıcılık'));
});

describe('Admin — şikayet incelemesi', () => {
  it('bekleyen şikayetleri sebep ve ihbar edenle birlikte listeler', async () => {
    await openReportsTab();

    expect(await screen.findByText('2010 Renault Fluence')).toBeInTheDocument();
    expect(screen.getByText('Dolandırıcılık şüphesi')).toBeInTheDocument();
    expect(screen.getByText(/Ayşe bildirdi/)).toBeInTheDocument();
    expect(screen.getByText(/Kapora istiyor/)).toBeInTheDocument();
  });

  it('yalnızca bekleyen şikayetleri ister', async () => {
    await openReportsTab();
    await waitFor(() => expect(fetchAdminReports).toHaveBeenCalledWith('pending'));
  });

  it('ilanı kaldırırken sebebi sunucuya iletir', async () => {
    await openReportsTab();
    fireEvent.click(await screen.findByRole('button', { name: 'İlanı kaldır' }));

    await waitFor(() => expect(reviewReport).toHaveBeenCalledWith('r1', 'reject', 'Dolandırıcılık'));
  });

  it('yersiz bulunan şikayeti ilana dokunmadan kapatır', async () => {
    await openReportsTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Yersiz' }));

    await waitFor(() => expect(reviewReport).toHaveBeenCalledWith('r1', 'dismiss', undefined));
  });
});
