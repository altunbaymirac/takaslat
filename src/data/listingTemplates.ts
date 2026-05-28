/**
 * İlan şablonları — yaygın senaryolar için ön-doldurulmuş veri
 */

import type { Category, FuelType, TransmissionType, Condition } from '../types';

export interface ListingTemplate {
  id:          string;
  name:        string;
  icon:        string;
  description: string;
  category:    Category;

  // Araç
  brand?:        string;
  model?:        string;
  year?:         number;
  fuel?:         FuelType;
  transmission?: TransmissionType;
  bodyType?:     string;
  condition?:    Condition;

  // Elektronik
  elecType?:     string;
  elecBrand?:    string;
  elecModel?:    string;
  storage?:      string;
  ram?:          string;
  warranty?:     string;

  // Property
  propType?:     string;
  rooms?:        string;

  // İçerik
  descriptionTemplate?: string;
  wantedForTemplate?:   string;
}

export const LISTING_TEMPLATES: ListingTemplate[] = [
  // ── ARAÇ ────────────────────────────────────────────────────────────────────
  {
    id: 'sedan-aile',
    name: 'Aile Sedan',
    icon: '🚗',
    description: 'Bakımlı, hasarsız aile aracı',
    category: 'Araç',
    bodyType: 'Sedan',
    fuel: 'Dizel',
    transmission: 'Otomatik',
    condition: 'İyi',
    descriptionTemplate: 'Bakımlı, hasarsız, aile aracı. Yetkili servis bakımlı. Yeni lastik, yeni triger seti. Sigara içilmemiştir.',
    wantedForTemplate: 'SUV veya crossover, yıl ve km dikkate alınır. Fark öderim/alırım.',
  },
  {
    id: 'suv-modern',
    name: 'Modern SUV',
    icon: '🚙',
    description: '4x4 veya FWD crossover',
    category: 'Araç',
    bodyType: 'SUV',
    fuel: 'Dizel',
    transmission: 'Otomatik',
    condition: 'İyi',
    descriptionTemplate: 'Yüksek yol pozisyonu, geniş bagaj. Şehir + uzun yol için ideal. Tüm bakımları zamanında yapıldı.',
    wantedForTemplate: 'Sedan veya başka SUV, fark esnek.',
  },
  {
    id: 'hibrit-ekonomi',
    name: 'Hibrit / Elektrik',
    icon: '⚡',
    description: 'Çevre dostu + düşük yakıt',
    category: 'Araç',
    fuel: 'Hibrit',
    transmission: 'Otomatik',
    condition: 'Mükemmel',
    descriptionTemplate: 'Çevre dostu hibrit teknoloji. Yakıt tüketimi 4-5 L/100km. Sessiz ve konforlu sürüş.',
    wantedForTemplate: 'Benzer hibrit veya elektrikli araç. Premium SUV de değerlendirilir.',
  },
  {
    id: 'klasik-hatchback',
    name: 'Şehir Hatchback',
    icon: '🚕',
    description: 'Şehir içi pratik',
    category: 'Araç',
    bodyType: 'Hatchback',
    fuel: 'Benzin',
    transmission: 'Manuel',
    condition: 'İyi',
    descriptionTemplate: 'Park kolay, yakıt ekonomik, şehir için ideal. Düşük bakım masrafı.',
    wantedForTemplate: 'Daha yeni model hatchback veya sedan, fark öderim.',
  },

  // ── ELEKTRONİK ──────────────────────────────────────────────────────────────
  {
    id: 'iphone-pro',
    name: 'iPhone Pro',
    icon: '📱',
    description: 'Üst segment Apple telefon',
    category: 'Elektronik',
    elecType: 'Telefon',
    elecBrand: 'Apple',
    storage: '256 GB',
    warranty: 'Devam ediyor',
    descriptionTemplate: 'Apple Türkiye garantili. Kutulu, tüm aksesuarlar mevcut. Batarya sağlığı %95+. Çizik yok.',
    wantedForTemplate: 'Yeni model iPhone, MacBook veya iPad + fark.',
  },
  {
    id: 'samsung-flagship',
    name: 'Samsung Flagship',
    icon: '📲',
    description: 'Premium Android telefon',
    category: 'Elektronik',
    elecType: 'Telefon',
    elecBrand: 'Samsung',
    storage: '256 GB',
    warranty: 'Devam ediyor',
    descriptionTemplate: 'Samsung Türkiye garantili. S Pen ve aksesuarları kutusunda. Çok temiz kullanılmıştır.',
    wantedForTemplate: 'iPhone Pro / Pro Max veya yeni model Galaxy + fark.',
  },
  {
    id: 'macbook-pro',
    name: 'MacBook',
    icon: '💻',
    description: 'Profesyonel laptop',
    category: 'Elektronik',
    elecType: 'Laptop',
    elecBrand: 'Apple',
    storage: '512 GB',
    ram: '16 GB',
    warranty: 'Bitti',
    descriptionTemplate: 'Profesyonel iş için ideal. M serisi çip, uzun pil ömrü. Tasarım/yazılım için mükemmel.',
    wantedForTemplate: 'PC veya iMac, başka laptop, fark talep ederim.',
  },
  {
    id: 'gaming-konsol',
    name: 'Oyun Konsolu',
    icon: '🎮',
    description: 'PS5 / Xbox / Nintendo',
    category: 'Elektronik',
    elecType: 'Konsol',
    elecBrand: 'Sony',
    warranty: 'Devam ediyor',
    descriptionTemplate: 'Ek kollar ve birkaç oyunla birlikte. Çok temiz kullanılmıştır. Garantisi devam ediyor.',
    wantedForTemplate: 'Gaming PC, telefon veya tablet + fark.',
  },

  // ── GAYRİMENKUL ─────────────────────────────────────────────────────────────
  {
    id: 'daire-aile',
    name: 'Aile Dairesi',
    icon: '🏠',
    description: '3+1 daire — site içi',
    category: 'Gayrimenkul',
    propType: 'Daire',
    rooms: '3+1',
    descriptionTemplate: 'Aileye uygun, asansörlü, otoparklı site içi daire. Doğalgaz kombi, çift cephe. Metro/AVM yakını.',
    wantedForTemplate: 'Daha büyük daire veya villa, fark talep ederim. Lüks araba da değerlendirilir.',
  },
  {
    id: 'daire-yatirim',
    name: 'Yatırımlık 2+1',
    icon: '🏢',
    description: 'Kira getirisi yüksek',
    category: 'Gayrimenkul',
    propType: 'Daire',
    rooms: '2+1',
    descriptionTemplate: 'Yatırım amaçlı, kiracılı veya boş teslim. Site içi, sosyal donatılı. Kat mülkiyetli.',
    wantedForTemplate: 'Başka bir yatırımlık daire veya araç + fark.',
  },
  {
    id: 'villa-mustakil',
    name: 'Müstakil Villa',
    icon: '🏡',
    description: 'Bahçeli, geniş, lüks',
    category: 'Gayrimenkul',
    propType: 'Villa',
    rooms: '5+1',
    descriptionTemplate: 'Bahçeli, geniş, müstakil tapulu. Yüzme havuzu/sauna mevcut. Şehir merkezine yakın.',
    wantedForTemplate: 'İstanbul merkezde daire + fark veya premium araç koleksiyonu.',
  },
];
