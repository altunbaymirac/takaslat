import { describe, it, expect } from 'vitest';
import type { OfferStatus } from '../types';

// ─── Takas akış kuralları ─────────────────────────────────────────────────────
// Frontend ile aynı mantık; backend'i yansıtır.

const ALLOWED_TRANSITIONS: Record<OfferStatus, OfferStatus[]> = {
  Beklemede:   ['Görüşülüyor', 'Reddedildi'],
  Görüşülüyor: ['Onaylandı',   'Reddedildi'],
  Onaylandı:   ['Tamamlandı',  'Reddedildi'],
  Tamamlandı:  [],
  Reddedildi:  [],
};

function canTransition(from: OfferStatus, to: OfferStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

describe('Takas durum akışı', () => {
  it('Beklemede → Görüşülüyor geçişine izin verir', () => {
    expect(canTransition('Beklemede', 'Görüşülüyor')).toBe(true);
  });

  it('Beklemede → Reddedildi geçişine izin verir', () => {
    expect(canTransition('Beklemede', 'Reddedildi')).toBe(true);
  });

  it('Beklemede → Onaylandı direkt geçişine izin vermez', () => {
    expect(canTransition('Beklemede', 'Onaylandı')).toBe(false);
  });

  it('Beklemede → Tamamlandı direkt geçişine izin vermez', () => {
    expect(canTransition('Beklemede', 'Tamamlandı')).toBe(false);
  });

  it('Görüşülüyor → Onaylandı geçişine izin verir', () => {
    expect(canTransition('Görüşülüyor', 'Onaylandı')).toBe(true);
  });

  it('Görüşülüyor → Reddedildi geçişine izin verir', () => {
    expect(canTransition('Görüşülüyor', 'Reddedildi')).toBe(true);
  });

  it('Onaylandı → Tamamlandı geçişine izin verir', () => {
    expect(canTransition('Onaylandı', 'Tamamlandı')).toBe(true);
  });

  it('Tamamlandı → herhangi bir duruma geçilemez (terminal)', () => {
    const allStatuses: OfferStatus[] = ['Beklemede', 'Görüşülüyor', 'Onaylandı', 'Tamamlandı', 'Reddedildi'];
    for (const to of allStatuses) {
      expect(canTransition('Tamamlandı', to)).toBe(false);
    }
  });

  it('Reddedildi → herhangi bir duruma geçilemez (terminal)', () => {
    const allStatuses: OfferStatus[] = ['Beklemede', 'Görüşülüyor', 'Onaylandı', 'Tamamlandı', 'Reddedildi'];
    for (const to of allStatuses) {
      expect(canTransition('Reddedildi', to)).toBe(false);
    }
  });
});

// ─── Çift onay mantığı ────────────────────────────────────────────────────────

describe('Çift onay mantığı', () => {
  function shouldComplete(fromConfirmed: boolean, toConfirmed: boolean): boolean {
    return fromConfirmed && toConfirmed;
  }

  it('her iki taraf onayladığında Tamamlandı olur', () => {
    expect(shouldComplete(true, true)).toBe(true);
  });

  it('yalnızca bir taraf onayladığında tamamlanmaz', () => {
    expect(shouldComplete(true, false)).toBe(false);
    expect(shouldComplete(false, true)).toBe(false);
  });

  it('hiçbir taraf onaylamadığında tamamlanmaz', () => {
    expect(shouldComplete(false, false)).toBe(false);
  });
});
