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
