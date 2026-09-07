import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
type IconProps = { size?: number; fill?: string; color?: string; className?: string };
type IconWithChildrenProps = IconProps & { children: ReactNode };
function Icon({ children, size = 16, fill = 'none', color = 'currentColor', className }: IconWithChildrenProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>;
}
const ArrowRight = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Icon>;
const ArrowUpRight = (p: IconProps) => <Icon {...p}><path d="M7 17 17 7" /><path d="M7 7h10v10" /></Icon>;
const BadgeCheck = (p: IconProps) => <Icon {...p}><path d="m9 12 2 2 4-4" /><path d="M12 3 14 5.1l2.9-.1.9 2.8 2.4 1.5-1.3 2.6 1.3 2.6-2.4 1.5-.9 2.8-2.9-.1L12 21l-2-2.1-2.9.1-.9-2.8-2.4-1.5 1.3-2.6-1.3-2.6 2.4-1.5.9-2.8 2.9.1L12 3Z" /></Icon>;
const CarFront = (p: IconProps) => <Icon {...p}><path d="m5 17-1-5 2-5h12l2 5-1 5" /><path d="M4 17h16" /><path d="M7 17v2M17 17v2" /><circle cx="7.5" cy="14" r="1" /><circle cx="16.5" cy="14" r="1" /></Icon>;
const Check = (p: IconProps) => <Icon {...p}><path d="m5 12 4 4L19 6" /></Icon>;
const CirclePlus = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Icon>;
const Fuel = (p: IconProps) => <Icon {...p}><path d="M6 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15" /><path d="M5 20h11M9 6h4M17 7h2l2 3v7a2 2 0 0 1-4 0v-4h3" /></Icon>;
const Gauge = (p: IconProps) => <Icon {...p}><path d="M4 15a8 8 0 1 1 16 0" /><path d="m12 11 3-3" /><path d="M7 16h.01M12 17h.01M17 16h.01" /></Icon>;
const Heart = (p: IconProps) => <Icon {...p}><path d="M20.8 8.7c0 5.3-8.8 10.3-8.8 10.3S3.2 14 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" /></Icon>;
const MapPin = (p: IconProps) => <Icon {...p}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>;
const Menu = (p: IconProps) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
const Search = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>;
const ShieldCheck = (p: IconProps) => <Icon {...p}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></Icon>;
const SlidersHorizontal = (p: IconProps) => <Icon {...p}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h10M18 18h2" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="16" cy="18" r="2" /></Icon>;
const Sparkles = (p: IconProps) => <Icon {...p}><path d="m12 3 1.2 4.4L17 9l-3.8 1.6L12 15l-1.2-4.4L7 9l3.8-1.6L12 3ZM19 14l.6 2.4L22 17l-2.4.6L19 20l-.6-2.4L16 17l2.4-.6L19 14Z" /></Icon>;
const Star = (p: IconProps) => <Icon {...p}><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></Icon>;
const UserRound = (p: IconProps) => <Icon {...p}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.7-3.4 3.1-5 7-5s6.3 1.6 7 5" /></Icon>;
const X = (p: IconProps) => <Icon {...p}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
const Zap = (p: IconProps) => <Icon {...p}><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" /></Icon>;
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import heroAsset from './assets/takaslat-hero.png';

type Listing = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  fuel: string;
  transmission: string;
  city: string;
  value: number;
  wantedFor: string;
  images: string[];
  seller: { name: string; initials: string; rating: number; verified: boolean };
  condition: string;
  tags: string[];
};

