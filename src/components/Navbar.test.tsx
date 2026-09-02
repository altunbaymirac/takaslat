import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';
import { useAppStore, type AuthUser } from '../store/useAppStore';

const baseUser: AuthUser = {
  id: 'u1',
  name: 'Test Kullanıcı',
  email: 'test@takaslat.com',
  role: 'user',
};

function signIn(user: AuthUser | null) {
  useAppStore.setState({
    currentUser: user,
    currentUserId: user?.id ?? '',
    offers: [],
    favorites: [],
    notifications: [],
  });
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
}

function openAccountMenu() {
  fireEvent.click(screen.getByText(baseUser.name.split(' ')[0]));
}

function openMobileMenu() {
  fireEvent.click(screen.getByRole('button', { name: /Bilgilerim/ }));
  return screen.getByRole('dialog', { name: 'Bilgilerim' });
}

beforeEach(() => {
  signIn(baseUser);
});

describe('Navbar mobil hesap menüsü', () => {
  it('hesap açılır menüsünü mobilde gizler', () => {
    renderNavbar();
    // Avatar tetikleyicisi masaüstüne özel; mobilde görünmemeli.
    const trigger = screen.getByText('Test').closest('div');
    expect(trigger?.className).toContain('hidden');
    expect(trigger?.className).toContain('md:block');
  });

  it('açılır menüdeki bağlantıları alttaki Bilgilerim sayfasına taşır', () => {
    renderNavbar();
    const sheet = openMobileMenu();

    for (const label of ['Profilim', 'İlanlarım', 'Favoriler', 'Görüşmeler', 'Canlı Mezat', 'Harita', 'Ayarlar']) {
      expect(within(sheet).getByText(label)).toBeInTheDocument();
    }
    expect(within(sheet).getByRole('button', { name: 'Çıkış yap' })).toBeInTheDocument();
    expect(within(sheet).getByText(baseUser.email)).toBeInTheDocument();
  });

  it('giriş yapılmamışken alt sayfada giriş ve kayıt sunar', () => {
    signIn(null);
    renderNavbar();
    const sheet = openMobileMenu();

    expect(within(sheet).getByRole('link', { name: 'Giriş yap' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Kayıt ol' })).toBeInTheDocument();
  });
});

describe('Navbar Trendler görünürlüğü', () => {
  it('normal kullanıcıya Trendler bağlantısı göstermez', () => {
    renderNavbar();
    openAccountMenu();
    expect(screen.queryByRole('link', { name: 'Trendler' })).not.toBeInTheDocument();
  });

  it('admin kullanıcıya yalnızca masaüstü menüsünde Trendler gösterir', () => {
    signIn({ ...baseUser, role: 'admin' });
    renderNavbar();
    openAccountMenu();

    expect(screen.getByRole('link', { name: 'Trendler' })).toBeInTheDocument();

    const sheet = openMobileMenu();
    expect(within(sheet).queryByText('Trendler')).not.toBeInTheDocument();
    expect(within(sheet).getByText('Admin paneli')).toBeInTheDocument();
  });

  it('mobil alt navigasyonda Trendler sekmesi bulunmaz', () => {
    signIn({ ...baseUser, role: 'admin' });
    renderNavbar();

    const bottomNav = screen.getByRole('navigation', { name: 'Mobil ana navigasyon' });
    expect(within(bottomNav).queryByText('Trendler')).not.toBeInTheDocument();
    expect(within(bottomNav).getByText('İlanlar')).toBeInTheDocument();
    expect(within(bottomNav).getByText('Bilgilerim')).toBeInTheDocument();
  });
});
