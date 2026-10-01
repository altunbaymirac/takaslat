import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderPage } from '../api/_lib/seo.js';

// İlan sayfaları burada üretilmez: api/listing.js istek anında Supabase'den okur.
// Burada üretilen her yol, dist'te dosya olarak var olduğu için rewrite'lardan önce sunulur.

const distDir = resolve('dist');
const baseHtml = await readFile(resolve(distDir, 'index.html'), 'utf8');

const staticPages = [
  {
    path: '/listings',
    title: 'Takas İlanları | Araç, Ev ve Arsa | Takaslat',
    description: 'Türkiye genelindeki araç, ev ve arsa takas ilanlarını filtrele, karşılaştır ve teklif ver.',
    heading: 'Araç, ev ve arsa takas ilanları',
  },
  {
    path: '/arac-takas',
    title: 'Araç Takas İlanları | Takaslat',
    description: 'Otomobil, motosiklet ve diğer araç takas ilanlarını karşılaştır. Aracını ilan ver, uygun teklifleri değerlendir.',
    heading: 'Araç takas ilanları',
  },
  {
    path: '/ev-takas',
    title: 'Ev Takas İlanları | Takaslat',
    description: 'Daire, villa, müstakil ev ve yazlık takas ilanlarını konum, metrekare ve tapu bilgilerine göre karşılaştır.',
    heading: 'Ev takas ilanları',
  },
  {
    path: '/arsa-takas',
    title: 'Arsa Takas İlanları | Takaslat',
    description: 'Arsa, tarla ve parsel takas ilanlarını konum, alan, imar ve tapu özelliklerine göre karşılaştır.',
    heading: 'Arsa takas ilanları',
  },
  {
    path: '/auctions',
    title: 'Canlı Mezat | Takaslat',
    description: 'Takaslat canlı mezatlarında araç, ev ve arsa ilanlarına anlık teklif ver.',
    heading: 'Canlı mezat',
  },
  {
    path: '/map',
    title: 'Harita Görünümü | Takaslat',
    description: 'Türkiye genelindeki takas ilanlarını harita üzerinde şehir, kategori ve fiyata göre filtreleyerek keşfet.',
    heading: 'Takas ilanları haritası',
  },
  {
    path: '/trust',
    title: 'Güvenli Takas | Takaslat',
    description: 'Hesap doğrulama durumunu kontrol et ve güvenli takas adımlarını incele.',
    heading: 'Güvenli takas rehberi',
  },
  {
    path: '/gizlilik',
    title: 'Gizlilik ve Çerez Politikası | Takaslat',
    description: 'Takaslat kişisel veri işleme, çerez ve reklam ölçümü politikası.',
    heading: 'Gizlilik ve Çerez Politikası',
  },
  {
    path: '/kullanim-kosullari',
    title: 'Kullanım Koşulları | Takaslat',
    description: 'Takaslat platformunun kullanım, ilan, teklif ve kullanıcı sorumluluğu koşulları.',
    heading: 'Kullanım Koşulları',
  },
];

async function writeRoute(path, html) {
  const target = resolve(distDir, path.slice(1));
  await mkdir(target, { recursive: true });
  await writeFile(resolve(target, 'index.html'), html, 'utf8');
}

for (const page of staticPages) {
  await writeRoute(page.path, renderPage(baseHtml, page));
}

console.log(`[seo] Generated ${staticPages.length} static pages.`);
