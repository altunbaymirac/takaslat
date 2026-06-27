/**
 * Marka → Model listeleri (Türkiye pazarı, popüler modeller).
 * Listede olmayan marka için CreateListing elle yazmaya (free text) düşer.
 */

export const VEHICLE_MODELS: Record<string, string[]> = {
  'Volkswagen': ['Golf', 'Passat', 'Polo', 'Tiguan', 'Jetta', 'T-Roc', 'T-Cross', 'Caddy', 'Transporter', 'Arteon', 'Touareg', 'Up', 'Scirocco', 'Amarok', 'Bora'],
  'Toyota': ['Corolla', 'Yaris', 'C-HR', 'RAV4', 'Auris', 'Avensis', 'Camry', 'Hilux', 'Land Cruiser', 'Proace City', 'Aygo'],
  'Renault': ['Clio', 'Megane', 'Symbol', 'Captur', 'Kadjar', 'Talisman', 'Fluence', 'Kangoo', 'Latitude', 'Koleos', 'Taliant', 'Austral', 'Laguna'],
  'Ford': ['Focus', 'Fiesta', 'Kuga', 'Puma', 'Mondeo', 'Transit', 'Transit Custom', 'Courier', 'Ranger', 'EcoSport', 'Tourneo', 'C-Max', 'Connect'],
  'Fiat': ['Egea', 'Egea Cross', 'Linea', 'Punto', '500', 'Doblo', 'Fiorino', 'Panda', 'Tipo', '500L', '500X', 'Ducato', 'Albea'],
  'Hyundai': ['i20', 'i10', 'i30', 'Tucson', 'Accent Blue', 'Elantra', 'Kona', 'Bayon', 'Santa Fe', 'ix35', 'Getz', 'Accent'],
  'Opel': ['Astra', 'Corsa', 'Insignia', 'Mokka', 'Crossland', 'Grandland', 'Vectra', 'Zafira', 'Combo', 'Meriva', 'Vivaro'],
  'Mercedes': ['A-Serisi', 'B-Serisi', 'C-Serisi', 'E-Serisi', 'S-Serisi', 'CLA', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'CLS', 'Vito', 'Sprinter'],
  'BMW': ['1 Serisi', '2 Serisi', '3 Serisi', '4 Serisi', '5 Serisi', '6 Serisi', '7 Serisi', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'i3', 'i4'],
  'Audi': ['A1', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8', 'TT', 'e-tron'],
  'Peugeot': ['208', '301', '308', '2008', '3008', '5008', '508', 'Partner', 'Rifter', 'Expert', '206', '207', '301'],
  'Citroen': ['C3', 'C4', 'C5', 'C-Elysee', 'Berlingo', 'C3 Aircross', 'C5 Aircross', 'Jumpy', 'Nemo'],
  'Honda': ['Civic', 'City', 'CR-V', 'Jazz', 'Accord', 'HR-V', 'CR-Z'],
  'Nissan': ['Qashqai', 'Juke', 'X-Trail', 'Micra', 'Note', 'Navara', 'Primera', 'Pulsar'],
  'Dacia': ['Duster', 'Sandero', 'Logan', 'Lodgy', 'Dokker', 'Jogger', 'Spring'],
  'Skoda': ['Octavia', 'Superb', 'Fabia', 'Rapid', 'Kodiaq', 'Karoq', 'Scala', 'Kamiq', 'Yeti'],
  'Seat': ['Leon', 'Ibiza', 'Arona', 'Ateca', 'Toledo', 'Cordoba', 'Tarraco'],
  'Kia': ['Sportage', 'Ceed', 'Rio', 'Picanto', 'Stonic', 'Sorento', 'Cerato', 'Niro', 'Soul'],
  'Volvo': ['XC40', 'XC60', 'XC90', 'S60', 'S90', 'V40', 'V60', 'V90'],
  'Mazda': ['2', '3', '6', 'CX-3', 'CX-5', 'CX-30', 'MX-5'],
  'Suzuki': ['Swift', 'Vitara', 'SX4', 'S-Cross', 'Jimny', 'Baleno', 'Grand Vitara'],
  'Mitsubishi': ['Lancer', 'ASX', 'Outlander', 'L200', 'Eclipse Cross', 'Space Star', 'Colt'],
  'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X'],
  'Togg': ['T10X', 'T10F'],
  'Cupra': ['Formentor', 'Leon', 'Ateca', 'Born'],
  'Jeep': ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Wrangler'],
  'Land Rover': ['Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Discovery', 'Defender', 'Freelander'],
  'Mini': ['Cooper', 'Countryman', 'Clubman', 'One'],
  'MG': ['ZS', 'HS', 'MG4', 'MG5', '3'],
  'Alfa Romeo': ['Giulietta', 'Giulia', 'Stelvio', 'Mito', '147', '159'],
  'Chevrolet': ['Cruze', 'Aveo', 'Captiva', 'Spark', 'Lacetti', 'Trax'],
  'Lada': ['Niva', 'Vesta', 'Granta', 'Kalina'],
  'Subaru': ['Forester', 'XV', 'Impreza', 'Outback', 'Legacy'],
  'Lexus': ['IS', 'ES', 'NX', 'RX', 'UX', 'CT'],
  'Porsche': ['Cayenne', 'Macan', 'Panamera', '911', 'Taycan', 'Boxster'],
};

/** Genel araç renkleri (CreateListing dropdown'u için). */
export const VEHICLE_COLORS = [
  'Beyaz', 'Siyah', 'Gri', 'Gümüş', 'Kırmızı', 'Mavi', 'Lacivert',
  'Yeşil', 'Kahverengi', 'Bej', 'Turuncu', 'Sarı', 'Bordo', 'Mor', 'Diğer',
];

export function getModelsForBrand(brand: string): string[] {
  return VEHICLE_MODELS[brand] ?? [];
}
