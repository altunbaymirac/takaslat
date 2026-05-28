/**
 * Geliştirici/Test endpoint'leri
 * - POST /api/dev/seed   → DB'ye örnek ilanlar yükler
 * - POST /api/dev/clear  → kullanıcılar dışındaki her şeyi temizler
 */

import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const SAMPLE_LISTINGS: Array<{
  title: string; category: 'Araç' | 'Elektronik' | 'Gayrimenkul' | 'Diğer';
  value: number; description: string; wantedFor: string; city: string;
  condition: 'Mükemmel' | 'İyi' | 'Orta' | 'Yıpranmış';
  images: string[]; tags: string[];
  // Vehicle:
  brand?: string; model?: string; year?: number; km?: number; fuel?: string;
  transmission?: string; color?: string; hasAccidentRecord?: boolean;
  bodyType?: string; engineCC?: number;
  // Extra:
  extraDetails?: Record<string, unknown>;
}> = [
  // ── ARAÇLAR ────────────────────────────────────────────────────────────────
  {
    title: '2020 Volkswagen Passat 1.6 TDI Highline',
    category: 'Araç', value: 950_000, condition: 'İyi', city: 'İstanbul',
    description: 'Bakımlı, hasarsız Passat. Yetkili servis bakımlı, kaza kaydı yok. Lastikler yeni.',
    wantedFor: 'SUV veya crossover, max 100k fark öderim',
    images: ['https://picsum.photos/seed/passat-vw/800/600', 'https://picsum.photos/seed/passat2/800/600'],
    tags: ['Dizel', 'Otomatik', 'Bakımlı'],
    brand: 'Volkswagen', model: 'Passat 1.6 TDI', year: 2020, km: 85_000,
    fuel: 'Dizel', transmission: 'Otomatik', color: 'Beyaz',
    hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1600,
  },
  {
    title: '2022 Toyota Corolla 1.8 Hybrid Vision',
    category: 'Araç', value: 1_150_000, condition: 'Mükemmel', city: 'Ankara',
    description: 'Sıfır gibi hibrit Corolla. Garanti devam ediyor. Yakıt tüketimi 4.5 L/100km.',
    wantedFor: 'SUV (Tucson, Sportage, Qashqai)',
    images: ['https://picsum.photos/seed/corolla-toyota/800/600'],
    tags: ['Hibrit', 'Otomatik', 'Garantili'],
    brand: 'Toyota', model: 'Corolla 1.8 Hybrid', year: 2022, km: 32_000,
    fuel: 'Hibrit', transmission: 'Otomatik', color: 'Gümüş',
    hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1800,
  },
  {
    title: '2019 BMW 320i M Sport',
    category: 'Araç', value: 1_400_000, condition: 'İyi', city: 'İstanbul',
    description: 'M Sport paket, sunroof, harman kardon. Sportif sürüş zevki için ideal.',
    wantedFor: 'Mercedes C-Class veya Audi A4',
    images: ['https://picsum.photos/seed/bmw320/800/600'],
    tags: ['Benzin', 'Otomatik', 'Premium'],
    brand: 'BMW', model: '320i M Sport', year: 2019, km: 72_000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Siyah',
    hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 2000,
  },
  {
    title: '2021 Dacia Duster 1.3 TCe 4x4',
    category: 'Araç', value: 850_000, condition: 'İyi', city: 'Bursa',
    description: 'Off-road için ideal, 4 çeker. Az kullanılmış, ilk sahibinden.',
    wantedFor: 'Sedan veya hatchback, fark veririm',
    images: ['https://picsum.photos/seed/duster-dacia/800/600'],
    tags: ['Benzin', 'Manuel', '4x4'],
    brand: 'Dacia', model: 'Duster 1.3 TCe', year: 2021, km: 45_000,
    fuel: 'Benzin', transmission: 'Manuel', color: 'Kahverengi',
    hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1300,
  },
  {
    title: '2018 Hyundai Tucson 1.6 CRDi Elite',
    category: 'Araç', value: 920_000, condition: 'İyi', city: 'İzmir',
    description: 'Bakımlı, çift bölgeli klima, panoramik tavan. Aile aracı.',
    wantedFor: 'Sedan veya pikap',
    images: ['https://picsum.photos/seed/tucson-hyundai/800/600'],
    tags: ['Dizel', 'Otomatik', 'SUV'],
    brand: 'Hyundai', model: 'Tucson 1.6 CRDi', year: 2018, km: 105_000,
    fuel: 'Dizel', transmission: 'Otomatik', color: 'Mavi',
    hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1600,
  },
  {
    title: '2023 Tesla Model 3 Long Range',
    category: 'Araç', value: 2_800_000, condition: 'Mükemmel', city: 'İstanbul',
    description: 'Elektrikli, otopilot, premium ses sistemi. 580 km menzil.',
    wantedFor: 'Premium SUV veya Porsche, fark ödenir',
    images: ['https://picsum.photos/seed/tesla-m3/800/600'],
    tags: ['Elektrik', 'Otomatik', 'Otopilot'],
    brand: 'Tesla', model: 'Model 3 Long Range', year: 2023, km: 18_000,
    fuel: 'Elektrik', transmission: 'Otomatik', color: 'Kırmızı',
    hasAccidentRecord: false, bodyType: 'Sedan',
  },
  {
    title: '2016 Renault Megane 1.5 dCi Touch',
    category: 'Araç', value: 580_000, condition: 'Orta', city: 'Konya',
    description: 'Ekonomik kullanım, düşük yakıt tüketimi. Kaporta düzgün.',
    wantedFor: 'Daha yeni model sedan, fark öderim',
    images: ['https://picsum.photos/seed/megane-renault/800/600'],
    tags: ['Dizel', 'Manuel', 'Ekonomik'],
    brand: 'Renault', model: 'Megane 1.5 dCi', year: 2016, km: 165_000,
    fuel: 'Dizel', transmission: 'Manuel', color: 'Gri',
    hasAccidentRecord: true, bodyType: 'Sedan', engineCC: 1500,
  },
  {
    title: '2022 Mercedes C200 AMG Premium',
    category: 'Araç', value: 2_350_000, condition: 'Mükemmel', city: 'İstanbul',
    description: 'AMG paket, deri döşeme, navigasyon. Az kilometre, garantili.',
    wantedFor: 'BMW 3 Serisi veya Audi A4',
    images: ['https://picsum.photos/seed/c200-mercedes/800/600'],
    tags: ['Benzin', 'Otomatik', 'AMG'],
    brand: 'Mercedes', model: 'C200 AMG', year: 2022, km: 28_000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Beyaz',
    hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 2000,
  },

  // ── ELEKTRONİK ─────────────────────────────────────────────────────────────
  {
    title: 'iPhone 14 Pro 256GB Mor',
    category: 'Elektronik', value: 65_000, condition: 'Mükemmel', city: 'İstanbul',
    description: 'Apple Türkiye garantili, kutusunda. Batarya sağlığı %96, tüm aksesuarlar mevcut.',
    wantedFor: 'iPhone 15 Pro Max, fark öderim',
    images: ['https://picsum.photos/seed/iphone14pro/800/600'],
    tags: ['Telefon', 'Garantili'],
    extraDetails: {
      electronicDetails: {
        type: 'Telefon', brand: 'Apple', model: 'iPhone 14 Pro',
        year: 2023, storage: '256 GB', ram: '6 GB', screenSize: 6.1,
        color: 'Mor', os: 'iOS 17', batteryHealth: 96,
        warranty: 'Devam ediyor',
        accessories: ['Orijinal kutu', 'Şarj cihazı', 'Kablo'],
      },
    },
  },
  {
    title: 'MacBook Air M2 13" 512GB',
    category: 'Elektronik', value: 48_000, condition: 'İyi', city: 'Ankara',
    description: 'Hafif, sessiz, güçlü. Tasarım/yazılım işleri için ideal. Mavi renk.',
    wantedFor: 'iPad Pro veya iPhone + fark',
    images: ['https://picsum.photos/seed/macbook-air/800/600'],
    tags: ['Laptop', 'Apple'],
    extraDetails: {
      electronicDetails: {
        type: 'Laptop', brand: 'Apple', model: 'MacBook Air M2',
        year: 2023, storage: '512 GB', ram: '8 GB', screenSize: 13.6,
        color: 'Gece Mavisi', os: 'macOS Sonoma', batteryHealth: 92,
        warranty: 'Bitti',
        accessories: ['Orijinal kutu', 'Şarj cihazı'],
      },
    },
  },
  {
    title: 'PlayStation 5 + 2 Kol + 3 Oyun',
    category: 'Elektronik', value: 28_000, condition: 'Mükemmel', city: 'İzmir',
    description: 'Disk versiyon, ek DualSense kol, FIFA 24 + Spider-Man 2 + Demon\'s Souls.',
    wantedFor: 'Gaming PC veya MacBook',
    images: ['https://picsum.photos/seed/ps5-console/800/600'],
    tags: ['Konsol', 'Oyun'],
    extraDetails: {
      electronicDetails: {
        type: 'Konsol', brand: 'Sony', model: 'PlayStation 5',
        year: 2023, storage: '825 GB', color: 'Beyaz',
        warranty: 'Devam ediyor',
        accessories: ['Orijinal kutu', 'Ek kol', 'HDMI kablo'],
      },
    },
  },
  {
    title: 'Samsung Galaxy S23 Ultra 512GB',
    category: 'Elektronik', value: 42_000, condition: 'İyi', city: 'Bursa',
    description: 'S Pen, 200MP kamera, Snapdragon 8 Gen 2. Faturalı.',
    wantedFor: 'iPhone 14 Pro Max',
    images: ['https://picsum.photos/seed/s23-ultra/800/600'],
    tags: ['Telefon', 'Samsung'],
    extraDetails: {
      electronicDetails: {
        type: 'Telefon', brand: 'Samsung', model: 'Galaxy S23 Ultra',
        year: 2023, storage: '512 GB', ram: '12 GB', screenSize: 6.8,
        color: 'Yeşil', os: 'Android 14', batteryHealth: 89,
        warranty: 'Devam ediyor',
        accessories: ['Orijinal kutu', 'Şarj cihazı', 'Kılıf'],
      },
    },
  },

  // ── GAYRİMENKUL ────────────────────────────────────────────────────────────
  {
    title: '120m² 3+1 Daire — Beşiktaş',
    category: 'Gayrimenkul', value: 8_500_000, condition: 'İyi', city: 'İstanbul',
    description: 'Deniz manzaralı, asansörlü, otoparklı. Metro\'ya 5 dk yürüme mesafesi.',
    wantedFor: 'Villa (Çekmeköy, Beykoz) veya farkla yeni daire',
    images: ['https://picsum.photos/seed/besiktas-daire/800/600'],
    tags: ['3+1', 'Daire', 'Asansörlü'],
    extraDetails: {
      propertyDetails: {
        type: 'Daire', netSqm: 120, grossSqm: 135, rooms: '3+1',
        buildingAge: 8, floor: '5/8', heating: 'Doğalgaz Kombi',
        furnished: false, balcony: true, elevator: true, parking: true,
        titleDeed: 'Kat Mülkiyetli', monthlyDues: 850,
      },
    },
  },
  {
    title: '85m² 2+1 Daire — Çankaya',
    category: 'Gayrimenkul', value: 3_200_000, condition: 'Mükemmel', city: 'Ankara',
    description: 'Sıfır, anahtar teslim. Site içi, sosyal donatılı. Yatırımlık.',
    wantedFor: 'İstanbul\'da daire veya araç + fark',
    images: ['https://picsum.photos/seed/cankaya-daire/800/600'],
    tags: ['2+1', 'Daire', 'Sıfır'],
    extraDetails: {
      propertyDetails: {
        type: 'Daire', netSqm: 85, grossSqm: 100, rooms: '2+1',
        buildingAge: 1, floor: '3/12', heating: 'Yerden Isıtma',
        furnished: false, balcony: true, elevator: true, parking: true,
        titleDeed: 'Kat Mülkiyetli', monthlyDues: 600,
      },
    },
  },
];

