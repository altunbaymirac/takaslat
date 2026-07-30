import type { FuelType, TransmissionType } from '../types';

export interface VehicleModelDefaults {
  bodyType?: string;
  fuel?: FuelType;
  transmission?: TransmissionType;
  driveType?: 'FWD' | 'RWD' | 'AWD' | '4WD';
  numberOfDoors?: number;
}

const SUV_MODELS = new Set([
  'Tiguan', 'T-Roc', 'Touareg', 'Yaris Cross', 'C-HR', 'RAV4', 'Land Cruiser',
  'Arkana', 'Captur', 'Koleos', 'Austral', 'Puma', 'Kuga', 'EcoSport', '500X',
  'Tucson', 'Santa Fe', 'Kona', 'Mokka', 'Crossland', 'Grandland', 'GLA', 'GLB',
  'GLC', 'GLE', 'GLS', 'EQA', 'EQB', 'EQC', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6',
  'X7', 'iX', 'Q2', 'Q3', 'Q4 e-tron', 'Q5', 'Q7', 'Q8', 'Duster', 'Jogger',
  'C3 Aircross', '2008', '3008', '5008', 'Arona', 'Ateca', 'Formentor', 'Kamiq',
  'Karoq', 'Kodiaq', 'Enyaq', 'Stonic', 'Sportage', 'Sorento', 'Niro', 'Juke',
  'Qashqai', 'X-Trail', 'HR-V', 'CR-V', 'CX-30', 'CX-5', 'S-Cross', 'Vitara',
  'Forester', 'Outback', 'Range Rover', 'Defender', 'Discovery', 'Renegade',
  'Compass', 'Cherokee', 'XC40', 'XC60', 'XC90', 'C40', 'EX30', 'Stelvio',
  'Tonale', 'Model Y', 'Model X', 'T10X', 'T2X', 'MG ZS', 'MG HS', 'Atto 3',
  'Seal U', 'Tang', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro', 'Omoda 5',
  'Tivoli', 'Korando', 'Torres', 'Rexton', 'Countryman', 'Aceman', 'DS 3',
  'DS 7', 'Captiva', 'Eclipse Cross', 'Outlander', 'ASX', 'Cayenne', 'Macan',
  'NX', 'UX', 'RX', 'LX',
]);

const HATCHBACK_MODELS = new Set([
  'Golf', 'Polo', 'Yaris', 'Aygo X', 'Clio', 'Megane', 'Fiesta', 'Focus', '500',
  'i10', 'i20', 'Corsa', 'Astra', 'A Serisi', '1 Serisi', 'A1', 'A3', 'Sandero',
  'Spring', 'C3', 'C4', '208', '308', 'Ibiza', 'Leon', 'Fabia', 'Picanto', 'Ceed',
  'Micra', 'Jazz', 'Mazda 2', 'Mazda 3', 'Swift', 'Impreza', 'V40', 'Giulietta',
  'MG3', 'MG4', 'Dolphin', 'Cooper', 'Clubman',
]);

const SEDAN_MODELS = new Set([
  'Corolla', 'Camry', 'Taliant', 'Symbol', 'Egea', 'Tipo', 'Elantra', 'A4', 'A6',
  'A8', '3 Serisi', '5 Serisi', '7 Serisi', 'C Serisi', 'E Serisi', 'S Serisi',
  'CLA', 'Logan', 'Octavia', 'Superb', 'Civic', 'Accord', 'City', 'Mazda 6',
  'S60', 'S90', 'Giulia', 'Model 3', 'Model S', 'T10F', 'MG5', 'Seal', 'Han',
  'Arrizo 8', 'DS 9', 'Aveo', 'Cruze', 'Panamera', 'Taycan', 'IS', 'ES',
]);

const COUPE_MODELS = new Set([
  'Mustang', '4 Serisi', 'Z4', 'A5', 'A7', 'e-tron GT', 'TT', 'CLA', 'Camaro',
  'Corvette', '911', 'Boxster', 'Cayman', 'LC', 'Roma', 'Huracan',
]);