const seedListings: Listing[] = [
  {
    id: 'volvo-xc40', title: 'Şehirden kaçış için XC40', brand: 'Volvo', model: 'XC40 T3 Inscription',
    year: 2021, km: 48500, fuel: 'Benzin', transmission: 'Otomatik', city: 'İstanbul',
    value: 1680000, wantedFor: 'SUV veya şehir otomobili', condition: 'Çok iyi',
    images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Mert K.', initials: 'MK', rating: 4.9, verified: true }, tags: ['Aile dostu', 'Bakımlı'],
  },
  {
    id: 'mini-cooper', title: 'Mini ruhu, tek sahibinden', brand: 'MINI', model: 'Cooper S',
    year: 2019, km: 62000, fuel: 'Benzin', transmission: 'Otomatik', city: 'Ankara',
    value: 1245000, wantedFor: 'Kompakt SUV veya sedan', condition: 'İyi',
    images: ['https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Deniz A.', initials: 'DA', rating: 4.8, verified: true }, tags: ['Panoramik tavan', 'Sıfır masraf'],
  },
  {
    id: 'toyota-corolla', title: 'Güvenilir bir yol arkadaşı', brand: 'Toyota', model: 'Corolla 1.8 Hybrid',
    year: 2022, km: 31000, fuel: 'Hibrit', transmission: 'Otomatik', city: 'İzmir',
    value: 1385000, wantedFor: 'Elektrikli veya hibrit SUV', condition: 'Mükemmel',
    images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Bora Y.', initials: 'BY', rating: 5, verified: true }, tags: ['Düşük kilometre', 'Tek sahip'],
  },
  {
    id: 'bmw-320i', title: 'Sürüşü sevenlere 320i', brand: 'BMW', model: '320i M Sport',
    year: 2020, km: 76000, fuel: 'Benzin', transmission: 'Otomatik', city: 'Bursa',
    value: 1795000, wantedFor: 'Daha büyük SUV veya pickup', condition: 'İyi',
    images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Ece T.', initials: 'ET', rating: 4.7, verified: false }, tags: ['M Sport', 'Tramer yok'],
  },
  {
    id: 'peugeot-3008', title: 'Ailecek yeni rotalara', brand: 'Peugeot', model: '3008 GT',
    year: 2022, km: 42000, fuel: 'Dizel', transmission: 'Otomatik', city: 'Antalya',
    value: 1510000, wantedFor: 'Sedan veya şehir içi hibrit', condition: 'Çok iyi',
    images: ['https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Selin D.', initials: 'SD', rating: 4.9, verified: true }, tags: ['Geniş bagaj', 'Garaj aracı'],
  },
  {
    id: 'tesla-model-3', title: 'Sessiz, hızlı, elektrikli', brand: 'Tesla', model: 'Model 3 Long Range',
    year: 2021, km: 35500, fuel: 'Elektrik', transmission: 'Otomatik', city: 'İstanbul',
    value: 1875000, wantedFor: 'Elektrikli SUV veya premium sedan', condition: 'Mükemmel',
    images: ['https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=85'],
    seller: { name: 'Arda Ç.', initials: 'AÇ', rating: 4.9, verified: true }, tags: ['Uzun menzil', 'Otopilot'],
  },
];

const money = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
const km = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

function useStored<T>(key: string, fallback: T): [T, (value: T | ((old: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
  });
  const update = (value: T | ((old: T) => T)) => setState((old) => {
    const next = typeof value === 'function' ? (value as (old: T) => T)(old) : value;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* local-only fallback */ }
    return next;
  });
  return [state, update];
}

function Logo() {
  return <Link to="/" className="flex items-center gap-3" data-testid="link-brand-home">
    <span className="brand-mark"><span>T</span></span><span className="brand-name">takaslat</span>
  </Link>;
}

function Header({ favoritesCount }: { favoritesCount: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname: location } = useLocation();
  return <header className="site-header">
    <div className="container-wide flex items-center justify-between w-full">
      <Logo />
      <nav className={`desktop-nav flex items-center gap-7 ${menuOpen ? 'mobile-open' : ''}`}>
        <Link to="/listings" className={`nav-link ${location === '/listings' ? 'active' : ''}`} data-testid="link-listings">Keşfet</Link>
        <Link to="/create" className={`nav-link ${location === '/create' ? 'active' : ''}`} data-testid="link-create">İlan ver</Link>
        <Link to="/favorites" className={`nav-link ${location === '/favorites' ? 'active' : ''}`} data-testid="link-favorites">Favoriler {favoritesCount > 0 && <span className="mono-font text-[10px]">({favoritesCount})</span>}</Link>
      </nav>
      <div className="header-actions flex items-center gap-2">
        <Link to="/login" className="btn-secondary" data-testid="link-login"><UserRound size={15} /> Giriş yap</Link>
        <Link to="/create" className="btn-primary" data-testid="button-header-create"><CirclePlus size={15} /> İlan ver</Link>
        <button className="btn-secondary !p-2.5 !rounded-full md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menüyü aç" data-testid="button-mobile-menu">
          {menuOpen ? <X size={17} /> : <Menu size={17} />}
        </button>
      </div>
    </div>
  </header>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <button className="toast-message" onClick={onClose} data-testid="status-toast">{message}</button>;
}

