import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import Register from './Register';

const registerUser = vi.fn(async () => undefined);

function fillAndSubmit(container: HTMLElement, { honeypot = '' } = {}) {
  fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'gercek@ornek.com' } });
  fireEvent.change(container.querySelector('input[type="password"]')!, { target: { value: 'Guclu-Sifre-2026!' } });
  const nameInput = container.querySelector('input[type="text"]:not([name="website"])') as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value: 'Ayşe Yılmaz' } });
  if (honeypot) fireEvent.change(container.querySelector('input[name="website"]')!, { target: { value: honeypot } });
  const terms = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
  if (!terms.checked) fireEvent.click(terms);
  fireEvent.submit(container.querySelector('form')!);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  registerUser.mockClear();
  useAppStore.setState({ registerUser, currentUser: null });
});

afterEach(() => vi.useRealTimers());

function renderPage() {
  return render(<MemoryRouter><Register /></MemoryRouter>);
}

describe('Kayıt formu bot koruması', () => {
  it('saniyeler içinde gönderilen formu kayda göndermez', () => {
    const { container } = renderPage();
    fillAndSubmit(container);

    expect(registerUser).not.toHaveBeenCalled();
    expect(screen.getByText(/Kayıt tamamlanamadı/)).toBeInTheDocument();
  });

  it('bal küpü dolu formu kayda göndermez', () => {
    const { container } = renderPage();
    vi.advanceTimersByTime(20_000);
    fillAndSubmit(container, { honeypot: 'http://spam.example' });

    expect(registerUser).not.toHaveBeenCalled();
  });

  it('insan hızında doldurulan formu kayda gönderir', () => {
    const { container } = renderPage();
    vi.advanceTimersByTime(20_000);
    fillAndSubmit(container);

    expect(registerUser).toHaveBeenCalledTimes(1);
  });
});
