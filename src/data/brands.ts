/**
 * Marka listeleri — alfabetik sıralı, popüler markalar önce
 */

export const VEHICLE_BRANDS = [
  // Popüler (Türkiye'de en yaygın)
  'Volkswagen', 'Toyota', 'Renault', 'Ford', 'Fiat', 'Hyundai', 'Opel', 'Mercedes', 'BMW', 'Audi',
  // Diğerleri (alfabetik)
  'Alfa Romeo', 'Aston Martin', 'Bentley', 'Cadillac', 'Chevrolet', 'Chrysler', 'Citroen',
  'Cupra', 'Dacia', 'DFM', 'Dodge', 'DS', 'Ferrari', 'Geely', 'Genesis', 'GMC',
  'Honda', 'Infiniti', 'Isuzu', 'Iveco', 'Jaguar', 'Jeep', 'Kia', 'Lada', 'Lamborghini',
  'Lancia', 'Land Rover', 'Lexus', 'Lotus', 'Mahindra', 'Maserati', 'Maybach', 'Mazda',
  'McLaren', 'MG', 'Mini', 'Mitsubishi', 'Moto Guzzi', 'Nissan', 'Peugeot', 'Polestar',
  'Porsche', 'Proton', 'Rolls-Royce', 'Saab', 'Seat', 'Skoda', 'Smart', 'SsangYong',
  'Subaru', 'Suzuki', 'Tata', 'Tesla', 'TOFAŞ', 'Togg', 'Volvo', 'Yugo',
];

export const CAR_BRANDS = [
  // Popüler
  'Volkswagen', 'Toyota', 'Renault', 'Ford', 'Fiat', 'Hyundai', 'Opel', 'Mercedes', 'BMW', 'Audi',
  // Alfabetik
  'Alfa Romeo', 'Aston Martin', 'Bentley', 'Cadillac', 'Chevrolet', 'Chrysler', 'Citroen',
  'Cupra', 'Dacia', 'DFM', 'Dodge', 'DS', 'Ferrari', 'Geely', 'Genesis', 'GMC',
  'Honda', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lada', 'Lamborghini', 'Lancia',
  'Land Rover', 'Lexus', 'Lotus', 'Mahindra', 'Maserati', 'Maybach', 'Mazda', 'McLaren',
  'MG', 'Mini', 'Mitsubishi', 'Nissan', 'Peugeot', 'Polestar', 'Porsche', 'Proton',
  'Rolls-Royce', 'Saab', 'Seat', 'Skoda', 'Smart', 'SsangYong', 'Subaru', 'Suzuki',
  'Tata', 'Tesla', 'TOFAŞ', 'Togg', 'Volvo', 'Yugo',
];

export const MOTORCYCLE_BRANDS = [
  // Popüler
  'Honda', 'Yamaha', 'Kawasaki', 'Suzuki', 'KTM',
  // Alfabetik
  'Aprilia', 'Bajaj', 'BMW Motorrad', 'CF Moto', 'Ducati', 'Harley-Davidson', 'Hero',
  'Husqvarna', 'Indian', 'Keeway', 'Kymco', 'Moto Guzzi', 'MV Agusta', 'Piaggio',
  'Royal Enfield', 'Sym', 'Triumph', 'TVS', 'Vespa', 'Zero Motorcycles',
];

export const COMMERCIAL_BRANDS = [
  // Popüler
  'Ford', 'Mercedes', 'Volkswagen', 'Renault', 'Fiat', 'Peugeot', 'Citroen', 'Opel',
  // Ağır taşıt
  'DAF', 'Hyundai', 'Isuzu', 'Iveco', 'MAN', 'Mitsubishi', 'Nissan', 'Renault Trucks',
  'Scania', 'Toyota', 'Volvo', 'TOFAŞ',
];

export const CARAVAN_BRANDS = [
  // Popüler
  'Dethleffs', 'Hobby', 'Hymer', 'Knaus', 'LMC', 'Bürstner',
  // Diğer
  'Adria', 'Azur', 'Carado', 'Chausson', 'Erwin Hymer', 'Fendt', 'Fiat', 'Ford',
  'Globecar', 'Laika', 'McLouis', 'Pilote', 'Rapido', 'Rimor', 'Sunlight', 'Swift',
  'Trigano', 'Weinsberg',
];

export const BICYCLE_BRANDS = [
  // Popüler
  'Trek', 'Specialized', 'Giant', 'Cannondale', 'Scott', 'Bianchi',
  // Diğer
  'BH', 'Canyon', 'Cervélo', 'Colnago', 'Cube', 'Decathlon', 'Felt', 'Focus',
  'Ghost', 'GT', 'Kona', 'Lapierre', 'Merida', 'Orbea', 'Pinarello', 'Polygon',
  'Raleigh', 'Santa Cruz', 'Shimano', 'Trek', 'Yeti',
];

export const ELECTRONIC_BRANDS = [
  // Popüler
  'Apple', 'Samsung', 'Sony', 'Xiaomi', 'LG', 'Huawei', 'Lenovo', 'Asus', 'HP', 'Dell',
  // Diğerleri (alfabetik)
  'Acer', 'AOC', 'Anker', 'Arçelik', 'Beko', 'Belkin', 'BenQ', 'Beats', 'Bosch',
  'Bose', 'Canon', 'Casper', 'Casio', 'Corsair', 'DJI', 'Edifier', 'Epson', 'Fitbit',
  'Fujitsu', 'Garmin', 'General Mobile', 'GoPro', 'Google', 'Hisense', 'HTC', 'Honor',
  'HyperX', 'Intel', 'JBL', 'Kingston', 'Logitech', 'Marshall', 'Microsoft', 'MSI',
  'Motorola', 'Nikon', 'Nintendo', 'Nokia', 'NZXT', 'Olympus', 'OnePlus', 'Oppo',
  'Panasonic', 'Philips', 'Pioneer', 'Polaroid', 'Razer', 'Realme', 'Roborock', 'Samsung',
  'SanDisk', 'SteelSeries', 'TCL', 'TP-Link', 'Vestel', 'Vivo', 'Wacom', 'Western Digital',
  'Xerox', 'Yamaha', 'ZTE',
];

export type CategoryWithBrands = 'Araç' | 'Elektronik';

export function getBrands(category: CategoryWithBrands): string[] {
  return category === 'Araç' ? VEHICLE_BRANDS : ELECTRONIC_BRANDS;
}

export function getBrandsForVehicleGroup(group: string): string[] {
  switch (group) {
    case 'Otomobil':  return CAR_BRANDS;
    case 'Motosiklet':return MOTORCYCLE_BRANDS;
    case 'Ticari':    return COMMERCIAL_BRANDS;
    case 'Karavan':   return CARAVAN_BRANDS;
    case 'Bisiklet':  return BICYCLE_BRANDS;
    default:          return VEHICLE_BRANDS;
  }
}