// ─── POST /api/dev/seed ───────────────────────────────────────────────────────

router.post('/seed', requireAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    if (users.length === 0) {
      res.status(400).json({ error: 'Önce kullanıcı olmalı' });
      return;
    }

    let created = 0;
    for (let i = 0; i < SAMPLE_LISTINGS.length; i++) {
      const s = SAMPLE_LISTINGS[i];
      const owner = users[i % users.length];     // Kullanıcıları döngüle dağıt

      await prisma.listing.create({
        data: {
          title:          s.title,
          category:       s.category,
          estimatedValue: s.value,
          description:    s.description,
          wantedFor:      s.wantedFor,
          city:           s.city,
          condition:      s.condition,
          images:         JSON.stringify(s.images),
          tags:           JSON.stringify(s.tags),
          brand:             s.brand,
          model:             s.model,
          year:              s.year,
          km:                s.km,
          fuel:              s.fuel,
          transmission:      s.transmission,
          color:             s.color,
          hasAccidentRecord: s.hasAccidentRecord ?? false,
          bodyType:          s.bodyType,
          engineCC:          s.engineCC,
          extraDetails:      s.extraDetails ? JSON.stringify(s.extraDetails) : null,
          ownerId:           owner.id,
        },
      });
      created++;
    }

    const total = await prisma.listing.count();
    res.json({ success: true, created, total });
  } catch (e) {
    console.error('[DEV/SEED]', e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ─── POST /api/dev/clear ──────────────────────────────────────────────────────

router.post('/clear', requireAuth, async (_req, res) => {
  try {
    const msg = await prisma.message.deleteMany();
    const off = await prisma.offer.deleteMany();
    const lst = await prisma.listing.deleteMany();
    res.json({
      success:  true,
      deleted:  { messages: msg.count, offers: off.count, listings: lst.count },
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
