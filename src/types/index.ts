export type Category = 'Araç' | 'Elektronik' | 'Gayrimenkul' | 'Diğer';
export type FuelType = 'Benzin' | 'Dizel' | 'LPG' | 'Hibrit' | 'Elektrik';
export type TransmissionType = 'Manuel' | 'Otomatik' | 'Yarı Otomatik';
export type Condition = 'Mükemmel' | 'İyi' | 'Orta' | 'Yıpranmış';
export type OfferStatus = 'Beklemede' | 'Görüşülüyor' | 'Onaylandı' | 'Tamamlandı' | 'Reddedildi';

export interface VehicleDetails {
  brand: string;
  model: string;
  year: number;
  km: number;
  fuel: FuelType;
  transmission: TransmissionType;
  color: string;
  hasAccidentRecord: boolean;
  bodyType?: string;
  trim?: string;            // Donanım / paket (Comfortline, R-Line...)
  engineCC?: number;
  power?: number;           // HP / beygir gücü
  driveType?: string;       // FWD | RWD | AWD | 4WD
  numberOfDoors?: number;   // 2 | 3 | 4 | 5
  paintedParts?: string[];  // Boyalı parçalar
  changedParts?: string[];  // Değişen (değiştirilen) parçalar
  hasExpertise?: boolean;
  expertiseFirm?: string;
  expertiseDate?: string;
  expertiseNote?: string;
}

// ─── Elektronik ───────────────────────────────────────────────────────────────

export type ElectronicType =
  | 'Telefon' | 'Laptop' | 'Tablet' | 'Televizyon'
  | 'Kulaklık' | 'Konsol' | 'Kamera' | 'Akıllı Saat' | 'Diğer';

export type WarrantyStatus = 'Devam ediyor' | 'Bitti' | 'Yok';

export interface ElectronicDetails {
  type:           ElectronicType;
  brand:          string;
  model:          string;
  year?:          number;
  storage?:       string;          // '128 GB', '1 TB'
  ram?:           string;          // '8 GB'
  screenSize?:    number;          // inch
  color?:         string;
  os?:            string;          // 'iOS 17', 'Windows 11'
  batteryHealth?: number;          // % — telefon/laptop için
  warranty?:      WarrantyStatus;
  accessories?:   string[];        // ['Orijinal kutu', 'Şarj cihazı', 'Kulaklık']
}

// ─── Gayrimenkul ──────────────────────────────────────────────────────────────

export type PropertyType =
  | 'Daire' | 'Villa' | 'Müstakil Ev' | 'Arsa' | 'Dükkan' | 'Ofis' | 'Yazlık';

export type HeatingType =
  | 'Doğalgaz Kombi' | 'Merkezi' | 'Klima' | 'Soba' | 'Yerden Isıtma' | 'Yok';

export type TitleDeed =
  | 'Kat Mülkiyetli' | 'Kat İrtifaklı' | 'Hisseli' | 'Müstakil Tapu' | 'Arsa Tapulu';

export interface PropertyDetails {
  type:          PropertyType;
  netSqm?:       number;       // net m²
  grossSqm?:     number;       // brüt m²
  rooms?:        string;       // '3+1', '2+1', 'Stüdyo'
  buildingAge?:  number;       // yıl
  floor?:        string;       // '3/8', 'Zemin'
  heating?:      HeatingType;
  furnished?:    boolean;      // eşyalı mı
  balcony?:      boolean;
  elevator?:     boolean;
  parking?:      boolean;
  titleDeed?:    TitleDeed;
  monthlyDues?:  number;       // aidat ₺
}

export interface ListingAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  kind: 'image' | 'expertise' | 'document';
  size: number;
  createdAt: string;
}

export type VerificationState = 'verified' | 'pending' | 'not_started';

export interface ListingVerification {
  identity?: VerificationState;
  ownership?: VerificationState;
  vin?: VerificationState;
  mileage?: VerificationState;
  damage?: VerificationState;
  expertise?: VerificationState;
  updatedAt?: string;
}

export interface Listing {
  id: string;
  listingCode?: string;   // TKS-XXXXXXX — benzersiz ilan kodu
  title: string;
  category: Category;
  estimatedValue: number;
  description: string;
  wantedFor: string;
  city: string;
  images: string[];
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  ownerRating?: number;
  ownerTotalSwaps?: number;
  ownerEmailVerified?: boolean;
  ownerPhoneVerified?: boolean;
  createdAt: string;
  vehicleDetails?:    VehicleDetails;
  electronicDetails?: ElectronicDetails;
  propertyDetails?:   PropertyDetails;
  condition: Condition;
  tags: string[];
  viewCount?: number;
  videoUrl?: string;            // YouTube veya doğrudan video URL'si
  attachments?: ListingAttachment[];
  verification?: ListingVerification;
}

