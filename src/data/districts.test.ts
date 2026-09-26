import { describe, expect, it } from 'vitest';
import { CITIES_81 } from './cities';
import { DISTRICTS_BY_CITY, getDistrictsForCity } from './districts';

describe('district data', () => {
  it('covers every Turkish province', () => {
    expect(Object.keys(DISTRICTS_BY_CITY)).toHaveLength(81);
    for (const city of CITIES_81) {
      expect(getDistrictsForCity(city).length, `${city} has no districts`).toBeGreaterThan(0);
    }
  });

  it('contains the complete 2025 district dataset', () => {
    const total = Object.values(DISTRICTS_BY_CITY).reduce((sum, districts) => sum + districts.length, 0);
    expect(total).toBe(973);
  });
});
