import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Trends from './Trends';
import { useAppStore, type AuthUser } from '../store/useAppStore';

const fetchTrends = vi.hoisted(() => vi.fn());

vi.mock('../services/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../services/api')>(),
  fetchTrends,
}));

const baseUser: AuthUser = {
  id: 'u1',
  name: 'Test Kullanıcı',
  email: 'test@takaslat.com',
  role: 'user',
};

function signIn(user: AuthUser | null) {
  useAppStore.setState({ currentUser: user, currentUserId: user?.id ?? '' });
}

function renderTrends() {
  return render(
    <MemoryRouter>
      <Trends />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchTrends.mockReset();
  fetchTrends.mockResolvedValue({
    totalListings: 3, avgPrice: 100, totalValue: 300, recent7d: 1,
    topBrands: [], categories: [], topCities: [], fuels: [],
  });
});

describe('Trends erişimi', () => {
  it('giriş yapmamış ziyaretçiye veri getirmez', () => {
    signIn(null);
    renderTrends();

    expect(screen.getByText('Admin yetkisi gerekli')).toBeInTheDocument();
    expect(fetchTrends).not.toHaveBeenCalled();
  });

  it('normal kullanıcıya veri getirmez', () => {
    signIn(baseUser);
    renderTrends();

    expect(screen.getByText('Admin yetkisi gerekli')).toBeInTheDocument();
    expect(fetchTrends).not.toHaveBeenCalled();
  });

  it('admin ve moderatör için veriyi yükler', async () => {
    for (const role of ['admin', 'moderator']) {
      fetchTrends.mockClear();
      signIn({ ...baseUser, role });
      const view = renderTrends();

      expect(screen.queryByText('Admin yetkisi gerekli')).not.toBeInTheDocument();
      await waitFor(() => expect(fetchTrends).toHaveBeenCalledTimes(1));
      view.unmount();
    }
  });
});