function ListingCard({ listing, isFavorite, onFavorite }: { listing: Listing; isFavorite: boolean; onFavorite: (id: string) => void }) {
  return <article className="soft-card listing-card" data-testid={`card-listing-${listing.id}`}>
    <Link to={`/listing/${listing.id}`} data-testid={`link-listing-${listing.id}`}>
      <div className="listing-image-wrap">
        <img className="listing-image" src={listing.images[0]} alt={listing.title} loading="lazy" data-testid={`img-listing-${listing.id}`} />
        <div className="image-top-actions">
          <span className="tag"><Zap size={11} /> Takasa açık</span>
          <button className="favorite-btn" onClick={(event) => { event.preventDefault(); onFavorite(listing.id); }} aria-label="Favoriye ekle" data-testid={`button-favorite-${listing.id}`}>
            <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} color={isFavorite ? 'hsl(4 68% 53%)' : 'currentColor'} />
          </button>
        </div>
      </div>
    </Link>
    <div className="card-body">
      <Link to={`/listing/${listing.id}`} data-testid={`link-card-title-${listing.id}`}>
        <div className="card-title">{listing.title}</div>
        <div className="card-sub">{listing.brand} {listing.model} · {listing.city}</div>
      </Link>
      <div className="card-meta">
        <span className="meta-pill"><Gauge size={12} /> {km(listing.km)} km</span>
        <span className="meta-pill"><Fuel size={12} /> {listing.fuel}</span>
        <span className="meta-pill">{listing.year}</span>
      </div>
      <div className="value-row"><span className="value-label">Tahmini değer</span><span className="value">{money(listing.value)}</span></div>
    </div>
  </article>;
}

