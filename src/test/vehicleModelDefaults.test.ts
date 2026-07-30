import { describe, expect, it } from 'vitest';
import { getVehicleModelDefaults } from '../data/vehicleModelDefaults';

describe('vehicle model defaults', () => {
  it('fills the common characteristics of an electric SUV', () => {
    expect(getVehicleModelDefaults('Otomobil', 'Tesla', 'Model Y')).toMatchObject({
      bodyType: 'SUV',
      fuel: 'Elektrik',
      transmission: 'Otomatik',
      driveType: 'RWD',
      numberOfDoors: 5,
    });
  });

  it('uses the selected trim to detect a plug-in hybrid', () => {
    expect(getVehicleModelDefaults('Otomobil', 'BYD', 'Seal U', 'DM-i')).toMatchObject({
      bodyType: 'SUV',
      fuel: 'Hibrit',
      transmission: 'Otomatik',
      numberOfDoors: 5,
    });
  });

  it('fills curated characteristics for a common sedan', () => {
    expect(getVehicleModelDefaults('Otomobil', 'Toyota', 'Corolla')).toMatchObject({
      bodyType: 'Sedan',
      fuel: 'Benzin',
      transmission: 'Otomatik',
      driveType: 'FWD',
      numberOfDoors: 4,
    });
  });
});