export type AuctionStatus = 'scheduled' | 'live' | 'ended';

export interface AuctionBid {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  createdAt: string;
  note?: string;
}

export interface LiveAuction {
  id: string;
  listingId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startingPrice: number;
  currentBid: number;
  bidIncrement: number;
  reservePrice?: number;
  reserveMet?: boolean;
  winnerId?: string;
  winningBid?: number;
  closedAt?: string;
  status: AuctionStatus;
  bids: AuctionBid[];
  watcherCount: number;
  createdAt: string;
}

// ─── Saved searches & ratings ─────────────────────────────────────────────────

export interface SavedSearch {
  id:        string;
  name:      string;
  filters:   FilterState;
  createdAt: string;
}

export interface WishItem {
  id:           string;
  name:         string;
  category?:    Category;
  brand?:       string;
  model?:       string;
  minYear?:     number;
  maxYear?:     number;
  city?:        string;
  maxValue?:    number;
  notify:       boolean;          // yeni eşleşme geldiğinde bildirim
  createdAt:    string;
  matchedIds:   string[];          // şu ana kadar eşleşen ilanlar
}

export interface ListingQA {
  id:         string;
  listingId:  string;
  userId:     string;
  userName:   string;
  question:   string;
  answer?:    string;
  answeredAt?:string;
  createdAt:  string;
}

export interface MeetingProposal {
  id:        string;
  offerId:   string;
  fromUserId:string;
  toUserId:  string;
  date:      string;          // ISO
  location:  string;
  note?:     string;
  status:    'beklemede' | 'kabul' | 'red' | 'iptal';
  createdAt: string;
}

export interface SwapRating {
  id:         string;
  offerId:    string;
  fromUserId: string;
  toUserId:   string;
  stars:      1 | 2 | 3 | 4 | 5;
  comment?:   string;
  createdAt:  string;
}

export interface ListingReport {
  id: string;
  listingId: string;
  reason: string;
  details?: string;
  createdAt: string;
}

export interface OfferMessage {
  id: string;
  fromUserId: string;
  text: string;
  createdAt: string;
}

export interface SwapOffer {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName?: string;
  listingId: string;
  listingTitle: string;
  offeredListingId?: string;
  offeredListingTitle?: string;
  message: string;
  status: OfferStatus;
  createdAt: string;
  updatedAt?: string;
  offeredValue?: number;
  messages?: OfferMessage[];
  // Teklif şartlarının iki tarafça ayrı ayrı kabulü
  fromAccepted?: boolean;
  toAccepted?: boolean;
  // Çift onay
  fromConfirmed?: boolean;
  toConfirmed?: boolean;
  // Karşı teklif
  counterMessage?: string;
  // Buluşma notu
  meetingNote?: string;
  // Puanlama
  fromRated?: boolean;
  toRated?: boolean;
  // İlan detayları (backend'den join geliyor)
  listing?: {
    id: string;
    title: string;
    estimatedValue: number;
    images: string[];
    city: string;
  };
}

export type SwapProcessStep =
  | 'identity'
  | 'expertise'
  | 'agreement'
  | 'secure_payment'
  | 'notary';

export interface SwapProcess {
  offerId: string;
  completedSteps: SwapProcessStep[];
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  city: string;
  rating: number;
  totalSwaps: number;
}

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  listingId: string;
  compatibilityScore: number;
  reasons: string[];
  priceDiff: number;
  negotiationTip: string;
}

export interface AIResponse {
  message: string;
  suggestions?: AISuggestion[];
}

export interface FilterState {
  category: Category | 'Tümü';
  city: string;
  minValue: number;
  maxValue: number;
  searchQuery: string;
  model:         string;
  brands:        string[];
  minYear:       number;
  maxYear:       number;
  minKm:         number;
  maxKm:         number;
  fuels:         string[];
  noAccidentOnly: boolean;
  vehicleGroup:  string;
}

export interface Notification {
  id:        string;
  type:      'offer' | 'message' | 'status' | 'system' | 'moderation' | 'wishlist';
  title:     string;
  body:      string;
  href:      string;
  createdAt: string;
  read:      boolean;
}
