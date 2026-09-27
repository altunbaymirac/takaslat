import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore, type AuthUser } from '../store/useAppStore';

const getPref = vi.fn<() => Promise<boolean>>();
const setPref = vi.fn<(enabled: boolean) => Promise<void>>();
const forgotPassword = vi.fn<(email: string) => Promise<{ message: string }>>();

vi.mock('../services/api', () => ({
  requestEmailVerification: vi.fn(async () => ({ message: 'gönderildi' })),
  getEmailNotificationPref: () => getPref(),
  setEmailNotificationPref: (enabled: boolean) => setPref(enabled),
  forgotPassword: (email: string) => forgotPassword(email),
}));

const showToast = vi.fn();
vi.mock('../components/Toast', () => ({ showToast: (...args: unknown[]) => showToast(...args) }));

import Settings from './Settings';

const user: AuthUser = {
  id: 'u1',
  name: 'Test Kullanıcı',
  email: 'test@takaslat.com',
  role: 'user',
};

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );
}

function mailToggle() {
  return screen.getByRole('button', { name: 'E-posta bildirimlerini aç/kapat' });
}

beforeEach(() => {
  getPref.mockReset();
  setPref.mockReset();
  showToast.mockReset();
  forgotPassword.mockReset();
  getPref.mockResolvedValue(true);
  setPref.mockResolvedValue(undefined);
  forgotPassword.mockResolvedValue({ message: 'ok' });
  useAppStore.setState({ currentUser: user, currentUserId: user.id });
});

describe('Ayarlar — e-posta bildirimi tercihi', () => {
  it('kayıtlı tercihi yükleyip anahtara yansıtır', async () => {
    getPref.mockResolvedValue(false);
    renderSettings();

    await waitFor(() => expect(mailToggle()).toHaveAttribute('aria-pressed', 'false'));
  });

  it('kapatıldığında tercihi sunucuya yazar', async () => {
    renderSettings();
    await waitFor(() => expect(mailToggle()).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(mailToggle());

    await waitFor(() => expect(setPref).toHaveBeenCalledWith(false));
    expect(mailToggle()).toHaveAttribute('aria-pressed', 'false');
  });

  it('kaydetme başarısızsa anahtarı eski haline döndürür', async () => {
    setPref.mockRejectedValue(new Error('network'));
    renderSettings();
    await waitFor(() => expect(mailToggle()).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(mailToggle());

    // İyimser güncelleme geri alınmalı, yoksa kullanıcı kapattığını sanır.
    await waitFor(() => expect(mailToggle()).toHaveAttribute('aria-pressed', 'true'));
    expect(showToast).toHaveBeenCalledWith('Tercih kaydedilemedi, tekrar dene', 'error');
  });

  it('tercih okunamazsa varsayılanı açık bırakır', async () => {
    getPref.mockRejectedValue(new Error('kolon yok'));
    renderSettings();

    await waitFor(() => expect(mailToggle()).toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('Ayarlar — şifre değiştirme', () => {
  it('bağlantıyı kullanıcının kendi e-postasına gönderir', async () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Şifremi değiştir' }));

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('test@takaslat.com'));
    expect(await screen.findByText(/Bağlantı gönderildi/)).toBeInTheDocument();
  });
});
