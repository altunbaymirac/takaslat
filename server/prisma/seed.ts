import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Demo users ───────────────────────────────────────────────────────────────

const USERS = [
  { name: 'Demo Kullanıcı', email: 'demo@takaslat.com', password: 'demo1234', city: 'İstanbul' },
  { name: 'Murat Yılmaz',   email: 'murat@test.com',   password: 'test1234', city: 'İstanbul' },
  { name: 'Ayşe Kaya',      email: 'ayse@test.com',    password: 'test1234', city: 'Ankara'   },
  { name: 'Emre Demir',     email: 'emre@test.com',    password: 'test1234', city: 'İzmir'    },
  { name: 'Selin Arslan',   email: 'selin@test.com',   password: 'test1234', city: 'İstanbul' },
  { name: 'Kemal Çelik',    email: 'kemal@test.com',   password: 'test1234', city: 'Bursa'    },
];

// ─── Listings ─────────────────────────────────────────────────────────────────

const LISTINGS = [
  {
    title: '2019 BMW 320i xDrive M Sport', category: 'Araç', estimatedValue: 1150000,
    description: 'Bakımı eksiksiz, hasar kayıtsız BMW 320i. M Sport paketi, sunroof, ısıtmalı koltuk, adaptif cruise control. Yetkili serviste bakımlı.',
    wantedFor: 'SUV veya crossover, max 150k TL fark. Duster, Tiguan, Jogger olabilir.',
    city: 'İstanbul', condition: 'Mükemmel', tags: ['M Sport','Sunroof','Hasar Kayıtsız'],
    images: ['https://picsum.photos/seed/bmw320-1/800/600','https://picsum.photos/seed/bmw320-2/800/600'],
    brand: 'BMW', model: '320i xDrive M Sport', year: 2019, km: 68000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Mineral Gri', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1998,
    ownerIdx: 1,
  },
  {
    title: '2021 Toyota Corolla 1.8 Hybrid', category: 'Araç', estimatedValue: 920000,
    description: 'Hibrit teknoloji, düşük yakıt tüketimi. Hasar kayıtsız, bakımlı. Toyota güvencesi.',
    wantedFor: 'Sedan veya hafif SUV, 50k TL fark kabul ederim. Honda Civic, Megane olabilir.',
    city: 'Ankara', condition: 'Mükemmel', tags: ['Hibrit','Düşük Yakıt','Hasar Kayıtsız'],
    images: ['https://picsum.photos/seed/corolla-1/800/600','https://picsum.photos/seed/corolla-2/800/600'],
    brand: 'Toyota', model: 'Corolla 1.8 Hybrid', year: 2021, km: 42000,
    fuel: 'Hibrit', transmission: 'Otomatik', color: 'İnci Beyazı', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1798,
    ownerIdx: 2,
  },
  {
    title: '2020 Honda Civic 1.5 VTEC Turbo Executive', category: 'Araç', estimatedValue: 850000,
    description: 'Executive paket, panoramik sunroof, Honda Sensing. Yetkili serviste bakımlı, temiz araç.',
    wantedFor: 'Crossover veya SUV. Duster, Sandero Stepway, Mokka bakarım.',
    city: 'İzmir', condition: 'İyi', tags: ['Executive','Sunroof','Honda Sensing'],
    images: ['https://picsum.photos/seed/civic-1/800/600','https://picsum.photos/seed/civic-2/800/600'],
    brand: 'Honda', model: 'Civic 1.5 VTEC Turbo', year: 2020, km: 75000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Kristal Siyah', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1498,
    ownerIdx: 3,
  },
  {
    title: '2018 Mercedes-Benz C180 AMG', category: 'Araç', estimatedValue: 1080000,
    description: 'AMG paketi, Burmester ses, panoramik cam tavan, 360° kamera. Türkiye\'de satılmış.',
    wantedFor: 'BMW 3/5 serisi veya Audi A4/A6 ile takas. Fark konuşabiliriz.',
    city: 'İstanbul', condition: 'İyi', tags: ['AMG Paket','Burmester','Panoramik'],
    images: ['https://picsum.photos/seed/mercc180-1/800/600','https://picsum.photos/seed/mercc180-2/800/600'],
    brand: 'Mercedes-Benz', model: 'C180 AMG', year: 2018, km: 92000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Obsidian Siyah', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1595,
    ownerIdx: 4,
  },
  {
    title: '2022 Renault Megane E-Tech Plug-in Hybrid', category: 'Araç', estimatedValue: 780000,
    description: 'Plug-in hibrit, şehir içinde tamamen elektrikli. OpenR Link, wireless CarPlay.',
    wantedFor: 'Toyota Corolla, Hyundai Elantra veya benzeri sedan. 100k\'ya kadar fark öderim.',
    city: 'Bursa', condition: 'Mükemmel', tags: ['Plug-in Hibrit','Düşük Emisyon','Wireless CarPlay'],
    images: ['https://picsum.photos/seed/megane-1/800/600','https://picsum.photos/seed/megane-2/800/600'],
    brand: 'Renault', model: 'Megane E-Tech', year: 2022, km: 31000,
    fuel: 'Hibrit', transmission: 'Otomatik', color: 'Teton Mavi', hasAccidentRecord: false, bodyType: 'Hatchback', engineCC: 1598,
    ownerIdx: 5,
  },
  {
    title: '2017 Volkswagen Passat 1.6 TDI Comfortline', category: 'Araç', estimatedValue: 650000,
    description: 'Dizel ekonomisi, geniş bagaj. Aile aracı, periyodik bakımlar yapıldı.',
    wantedFor: 'SUV veya pikap. Duster, Hilux, L200 değerlendiririm. Fark öderim.',
    city: 'Ankara', condition: 'İyi', tags: ['Dizel','DSG','Geniş Bagaj'],
    images: ['https://picsum.photos/seed/passat-1/800/600','https://picsum.photos/seed/passat-2/800/600'],
    brand: 'Volkswagen', model: 'Passat 1.6 TDI', year: 2017, km: 125000,
    fuel: 'Dizel', transmission: 'Otomatik', color: 'Derin Siyah', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1598,
    ownerIdx: 1,
  },
  {
    title: '2020 Ford Focus 1.5 EcoBoost ST-Line', category: 'Araç', estimatedValue: 720000,
    description: 'ST-Line paketi, B&O ses, SYNC 3 multimedya. Kazasız, bakımlı.',
    wantedFor: 'Büyük bir araç lazım. Peugeot 3008, Nissan Qashqai veya benzer crossover.',
    city: 'İzmir', condition: 'İyi', tags: ['ST-Line','B&O Ses','Spor Görünüm'],
    images: ['https://picsum.photos/seed/focus-1/800/600','https://picsum.photos/seed/focus-2/800/600'],
    brand: 'Ford', model: 'Focus 1.5 EcoBoost', year: 2020, km: 58000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Frozen White', hasAccidentRecord: false, bodyType: 'Hatchback', engineCC: 1498,
    ownerIdx: 2,
  },
  {
    title: '2023 Hyundai i20 1.0 T-GDI Elite', category: 'Araç', estimatedValue: 580000,
    description: 'Az kullanılmış, sıfır gibi. Elite donanım, geri görüş kamerası, şerit takip.',
    wantedFor: 'Daha büyük sedan veya crossover. Corolla, Clio veya Duster.',
    city: 'Kayseri', condition: 'Mükemmel', tags: ['Az Kullanılmış','Elite','Şerit Takip'],
    images: ['https://picsum.photos/seed/i20-1/800/600','https://picsum.photos/seed/i20-2/800/600'],
    brand: 'Hyundai', model: 'i20 1.0 T-GDI Elite', year: 2023, km: 18000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Polar White', hasAccidentRecord: false, bodyType: 'Hatchback', engineCC: 998,
    ownerIdx: 3,
  },
  {
    title: '2021 Dacia Duster 1.3 TCe 4x4 Prestige', category: 'Araç', estimatedValue: 680000,
    description: '4x4 kabiliyeti, yüksek zemin klirensı. Prestige donanım, geri görüş kamerası.',
    wantedFor: 'Sedan veya hatchback. Passat, Focus, Megane. Fark alırım.',
    city: 'Antalya', condition: 'İyi', tags: ['4x4','Prestige','SUV'],
    images: ['https://picsum.photos/seed/duster-1/800/600','https://picsum.photos/seed/duster-2/800/600'],
    brand: 'Dacia', model: 'Duster 1.3 TCe 4x4', year: 2021, km: 55000,
    fuel: 'Benzin', transmission: 'Manuel', color: 'Kazbek Gri', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1332,
    ownerIdx: 4,
  },
  {
    title: '2022 Mitsubishi Eclipse Cross 1.5 Intense', category: 'Araç', estimatedValue: 890000,
    description: 'Crossover SUV, Intense donanım, S-AWC akıllı 4WD, LED farlar. Garajda, az kullanım.',
    wantedFor: 'Japon kökenli sedan. Togg T10X, Corolla veya Civic.',
    city: 'İstanbul', condition: 'Mükemmel', tags: ['Crossover','S-AWC','Android Auto'],
    images: ['https://picsum.photos/seed/eclipse-1/800/600','https://picsum.photos/seed/eclipse-2/800/600'],
    brand: 'Mitsubishi', model: 'Eclipse Cross 1.5', year: 2022, km: 40000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Titan Gri', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1499,
    ownerIdx: 5,
  },
  {
    title: '2016 BMW 520d M Sport', category: 'Araç', estimatedValue: 1050000,
    description: 'M Sport paket, dizel ekonomisi. Head-up display, Harman Kardon, masajlı koltuklar.',
    wantedFor: 'Range Rover Evoque veya Volvo XC60 tercihim.',
    city: 'İstanbul', condition: 'İyi', tags: ['M Sport','Dizel','Head-Up Display'],
    images: ['https://picsum.photos/seed/bmw520-1/800/600','https://picsum.photos/seed/bmw520-2/800/600'],
    brand: 'BMW', model: '520d M Sport', year: 2016, km: 148000,
    fuel: 'Dizel', transmission: 'Otomatik', color: 'Alpin Beyaz', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1995,
    ownerIdx: 1,
  },
  {
    title: '2019 Hyundai Tucson 1.6 CRDi Prestige', category: 'Araç', estimatedValue: 760000,
    description: 'Kompakt SUV, panoramik sunroof, wireless şarj, çarpışma önleme. Servis bakımlı.',
    wantedFor: 'Alman marka sedan. BMW 3, Mercedes C veya Audi A4.',
    city: 'Bursa', condition: 'İyi', tags: ['SUV','Panoramik','Wireless Şarj'],
    images: ['https://picsum.photos/seed/tucson-1/800/600','https://picsum.photos/seed/tucson-2/800/600'],
    brand: 'Hyundai', model: 'Tucson 1.6 CRDi', year: 2019, km: 89000,
    fuel: 'Dizel', transmission: 'Otomatik', color: 'Aqua Silver', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1598,
    ownerIdx: 2,
  },
  {
    title: '2020 Nissan Qashqai 1.3 DIG-T Tekna+', category: 'Araç', estimatedValue: 810000,
    description: 'Tekna+ en üst donanım. ProPilot, Bose ses, 360° kamera, kablosuz şarj.',
    wantedFor: 'Sedan veya station wagon. Passat, Superb, 508 SW olabilir.',
    city: 'İstanbul', condition: 'Mükemmel', tags: ['ProPilot','Bose Ses','360° Kamera'],
    images: ['https://picsum.photos/seed/qashqai-1/800/600','https://picsum.photos/seed/qashqai-2/800/600'],
    brand: 'Nissan', model: 'Qashqai 1.3 DIG-T', year: 2020, km: 53000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Gun Metallic', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1332,
    ownerIdx: 3,
  },
  {
    title: '2021 Skoda Octavia 1.5 TSI Ambition', category: 'Araç', estimatedValue: 820000,
    description: 'Geniş iç mekan, büyük bagaj, VW altyapısı. Virtual cockpit, navigasyon, adaptif cruise.',
    wantedFor: 'Compact SUV. Tiguan, Karoq veya T-Roc.',
    city: 'Ankara', condition: 'Mükemmel', tags: ['Virtual Cockpit','Geniş Bagaj','Adaptif Cruise'],
    images: ['https://picsum.photos/seed/octavia-1/800/600','https://picsum.photos/seed/octavia-2/800/600'],
    brand: 'Skoda', model: 'Octavia 1.5 TSI', year: 2021, km: 47000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Race Blue', hasAccidentRecord: false, bodyType: 'Sedan', engineCC: 1498,
    ownerIdx: 4,
  },
  {
    title: '2022 Volkswagen T-Roc 1.5 TSI R-Line', category: 'Araç', estimatedValue: 960000,
    description: 'R-Line dış paket, dijital gösterge, navigasyon, adaptif cruise, lane assist.',
    wantedFor: 'Daha büyük SUV. Tiguan, Kodiaq veya Passat Alltrack.',
    city: 'İzmir', condition: 'Mükemmel', tags: ['R-Line','Dijital Gösterge','Adaptif Cruise'],
    images: ['https://picsum.photos/seed/troc-1/800/600','https://picsum.photos/seed/troc-2/800/600'],
    brand: 'Volkswagen', model: 'T-Roc 1.5 TSI R-Line', year: 2022, km: 35000,
    fuel: 'Benzin', transmission: 'Otomatik', color: 'Energetic Orange', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1498,
    ownerIdx: 5,
  },
  {
    title: '2023 Toyota Yaris Cross 1.5 Hybrid Dream', category: 'Araç', estimatedValue: 840000,
    description: 'Yeni nesil kompakt crossover, hibrit motor. Dream donanım, Toyota Safety Sense.',
    wantedFor: 'Daha büyük crossover. RAV4, CX-5, Tucson ile takas yaparım.',
    city: 'Ankara', condition: 'Mükemmel', tags: ['Hibrit','Dream','Toyota Safety Sense'],
    images: ['https://picsum.photos/seed/yariscross-1/800/600','https://picsum.photos/seed/yariscross-2/800/600'],
    brand: 'Toyota', model: 'Yaris Cross 1.5 Hybrid', year: 2023, km: 22000,
    fuel: 'Hibrit', transmission: 'Otomatik', color: 'Emotional Red', hasAccidentRecord: false, bodyType: 'SUV', engineCC: 1490,
    ownerIdx: 1,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed başlıyor...');

  // Clear
  await prisma.message.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const users = await Promise.all(
    USERS.map(u => prisma.user.create({
      data: {
        ...u,
        password: bcrypt.hashSync(u.password, 10),
        avatar: `https://picsum.photos/seed/${u.name.split(' ')[0].toLowerCase()}/100/100`,
      },
    }))
  );
  console.log(`✅ ${users.length} kullanıcı oluşturuldu`);

  // Listings
  const listings = await Promise.all(
    LISTINGS.map(({ ownerIdx, ...l }) => prisma.listing.create({
      data: {
        ...l,
        images: JSON.stringify(l.images),
        tags:   JSON.stringify(l.tags),
        ownerId: users[ownerIdx].id,
      },
    }))
  );
  console.log(`✅ ${listings.length} ilan oluşturuldu`);

  // Sample offers
  await prisma.offer.create({
    data: {
      listingId:  listings[0].id,
      fromUserId: users[0].id,
      toUserId:   users[1].id,
      message:    'BMW\'niz için Civic\'imi teklif ediyorum. 300k TL nakit fark ödeyebilirim.',
      status:     'Beklemede',
      offeredValue: 850000,
    },
  });

  const offer2 = await prisma.offer.create({
    data: {
      listingId:  listings[3].id,
      fromUserId: users[0].id,
      toUserId:   users[4].id,
      message:    'Mercedes\'inize BMW 520d ile takas öneriyorum.',
      status:     'Görüşülüyor',
      offeredValue: 1050000,
    },
  });

  // Sample messages
  await prisma.message.createMany({
    data: [
      { offerId: offer2.id, fromUserId: users[0].id, text: 'Merhaba, aracınızla ilgileniyorum.' },
      { offerId: offer2.id, fromUserId: users[4].id, text: 'Teşekkürler! Aracınız hakkında bilgi alabilir miyim?' },
      { offerId: offer2.id, fromUserId: users[0].id, text: '2016 BMW 520d, 148.000 km, hasar kaydı yok. Servis bakımlı.' },
    ],
  });

  console.log(`✅ ${2} teklif, ${3} mesaj oluşturuldu`);
  console.log('\n📧 Demo giriş: demo@takaslat.com / demo1234');
  console.log('🏁 Seed tamamlandı!\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