function HomePage({ listings, favorites, onFavorite }: { listings: Listing[]; favorites: string[]; onFavorite: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('Tüm şehirler');
  const [brand, setBrand] = useState('Tüm markalar');
  const navigate = useNavigate();
  const featured = listings.slice(0, 3);
  const doSearch = () => navigate(`/listings${search || city !== 'Tüm şehirler' || brand !== 'Tüm markalar' ? `?q=${encodeURIComponent(search)}&city=${encodeURIComponent(city)}&brand=${encodeURIComponent(brand)}` : ''}`);
  return <div>
    <section className="hero-wrap">
      <div className="container-wide hero-grid">
        <div className="fade-up">
          <div className="hero-kicker">Türkiye'nin araç takas alanı</div>
          <h1 className="hero-title">Aracını satma.<br /><em>Hikâyeni değiştir.</em></h1>
          <p className="hero-copy">İhtiyacın değiştiğinde aracın da değişebilir. Binlerce gerçek ilan arasından sana adil gelen takası bul, yeni yoluna güvenle çık.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/listings" className="btn-primary !bg-[hsl(var(--accent))] !text-[hsl(var(--foreground))]" data-testid="button-hero-discover">Takasları keşfet <ArrowRight size={16} /></Link>
            <Link to="/create" className="btn-secondary !bg-transparent !border-white/20 !text-white" data-testid="button-hero-create">Aracını takasa koy</Link>
          </div>
        </div>
        <div className="hero-visual fade-up fade-up-delay-2">
          <img src={heroAsset} alt="Takaslat takas katmanları" className="hero-asset" data-testid="img-hero-asset" />
          <div className="stat-sticker"><b>4.8/5</b><span className="text-[10px] font-bold">topluluk güveni</span></div>
        </div>
      </div>
    </section>
    <div className="container-wide">
      <div className="search-panel fade-up fade-up-delay-1">
        <div className="search-panel-inner">
          <label className="search-field"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Marka, model veya ne arıyorsun?" data-testid="input-home-search" /></label>
          <label className="search-field"><MapPin size={17} /><select value={city} onChange={(e) => setCity(e.target.value)} data-testid="select-home-city"><option>Tüm şehirler</option><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Bursa</option><option>Antalya</option></select></label>
          <label className="search-field"><CarFront size={17} /><select value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="select-home-brand"><option>Tüm markalar</option><option>Volvo</option><option>MINI</option><option>Toyota</option><option>BMW</option><option>Peugeot</option><option>Tesla</option></select></label>
          <button className="btn-primary" onClick={doSearch} data-testid="button-home-search">Ara <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
    <section className="section">
      <div className="container-wide">
        <div className="flex items-end justify-between gap-5 mb-8">
          <div><div className="eyebrow">Bugünün takasları</div><h2 className="section-title">İyi eşleşmeler<br />tesadüf değil.</h2></div>
          <Link to="/listings" className="btn-secondary hidden sm:inline-flex" data-testid="link-all-listings">Tüm ilanlar <ArrowUpRight size={15} /></Link>
        </div>
        <div className="listing-grid">{featured.map((listing, index) => <div key={listing.id} className={`fade-up fade-up-delay-${index + 1}`}><ListingCard listing={listing} isFavorite={favorites.includes(listing.id)} onFavorite={onFavorite} /></div>)}</div>
      </div>
    </section>
    <section className="section pt-0">
      <div className="container-wide">
        <div className="eyebrow">Nasıl çalışır?</div><h2 className="section-title mb-8">Alım satım değil,<br />karşılıklı iyi fikir.</h2>
        <div className="steps-grid">
          <div className="step"><div className="step-number">01 / ARA</div><h3>İhtiyacını söyle.</h3><p>Marka modelden çok, hayatına uyacak aracı tarif et. Takaslat aramanı doğru ilanlarla buluşturur.</p></div>
          <div className="step"><div className="step-number">02 / EŞLEŞ</div><h3>Ortak zemini bul.</h3><p>Değerleri ve beklentileri açıkça gör. İki taraf için de mantıklı olan teklifleri kaydet.</p></div>
          <div className="step"><div className="step-number">03 / TAKASLA</div><h3>Yeni yoluna çık.</h3><p>Mesajlaş, buluş, ekspertizini yap. Son karar her zaman sende.</p></div>
        </div>
      </div>
    </section>
    <section className="section pt-0">
      <div className="container-wide soft-card p-7 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-7" style={{ background: 'hsl(185 55% 34%)', color: 'white', border: 0 }}>
        <div><div className="text-[11px] uppercase tracking-[.14em] font-bold text-white/60">Takaslat notu</div><h2 className="display-font text-3xl md:text-4xl tracking-[-.06em] mt-3 max-w-xl">Aracın garajda beklemiyor. Sıradaki yolculuğuna hazır.</h2></div>
        <Link to="/create" className="btn-primary !bg-[hsl(var(--accent))] !text-[hsl(var(--foreground))] shrink-0" data-testid="button-cta-create">İlanını hazırla <ArrowRight size={16} /></Link>
      </div>
    </section>
  </div>;
}

function ListingsPage({ listings, favorites, onFavorite }: { listings: Listing[]; favorites: string[]; onFavorite: (id: string) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const [search, setSearch] = useState(query.get('q') || '');
  const [city, setCity] = useState(query.get('city') || 'Tüm şehirler');
  const [brand, setBrand] = useState(query.get('brand') || 'Tüm markalar');
  const [fuel, setFuel] = useState('Tüm yakıtlar');
  const [sort, setSort] = useState('Önerilen');
  const filtered = useMemo(() => listings.filter((item) => {
    const text = `${item.title} ${item.brand} ${item.model} ${item.wantedFor}`.toLocaleLowerCase('tr');
    return (!search || text.includes(search.toLocaleLowerCase('tr'))) && (city === 'Tüm şehirler' || item.city === city) && (brand === 'Tüm markalar' || item.brand === brand) && (fuel === 'Tüm yakıtlar' || item.fuel === fuel);
  }).sort((a, b) => sort === 'Değer: düşükten yükseğe' ? a.value - b.value : sort === 'Değer: yüksekten düşüğe' ? b.value - a.value : 0), [listings, search, city, brand, fuel, sort]);
  const clear = () => { setSearch(''); setCity('Tüm şehirler'); setBrand('Tüm markalar'); setFuel('Tüm yakıtlar'); };
  return <main className="page-shell"><div className="container-wide">
    <div className="page-heading"><div><div className="eyebrow">Takas radarın</div><h1>Bir sonraki<br /><span className="text-[hsl(var(--secondary))]">aracını bul.</span></h1></div><Link to="/create" className="btn-primary" data-testid="button-listings-create"><CirclePlus size={16} /> İlan ver</Link></div>
    <div className="filter-layout">
      <aside className="soft-card filter-panel">
        <div className="flex items-center justify-between"><h3>Filtrele</h3><button onClick={clear} className="text-[11px] font-bold text-[hsl(var(--secondary))]" data-testid="button-clear-filters">Temizle</button></div>
        <label className="filter-label">Ara</label><input className="filter-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Model, marka..." data-testid="input-listings-search" />
        <label className="filter-label">Şehir</label><select className="filter-input" value={city} onChange={(e) => setCity(e.target.value)} data-testid="select-listings-city"><option>Tüm şehirler</option><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Bursa</option><option>Antalya</option></select>
        <label className="filter-label">Marka</label><select className="filter-input" value={brand} onChange={(e) => setBrand(e.target.value)} data-testid="select-listings-brand"><option>Tüm markalar</option>{['Volvo','MINI','Toyota','BMW','Peugeot','Tesla'].map((item) => <option key={item}>{item}</option>)}</select>
        <label className="filter-label">Yakıt</label><select className="filter-input" value={fuel} onChange={(e) => setFuel(e.target.value)} data-testid="select-listings-fuel"><option>Tüm yakıtlar</option><option>Benzin</option><option>Dizel</option><option>Hibrit</option><option>Elektrik</option></select>
        <div className="mt-6 p-3 rounded-xl bg-[hsl(42_30%_96%)]"><div className="flex gap-2 text-[hsl(var(--secondary))]"><ShieldCheck size={16} /><span className="text-[11px] font-bold">Güvenli eşleşme</span></div><p className="text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))] mt-2">Doğrulanmış üyeler ve açık değer bilgileriyle.</p></div>
      </aside>
      <section>
        <div className="result-toolbar"><span><b className="text-[hsl(var(--foreground))]" data-testid="text-result-count">{filtered.length}</b> takas fırsatı</span><label className="flex items-center gap-2"><SlidersHorizontal size={14} /><select className="bg-transparent outline-0 font-bold text-[11px]" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="select-sort"><option>Önerilen</option><option>Değer: düşükten yükseğe</option><option>Değer: yüksekten düşüğe</option></select></label></div>
        {filtered.length > 0 ? <div className="listing-grid">{filtered.map((listing) => <ListingCard key={listing.id} listing={listing} isFavorite={favorites.includes(listing.id)} onFavorite={onFavorite} />)}</div> : <div className="empty-state"><Search size={32} /><h3 className="display-font text-2xl tracking-tight">Bu eşleşme henüz yolda.</h3><p className="text-sm text-[hsl(var(--muted-foreground))] mt-2">Filtrelerini biraz genişletmeyi deneyebilirsin.</p><button className="btn-secondary mt-5" onClick={clear} data-testid="button-empty-clear">Filtreleri temizle</button></div>}
      </section>
    </div>
  </div></main>;
}

function ListingPage({ listings, favorites, onFavorite, showToast }: { listings: Listing[]; favorites: string[]; onFavorite: (id: string) => void; showToast: (m: string) => void }) {
  const { id } = useParams<{ id: string }>();
  const listing = listings.find((item) => item.id === id) || listings[0];
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  return <main className="page-shell"><div className="container-wide">
    <div className="mb-6"><Link to="/listings" className="text-[11px] font-bold text-[hsl(var(--muted-foreground))] inline-flex items-center gap-2" data-testid="link-back-listings">← Tüm takaslar</Link></div>
    <div className="detail-grid">
      <div><div className="relative"><img src={listing.images[0]} alt={listing.title} className="detail-hero" data-testid={`img-detail-${listing.id}`} /><button className="favorite-btn absolute right-4 top-4" onClick={() => { onFavorite(listing.id); showToast(favorites.includes(listing.id) ? 'Favorilerden çıkarıldı' : 'Favorilere kaydedildi'); }} data-testid="button-detail-favorite"><Heart size={18} fill={favorites.includes(listing.id) ? 'currentColor' : 'none'} /></button></div><div className="flex flex-wrap gap-2 mt-4">{listing.tags.map((tag) => <span className="meta-pill" key={tag}><Check size={12} /> {tag}</span>)}</div></div>
      <div><div className="eyebrow">{listing.brand} · {listing.city}</div><h1 className="detail-title" data-testid="text-detail-title">{listing.title}</h1><p className="text-sm text-[hsl(var(--muted-foreground))] leading-relaxed">Aracını, hayatındaki yeni ihtiyaca göre değiştirmek isteyen {listing.seller.name} tarafından paylaşıldı.</p>
        <div className="detail-stats">
          <div className="detail-stat"><label>MODEL / YIL</label><b>{listing.model} · {listing.year}</b></div><div className="detail-stat"><label>KİLOMETRE</label><b>{km(listing.km)} km</b></div>
          <div className="detail-stat"><label>YAKIT / VİTES</label><b>{listing.fuel} · {listing.transmission}</b></div><div className="detail-stat"><label>TAHMİNİ DEĞER</label><b>{money(listing.value)}</b></div>
        </div>
        <div className="mb-6"><span className="text-[10px] uppercase tracking-[.13em] font-bold text-[hsl(var(--muted-foreground))]">Karşılığında arıyor</span><div className="flex items-center gap-3 mt-2 p-3 rounded-xl bg-[hsl(var(--muted))]"><ArrowRight className="exchange-arrow" size={18} /><span className="font-bold text-sm">{listing.wantedFor}</span></div></div>
        <div className="offer-box">{sent ? <div className="text-center py-5"><BadgeCheck size={34} className="mx-auto text-[hsl(var(--accent))]" /><h3 className="display-font text-2xl mt-3">Teklifin yola çıktı.</h3><p className="mt-2">İlan sahibi uygun olduğunda seninle iletişime geçecek.</p><button className="btn-secondary !bg-transparent !text-white !border-white/20 mt-4" onClick={() => setSent(false)} data-testid="button-new-offer">Yeni mesaj yaz</button></div> : <><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] grid place-items-center font-bold text-sm">{listing.seller.initials}</span><div><div className="font-bold text-sm flex items-center gap-2">{listing.seller.name} {listing.seller.verified && <BadgeCheck size={14} className="text-[hsl(var(--accent))]" />}</div><div className="text-[10px] text-white/55 flex items-center gap-1"><Star size={11} fill="currentColor" /> {listing.seller.rating} topluluk puanı</div></div></div><h3 className="display-font text-2xl mt-6 tracking-tight">Bu takas sana uyuyor mu?</h3><p>Aracını ve ne aradığını kısaca anlat. Net mesajlar daha hızlı cevap alır.</p><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Merhaba, aracım..." data-testid="textarea-offer-message" /><button className="btn-primary w-full !bg-[hsl(var(--accent))] !text-[hsl(var(--foreground))]" onClick={() => { setSent(true); showToast('Teklif mesajın gönderildi'); }} disabled={!message.trim()} data-testid="button-send-offer">Takas teklifi gönder <ArrowRight size={15} /></button></>}</div>
      </div>
    </div>
  </div></main>;
}

function CreatePage({ onCreate, showToast }: { onCreate: (listing: Listing) => void; showToast: (m: string) => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', brand: 'Toyota', model: '', year: '2021', km: '', fuel: 'Benzin', transmission: 'Otomatik', city: 'İstanbul', value: '', wantedFor: '', image: '' });
  const update = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = () => {
    const newListing: Listing = { id: `my-${Date.now()}`, title: form.title || `${form.brand} ${form.model}`, brand: form.brand, model: form.model || 'Özel seri', year: Number(form.year) || 2021, km: Number(form.km) || 0, fuel: form.fuel, transmission: form.transmission, city: form.city, value: Number(form.value) || 1000000, wantedFor: form.wantedFor || 'Benzer değerde bir araç', condition: 'İyi', images: [form.image || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85'], seller: { name: 'Sen', initials: 'S', rating: 5, verified: true }, tags: ['Yeni ilan'] };
    onCreate(newListing); showToast('İlanın yayında — güzel bir eşleşme dileriz'); navigate(`/listing/${newListing.id}`);
  };
  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => <div className="form-field"><label>{label}</label><input type={type} value={form[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} data-testid={`input-create-${key}`} /></div>;
  return <main className="page-shell"><div className="container-wide form-shell">
    <div className="mb-9"><div className="eyebrow">İlanını anlat</div><h1 className="page-heading !block !mb-0"><span className="display-font block text-5xl tracking-[-.07em] mt-2">Doğru araç,<br /><span className="text-[hsl(var(--secondary))]">doğru hikâye.</span></span></h1><p className="text-sm text-[hsl(var(--muted-foreground))] mt-4 max-w-md">İlanın ne kadar net olursa, aradığın takas o kadar hızlı seni bulur.</p></div>
    <div className="flex items-center gap-2 mb-7"><span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${step >= 1 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))]'}`}>1</span><span className="h-px bg-[hsl(var(--border))] w-14"></span><span className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${step >= 2 ? 'bg-[hsl(var(--primary))] text-white' : 'bg-[hsl(var(--muted))]'}`}>2</span><span className="text-[11px] text-[hsl(var(--muted-foreground))] ml-2">Adım {step} / 2</span></div>
    <div className="soft-card p-5 md:p-8">{step === 1 ? <><h2 className="display-font text-2xl tracking-tight mb-5">Aracının kimliği</h2><div className="form-grid">{field('title', 'İlan başlığı', 'text', 'Örn. Hafta sonu kaçamaklarının CX-5\'i')}{field('brand', 'Marka')}{field('model', 'Model', 'text', 'Örn. Corolla 1.8 Hybrid')}{field('year', 'Model yılı', 'number')}{field('km', 'Kilometre', 'number', '48500')}{field('value', 'Tahmini değer', 'number', '₺1.250.000')}<div className="form-field"><label>Yakıt</label><select value={form.fuel} onChange={(e) => update('fuel', e.target.value)} data-testid="select-create-fuel"><option>Benzin</option><option>Dizel</option><option>Hibrit</option><option>Elektrik</option></select></div><div className="form-field"><label>Vites</label><select value={form.transmission} onChange={(e) => update('transmission', e.target.value)} data-testid="select-create-transmission"><option>Otomatik</option><option>Manuel</option></select></div><div className="form-field"><label>Şehir</label><select value={form.city} onChange={(e) => update('city', e.target.value)} data-testid="select-create-city"><option>İstanbul</option><option>Ankara</option><option>İzmir</option><option>Bursa</option><option>Antalya</option></select></div><div className="form-field"><label>Fotoğraf URL</label><input value={form.image} onChange={(e) => update('image', e.target.value)} placeholder="İstersen bir fotoğraf bağlantısı ekle" data-testid="input-create-image" /></div></div><button className="btn-primary mt-7" onClick={() => setStep(2)} data-testid="button-create-next">Devam et <ArrowRight size={15} /></button></> : <><h2 className="display-font text-2xl tracking-tight mb-5">Takas beklentin</h2><div className="form-grid"><div className="form-field full"><label>Karşılığında ne arıyorsun?</label><textarea value={form.wantedFor} onChange={(e) => update('wantedFor', e.target.value)} placeholder="Örn. Daha küçük bir SUV veya şehir içi hibrit" data-testid="textarea-create-wanted" /></div><div className="form-field full"><label>İlan ön izlemesi</label><div className="p-4 rounded-xl bg-[hsl(var(--muted))] flex gap-4 items-center"><img className="w-24 h-20 rounded-lg object-cover" src={form.image || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=300&q=80'} alt="Ön izleme" /><div><b className="display-font text-lg">{form.title || `${form.brand} ${form.model || 'modelin'}`}</b><div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{form.city} · {form.year} · {form.km || '—'} km</div></div></div></div></div><div className="flex flex-wrap gap-2 mt-7"><button className="btn-secondary" onClick={() => setStep(1)} data-testid="button-create-back">Geri dön</button><button className="btn-primary" onClick={submit} data-testid="button-create-submit">İlanı yayınla <Sparkles size={15} /></button></div></>}</div>
  </div></main>;
}

function FavoritesPage({ listings, favorites, onFavorite }: { listings: Listing[]; favorites: string[]; onFavorite: (id: string) => void }) {
  const saved = listings.filter((item) => favorites.includes(item.id));
  return <main className="page-shell"><div className="container-wide"><div className="page-heading"><div><div className="eyebrow">Kendine ayırdıkların</div><h1>Favori<br /><span className="text-[hsl(var(--secondary))]">garajın.</span></h1></div><span className="mono-font text-xs text-[hsl(var(--muted-foreground))]">{saved.length} kayıtlı ilan</span></div>{saved.length ? <div className="listing-grid">{saved.map((listing) => <ListingCard key={listing.id} listing={listing} isFavorite onFavorite={onFavorite} />)}</div> : <div className="empty-state"><Heart size={34} /><h3 className="display-font text-2xl tracking-tight">Henüz bir şey saklamadın.</h3><p className="text-sm text-[hsl(var(--muted-foreground))] mt-2 max-w-sm mx-auto">İçine sinen ilanların üzerindeki kalp ikonuna dokun. Burada senin için beklesinler.</p><Link to="/listings" className="btn-primary mt-5" data-testid="button-favorites-discover">İlanları keşfet <ArrowRight size={15} /></Link></div>}</div></main>;
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const isRegister = mode === 'register';
  const submit = (event: FormEvent) => { event.preventDefault(); navigate('/'); };
  return <div className="auth-layout"><section className="auth-art"><Logo /><div className="relative"><div className="hero-kicker">Takaslat topluluğu</div><h1 className="mt-5">{isRegister ? 'Kendi yolunu çiz.' : 'Yolun burada değişir.'}</h1><p className="text-white/55 text-sm leading-relaxed max-w-sm mt-6">{isRegister ? 'Aracınla birlikte yeni bir ihtimale yer aç. Ücretsiz ilan ver, doğru insanla eşleş.' : 'Favorilerini, mesajlarını ve ilanlarını tek yerde tut. Takasın kontrolü sende.'}</p></div><div className="text-[10px] text-white/35 mono-font">© 2024 takaslat / iyi takaslar</div></section><section className="auth-form"><div className="auth-form-inner"><div className="eyebrow">{isRegister ? 'Yeni bir başlangıç' : 'Tekrar hoş geldin'}</div><h2>{isRegister ? 'Hesap oluştur.' : 'Giriş yap.'}</h2><p className="text-sm text-[hsl(var(--muted-foreground))] mb-7">{isRegister ? 'Takas hikâyeni paylaşmaya başla.' : 'Kaldığın yerden devam et.'}</p><form onSubmit={submit} className="space-y-4">{isRegister && <div className="form-field"><label>Ad soyad</label><input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Adın ve soyadın" data-testid="input-auth-name" /></div>}<div className="form-field"><label>E-posta</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sen@ornek.com" data-testid="input-auth-email" /></div><div className="form-field"><label>Şifre</label><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" data-testid="input-auth-password" /></div><button className="btn-primary w-full mt-2" type="submit" data-testid="button-auth-submit">{isRegister ? 'Hesabımı oluştur' : 'Giriş yap'} <ArrowRight size={15} /></button></form><div className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">{isRegister ? 'Zaten hesabın var mı?' : 'Henüz hesabın yok mu?'} <Link to={isRegister ? '/login' : '/register'} className="font-bold text-[hsl(var(--secondary))]" data-testid="link-auth-switch">{isRegister ? 'Giriş yap' : 'Kayıt ol'}</Link></div></div></section></div>;
}

function AppContent() {
  const [customListings, setCustomListings] = useStored<Listing[]>('takaslat-listings', []);
  const [favorites, setFavorites] = useStored<string[]>('takaslat-favorites', []);
  const [toast, setToast] = useState('');
  const listings = [...customListings, ...seedListings];
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600); };
  const onFavorite = (id: string) => setFavorites((old) => old.includes(id) ? old.filter((item) => item !== id) : [...old, id]);
  return <div className="app-shell texture"><Header favoritesCount={favorites.length} /><Routes>
    <Route path="/" element={<HomePage listings={listings} favorites={favorites} onFavorite={onFavorite} />} />
    <Route path="/listings" element={<ListingsPage listings={listings} favorites={favorites} onFavorite={onFavorite} />} />
    <Route path="/listing/:id" element={<ListingPage listings={listings} favorites={favorites} onFavorite={onFavorite} showToast={showToast} />} />
    <Route path="/create" element={<CreatePage onCreate={(listing) => setCustomListings((old) => [listing, ...old])} showToast={showToast} />} />
    <Route path="/favorites" element={<FavoritesPage listings={listings} favorites={favorites} onFavorite={onFavorite} />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>{toast && <Toast message={toast} onClose={() => setToast('')} />}</div>;
}

function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>;
}

export default App;
