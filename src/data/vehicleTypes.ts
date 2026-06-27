export const VEHICLE_GROUPS: Record<string, string[]> = {
  'Otomobil': ['Sedan', 'Hatchback', 'SUV', 'Station Wagon', 'Coupe', 'Cabrio', 'MPV'],
  'Motosiklet': ['Motosiklet', 'Scooter', 'Elektrikli Scooter'],
  'Ticari': ['Kamyonet', 'Pickup', 'Van/Panelvan', 'Minibüs', 'Kamyon', 'TIR'],
  'Karavan': ['Karavan', 'ATV/Quad'],
  'Bisiklet': ['Bisiklet', 'E-Bisiklet'],
};

export const VEHICLE_GROUP_ICONS: Record<string, string> = {
  'Otomobil':  '🚗',
  'Motosiklet':'🏍️',
  'Ticari':    '🚚',
  'Karavan':   '🚐',
  'Bisiklet':  '🚲',
};

export const ALL_BODY_TYPES: string[] = [
  // Otomobil
  'Sedan', 'Hatchback', 'SUV', 'Station Wagon', 'Coupe', 'Cabrio', 'MPV',
  // Motosiklet
  'Motosiklet', 'Scooter', 'Elektrikli Scooter',
  // Ticari
  'Kamyonet', 'Pickup', 'Van/Panelvan', 'Minibüs', 'Kamyon', 'TIR',
  // Karavan & off-road
  'Karavan', 'ATV/Quad',
  // Bisiklet
  'Bisiklet', 'E-Bisiklet',
  // Diğer
  'Tarım Makinesi', 'İş Makinesi', 'Diğer',
];
