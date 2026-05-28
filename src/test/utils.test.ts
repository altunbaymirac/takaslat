import { describe, it, expect } from 'vitest';

// ─── fmt (para formatı) ───────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

describe('fmt — para formatı', () => {
  it('tam sayıyı TRY formatında döndürür', () => {
    expect(fmt(1_000_000)).toContain('1');
    expect(fmt(1_000_000)).toContain('000');
  });

  it('negatif değerlerde de çalışır', () => {
    const result = fmt(-5000);
    expect(result).toBeTruthy();
  });

  it('sıfır için geçerli string döndürür', () => {
    expect(fmt(0)).toBeTruthy();
  });
});

// ─── timeAgo ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

describe('timeAgo — zaman etiketi', () => {
  it('yeni tarih için "Az önce" döndürür', () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe('Az önce');
  });

  it('5 dakika önce için "5 dk önce" döndürür', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5 dk önce');
  });

  it('2 saat önce için "2 sa önce" döndürür', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe('2 sa önce');
  });

  it('3 gün önce için "3 gün önce" döndürür', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe('3 gün önce');
  });
});