const MODEL_DEFAULTS: Record<string, VehicleModelDefaults> = {
  'Toyota:Corolla': { bodyType: 'Sedan', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 4 },
  'Renault:Clio': { bodyType: 'Hatchback', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Fiat:Egea': { bodyType: 'Sedan', fuel: 'Dizel', transmission: 'Manuel', driveType: 'FWD', numberOfDoors: 4 },
  'Honda:Civic': { bodyType: 'Sedan', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 4 },
  'Volkswagen:Golf': { bodyType: 'Hatchback', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Volkswagen:Passat': { bodyType: 'Sedan', fuel: 'Dizel', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 4 },
  'Hyundai:i20': { bodyType: 'Hatchback', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Ford:Focus': { bodyType: 'Hatchback', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Nissan:Qashqai': { bodyType: 'SUV', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Dacia:Duster': { bodyType: 'SUV', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'Tesla:Model 3': { bodyType: 'Sedan', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'RWD', numberOfDoors: 4 },
  'Tesla:Model Y': { bodyType: 'SUV', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'RWD', numberOfDoors: 5 },
  'Togg:T10X': { bodyType: 'SUV', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'RWD', numberOfDoors: 5 },
  'Togg:T10F': { bodyType: 'Sedan', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'RWD', numberOfDoors: 4 },
  'BYD:Atto 3': { bodyType: 'SUV', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'BYD:Dolphin': { bodyType: 'Hatchback', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'BYD:Seal': { bodyType: 'Sedan', fuel: 'Elektrik', transmission: 'Otomatik', driveType: 'RWD', numberOfDoors: 4 },
  'Chery:Omoda 5': { bodyType: 'SUV', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
  'KGM:Torres': { bodyType: 'SUV', fuel: 'Benzin', transmission: 'Otomatik', driveType: 'FWD', numberOfDoors: 5 },
};

function inferredBodyType(group: string, model: string): string | undefined {
  if (group !== 'Otomobil') {
    const defaults: Record<string, string> = {
      Motosiklet: 'Motosiklet',
      Ticari: 'Van/Panelvan',
      Karavan: 'Karavan',
      Bisiklet: 'Bisiklet',
    };
    return defaults[group];
  }
  if (SUV_MODELS.has(model)) return 'SUV';
  if (HATCHBACK_MODELS.has(model)) return 'Hatchback';
  if (SEDAN_MODELS.has(model)) return 'Sedan';
  if (COUPE_MODELS.has(model)) return 'Coupe';
  if (/variant|touring|avant|estate|sw/i.test(model)) return 'Station Wagon';
  return undefined;
}

export function getVehicleModelDefaults(
  group: string,
  brand: string,
  model: string,
  trim = '',
): VehicleModelDefaults | null {
  if (!model || model === 'Diğer') return null;

  const text = `${brand} ${model} ${trim}`.toLowerCase();
  const base = MODEL_DEFAULTS[`${brand}:${model}`] ?? {};
  const bodyType = base.bodyType ?? inferredBodyType(group, model);
  const isPlugInHybrid = /plug-in|plug in|phev|dm-i|e-hybrid|e-tech full hybrid/.test(text);
  const isElectric = /electric|elektrik|e-tron|e-c4|e-208|e-2008|e-3008|eq[abceqs]|ioniq|model [3ysx]|t10[xf]|atto 3|dolphin|mg4|evx/.test(text);
  const isHybrid = isPlugInHybrid || /hybrid|hibrit|e-tech/.test(text);
  const fuel: FuelType | undefined = isHybrid ? 'Hibrit' : isElectric ? 'Elektrik' : base.fuel;
  const transmission: TransmissionType | undefined =
    fuel === 'Elektrik' || fuel === 'Hibrit' || /dsg|cvt|automatic|otomatik|at\b/.test(text)
      ? 'Otomatik'
      : /\bmt\b|manuel/.test(text)
      ? 'Manuel'
      : base.transmission;
  const driveType = /awd|xdrive|quattro|4matic|all4/.test(text)
    ? 'AWD'
    : /4wd/.test(text)
    ? '4WD'
    : base.driveType;

  return {
    ...base,
    bodyType,
    fuel,
    transmission,
    driveType,
    numberOfDoors: base.numberOfDoors ?? (bodyType === 'Sedan' ? 4 : bodyType === 'Coupe' || bodyType === 'Cabrio' ? 2 : 5),
  };
}

export function describeVehicleModelDefaults(defaults: VehicleModelDefaults): string {
  return [
    defaults.bodyType,
    defaults.fuel,
    defaults.transmission,
    defaults.driveType,
    defaults.numberOfDoors ? `${defaults.numberOfDoors} kapı` : undefined,
  ].filter(Boolean).join(' · ');
}
