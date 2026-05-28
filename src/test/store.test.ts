import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../store/useAppStore';

// Her test öncesi store'u sıfırla
beforeEach(() => {
  useAppStore.setState({
    favorites: [],
    compareList: [],
    darkMode: false,
    offers: [],
  } as unknown as Parameters<typeof useAppStore.setState>[0]);
});

// ─── Favoriler ────────────────────────────────────────────────────────────────

describe('store — favoriler', () => {
  it('toggleFavorite ilan ekler', () => {
    useAppStore.getState().toggleFavorite('listing-1');
    expect(useAppStore.getState().favorites).toContain('listing-1');
  });

  it('toggleFavorite tekrar çağırınca ilan kaldırılır', () => {
    useAppStore.getState().toggleFavorite('listing-1');
    useAppStore.getState().toggleFavorite('listing-1');
    expect(useAppStore.getState().favorites).not.toContain('listing-1');
  });

  it('isFavorite doğru değer döndürür', () => {
    useAppStore.getState().toggleFavorite('listing-2');
    expect(useAppStore.getState().isFavorite('listing-2')).toBe(true);
    expect(useAppStore.getState().isFavorite('listing-99')).toBe(false);
  });
});

// ─── Karşılaştırma ────────────────────────────────────────────────────────────

describe('store — karşılaştırma', () => {
  it('toggleCompare ilan ekler', () => {
    useAppStore.getState().toggleCompare('listing-A');
    expect(useAppStore.getState().compareList).toContain('listing-A');
  });

  it('clearCompare listeyi temizler', () => {
    useAppStore.getState().toggleCompare('listing-A');
    useAppStore.getState().toggleCompare('listing-B');
    useAppStore.getState().clearCompare();
    expect(useAppStore.getState().compareList).toHaveLength(0);
  });

  it('3 üzeri ilan eklenemez', () => {
    useAppStore.getState().toggleCompare('A');
    useAppStore.getState().toggleCompare('B');
    useAppStore.getState().toggleCompare('C');
    useAppStore.getState().toggleCompare('D');
    expect(useAppStore.getState().compareList.length).toBeLessThanOrEqual(3);
  });
});

// ─── Dark mode ────────────────────────────────────────────────────────────────

describe('store — dark mode', () => {
  it('toggleDarkMode açıp kapar', () => {
    expect(useAppStore.getState().darkMode).toBe(false);
    useAppStore.getState().toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(true);
    useAppStore.getState().toggleDarkMode();
    expect(useAppStore.getState().darkMode).toBe(false);
  });

  it('setDarkMode direkt değer atar', () => {
    useAppStore.getState().setDarkMode(true);
    expect(useAppStore.getState().darkMode).toBe(true);
  });
});
