/**
 * API Service Layer
 *
 * Uygulama her ortamda gerçek Supabase projesini kullanır; mock veri katmanı yoktur.
 */

import { createClient } from '@supabase/supabase-js'
import type { LiveAuction, Listing, ListingAttachment, ListingQA, ListingReport, ListingVerification, Notification, SwapOffer } from '../types'
import { validateListingDraft, validateListingValue } from '../lib/listingValidation'
import { validateOfferDraft } from '../lib/offerValidation'
import { trackProductEvent } from '../lib/analytics'

// ─── Supabase client ──────────────────────────────────────────────────────────

const PUBLIC_SUPABASE_URL = 'https://kozvhbepwboaxpksgqaj.supabase.co'
const PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvenZoYmVwd2JvYXhwa3NncWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODg2ODIsImV4cCI6MjA5NTU2NDY4Mn0.qjZxNQxvtnbP_qaWISkS9osE9OMaiFPmWUZQRo3Podo'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
)

// ─── Token helpers (backward compat) ─────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('takaslat_token')
}
export function setToken(t: string) {
  localStorage.setItem('takaslat_token', t)
}
export function removeToken() {
  localStorage.removeItem('takaslat_token')
}
export function clearToken() {
  removeToken()
  void supabase.auth.signOut()
}

// ─── DB row → Frontend tip dönüşümleri ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToListing(row: any): Listing {
  const p = row.owner ?? {}
  return {
    id: row.id,
    listingCode: row.listing_code ?? undefined,
    title: row.title,
    category: row.category,
    estimatedValue: row.estimated_value,
    description: row.description,
    wantedFor: row.wanted_for,
    city: row.city,
    district: row.extra_details?.location?.district ?? undefined,
    images: Array.isArray(row.images) ? row.images : [],
    condition: row.condition,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isActive: row.is_active ?? true,
    moderationStatus: row.moderation_status ?? undefined,
    viewCount: row.view_count ?? 0,
    createdAt: row.created_at,
    videoUrl: row.video_url ?? undefined,
    attachments: row.attachments ?? undefined,
    ownerId: row.owner_id,
    ownerName: p.name ?? '',
    ownerAvatar: p.avatar ?? '',
    ownerRating: p.rating,
    ownerTotalSwaps: p.total_swaps,
    ownerEmailVerified: p.email_verified,
    ownerPhoneVerified: p.phone_verified,
    vehicleDetails: row.brand ? {
      brand: row.brand,
      model: row.model ?? '',
      year: row.year ?? 0,
      km: row.km ?? 0,
      fuel: row.fuel ?? 'Benzin',
      transmission: row.transmission ?? 'Manuel',
      color: row.color ?? '',
      hasAccidentRecord: row.has_accident_record ?? false,
      bodyType: row.body_type ?? undefined,
      engineCC: row.engine_cc ?? undefined,
      hasExpertise: row.extra_details?.vehicleDetails?.hasExpertise ?? undefined,
      expertiseFirm: row.extra_details?.vehicleDetails?.expertiseFirm ?? undefined,
      expertiseDate: row.extra_details?.vehicleDetails?.expertiseDate ?? undefined,
      expertiseNote: row.extra_details?.vehicleDetails?.expertiseNote ?? undefined,
    } : undefined,
    // extra_details iki biçimde olabilir: iç içe { electronicDetails: {...} }
    // (app) veya düz { type, brand, ... } (seed). İkisini de destekle.
    electronicDetails: row.extra_details?.electronicDetails
      ?? (row.category === 'Elektronik' ? row.extra_details : undefined),
    propertyDetails: row.extra_details?.propertyDetails
      ?? (row.category === 'Gayrimenkul' ? row.extra_details : undefined),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToOffer(row: any): SwapOffer {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    fromUserName: row.from_profile?.name ?? '',
    toUserId: row.to_user_id,
    toUserName: row.to_profile?.name ?? '',
    listingId: row.listing_id,
    listingTitle: row.listing?.title ?? '',
    offeredListingId: row.offered_listing_id ?? undefined,
    offeredListingTitle: row.offered_listing_title ?? undefined,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    offeredValue: row.offered_value ?? undefined,
    fromAccepted: row.from_accepted,
    toAccepted: row.to_accepted,
    fromConfirmed: row.from_confirmed,
    toConfirmed: row.to_confirmed,
    counterMessage: row.counter_message ?? undefined,
    meetingNote: row.meeting_note ?? undefined,
    fromRated: row.from_rated,
    toRated: row.to_rated,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: (row.messages ?? []).map((m: any) => ({
      id: m.id,
      fromUserId: m.from_user_id,
      text: m.text,
      createdAt: m.created_at,
    })),
    listing: row.listing ? {
      id: row.listing.id,
      title: row.listing.title,
      estimatedValue: row.listing.estimated_value,
      images: Array.isArray(row.listing.images) ? row.listing.images : [],
      city: row.listing.city,
    } : undefined,
  }
}

function attachmentsForStorage(attachments: ListingAttachment[] | undefined) {
  return attachments?.map((attachment) => (
    attachment.storagePath ? { ...attachment, url: '' } : attachment
  )) ?? null
}

async function signPrivateAttachments(listings: Listing[]): Promise<Listing[]> {
  const paths = [...new Set(
    listings.flatMap((listing) => listing.attachments ?? [])
      .map((attachment) => attachment.storagePath)
      .filter((path): path is string => Boolean(path)),
  )]
  if (paths.length === 0) return listings

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return listings

  const { data, error } = await supabase.storage.from('documents').createSignedUrls(paths, 15 * 60)
  if (error || !data) return listings
  const signedByPath = new Map(data.map((item) => [item.path, item.signedUrl]))

  return listings.map((listing) => ({
    ...listing,
    attachments: listing.attachments?.map((attachment) => ({
      ...attachment,
      url: attachment.storagePath ? signedByPath.get(attachment.storagePath) ?? '' : attachment.url,
    })),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToAuction(row: any): LiveAuction {
  return {
    id: row.id,
    listingId: row.listing_id,
    ownerId: row.owner_id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    startingPrice: Number(row.starting_price),
    currentBid: Number(row.current_bid),
    bidIncrement: Number(row.bid_increment),
    reservePrice: row.reserve_price == null ? undefined : Number(row.reserve_price),
    reserveMet: row.reserve_met ?? undefined,
    winnerId: row.winner_id ?? undefined,
    winningBid: row.winning_bid == null ? undefined : Number(row.winning_bid),
    closedAt: row.closed_at ?? undefined,
    status: row.status,
    watcherCount: row.watcher_count ?? 0,
    createdAt: row.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bids: (row.bids ?? []).map((bid: any) => ({
      id: bid.id,
      userId: bid.user_id,
      userName: bid.bidder?.name ?? 'Katılımcı',
      amount: Number(bid.amount),
      note: bid.note ?? undefined,
      createdAt: bid.created_at,
    })).sort((a: { createdAt: string }, b: { createdAt: string }) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  }
}

type AdminListing = Listing & {
  moderationStatus?: string
  rejectionReason?: string | null
  owner?: { id: string; name: string; email: string }
}

// Admin ekranı genel ilan modeline ek olarak moderasyon ve sahip bilgilerini kullanır.
// Bu alanları normal ilan mapper'ından ayrı tutmak public ekranlara yönetim verisi sızmasını önler.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToAdminListing(row: any): AdminListing {
  return {
    ...dbToListing(row),
    moderationStatus: row.moderation_status ?? 'approved',
    rejectionReason: row.rejection_reason ?? null,
    owner: row.owner ? {
      id: row.owner_id,
      name: row.owner.name ?? '',
      email: row.owner.email ?? '',
    } : undefined,
  }
}

const LISTING_SELECT = `*, owner:profiles!owner_id(name, avatar, rating, total_swaps, email_verified, phone_verified)`
const OFFER_SELECT   = `*, messages(*), listing:listings!listing_id(id, title, estimated_value, images, city), from_profile:profiles!from_user_id(name), to_profile:profiles!to_user_id(name)`
const AUCTION_SELECT = `*, bids:auction_bids(*, bidder:profiles!user_id(name))`
const PROFILE_SELECT = 'id, name, city, avatar, rating, total_swaps, role, email_verified, phone_verified, created_at'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(payload: { name: string; email: string; password: string; city?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: { data: { name: payload.name } },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Kayit basarisiz')

  if (payload.city) {
    await supabase.from('profiles').upsert({ id: data.user.id, name: payload.name, city: payload.city })
  }

  const token = data.session?.access_token ?? ''
  if (token) setToken(token)
  trackProductEvent('sign_up', { method: 'email' })
  return { user: { id: data.user.id, name: payload.name, email: payload.email }, token }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw new Error(error.message);
}

export async function login(email: string, password: string, _twoFactorCode?: string) {
  void _twoFactorCode
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Giris basarisiz')

  const token = data.session?.access_token ?? ''
  if (token) setToken(token)

  const { data: profile } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', data.user.id).single()
  return {
    user: {
      id: data.user.id,
      name: profile?.name ?? email.split('@')[0],
      email: data.user.email,
      city: profile?.city,
      avatar: profile?.avatar,
      rating: profile?.rating,
      totalSwaps: profile?.total_swaps,
      role: profile?.role,
      emailVerified: profile?.email_verified,
      phoneVerified: profile?.phone_verified,
    },
    token,
  }
}

export async function getMe() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', user.id).single()
  if (!profile) return null
  return {
    id: user.id,
    name: profile.name,
    email: user.email,
    city: profile.city,
    avatar: profile.avatar,
    rating: profile.rating,
    totalSwaps: profile.total_swaps,
    role: profile.role,
    emailVerified: profile.email_verified,
    phoneVerified: profile.phone_verified,
  }
}

export async function updateMe(patch: { name?: string; city?: string; avatar?: string; phone?: string }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum acik degil')
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(patch.name   !== undefined && { name: patch.name }),
      ...(patch.city   !== undefined && { city: patch.city }),
      ...(patch.avatar !== undefined && { avatar: patch.avatar }),
      ...(patch.phone  !== undefined && { phone: patch.phone }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) throw new Error(error.message)
  return { ...patch }
}

export async function forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(error.message)
  return { message: 'Sifre sifirlama e-postasi gonderildi' }
}

export async function resetPassword(_email: string, _code: string, password: string): Promise<{ message: string }> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  return { message: 'Sifre basariyla guncellendi' }
}

export async function setupTwoFactor(): Promise<{ message: string; devCode?: string }> { return { message: 'Mock' } }
export async function verifyTwoFactor(_code: string): Promise<Record<string, unknown>> { void _code; return {} }
export async function disableTwoFactor(): Promise<Record<string, unknown>> { return {} }
export async function requestEmailVerification(): Promise<{ message: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) throw new Error('Kullanıcı bulunamadı')
  const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
  if (error) throw new Error(error.message)
  return { message: 'Doğrulama bağlantısı e-postanıza gönderildi' }
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface ListingFilters {
  category?: string
  city?: string
  minValue?: number
  maxValue?: number
  query?: string
  page?: number
  limit?: number
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular'
  brand?: string
  fuel?: string
  minYear?: number
  maxYear?: number
  minKm?: number
  maxKm?: number
  noAccidentOnly?: boolean
  vehicleGroup?: string
  bodyTypes?: string[]
}

export interface ListingPage {
  listings: Listing[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('listings').select(LISTING_SELECT).eq('is_active', true)

  if (filters.category && filters.category !== 'Tümü') q = q.eq('category', filters.category)
  if (filters.city)      q = q.eq('city', filters.city)
  if (filters.minValue)  q = q.gte('estimated_value', filters.minValue)
  if (filters.maxValue && filters.maxValue < 5_000_000) q = q.lte('estimated_value', filters.maxValue)
  if (filters.query) {
    const isCode = /^TKS-\d{7}$/i.test(filters.query.trim())
    if (isCode) {
      q = q.ilike('listing_code', filters.query.trim())
    } else {
      // Birden fazla alanda arama — title, description, brand, model, city
      q = q.or(
        `title.ilike.%${filters.query}%,description.ilike.%${filters.query}%,brand.ilike.%${filters.query}%,model.ilike.%${filters.query}%,city.ilike.%${filters.query}%`
      )
    }
  }
  if (filters.brand)     q = q.eq('brand', filters.brand)
  if (filters.fuel)      q = q.eq('fuel', filters.fuel)
  if (filters.minYear)   q = q.gte('year', filters.minYear)
  if (filters.maxYear)   q = q.lte('year', filters.maxYear)
  if (filters.minKm)     q = q.gte('km', filters.minKm)
  if (filters.maxKm)     q = q.lte('km', filters.maxKm)
  if (filters.noAccidentOnly) q = q.eq('has_accident_record', false)
  if (filters.bodyTypes?.length) q = q.in('body_type', filters.bodyTypes)

  if (filters.sort === 'price_asc')  q = q.order('estimated_value', { ascending: true })
  else if (filters.sort === 'price_desc') q = q.order('estimated_value', { ascending: false })
  else if (filters.sort === 'popular')    q = q.order('view_count', { ascending: false })
  else if (filters.sort === 'oldest')     q = q.order('created_at', { ascending: true })
  else                                    q = q.order('created_at', { ascending: false })

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return signPrivateAttachments((data ?? []).map(dbToListing))
}

export async function fetchListingPage(filters: ListingFilters = {}): Promise<ListingPage> {
  const page  = filters.page  ?? 1
  const limit = filters.limit ?? 12
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('listings').select(LISTING_SELECT, { count: 'exact' }).eq('is_active', true).range(from, to)

  if (filters.category && filters.category !== 'Tümü') q = q.eq('category', filters.category)
  if (filters.city)  q = q.eq('city', filters.city)
  if (filters.query) q = q.or(`title.ilike.%${filters.query}%,brand.ilike.%${filters.query}%,city.ilike.%${filters.query}%`)
  if (filters.brand) q = q.eq('brand', filters.brand)

  if (filters.sort === 'price_asc')  q = q.order('estimated_value', { ascending: true })
  else if (filters.sort === 'price_desc') q = q.order('estimated_value', { ascending: false })
  else q = q.order('created_at', { ascending: false })

  const { data, error, count } = await q
  if (error) throw new Error(error.message)
  const total = count ?? 0
  return { listings: await signPrivateAttachments((data ?? []).map(dbToListing)), total, page, limit, hasMore: from + limit < total }
}

export interface PublicUser {
  id: string; name: string; city?: string; avatar?: string
  rating?: number; totalSwaps?: number; emailVerified?: boolean; phoneVerified?: boolean; createdAt?: string
}

export async function fetchUserById(id: string): Promise<PublicUser | null> {
  const { data } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', id).single()
  if (!data) return null
  return { id: data.id, name: data.name, city: data.city, avatar: data.avatar, rating: data.rating, totalSwaps: data.total_swaps, emailVerified: data.email_verified, phoneVerified: data.phone_verified, createdAt: data.created_at }
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).single()
  if (!data) return null
  void supabase.rpc('increment_listing_view', { p_listing_id: id })
  return (await signPrivateAttachments([dbToListing(data)]))[0] ?? null
}

export async function fetchListingVerification(listingId: string): Promise<ListingVerification | null> {
  const { data, error } = await supabase
    .from('listing_verifications')
    .select('identity_state, ownership_state, vin_state, mileage_state, damage_state, expertise_state, updated_at')
    .eq('listing_id', listingId)
    .maybeSingle()

  if (error || !data) return null
  return {
    identity: data.identity_state,
    ownership: data.ownership_state,
    vin: data.vin_state,
    mileage: data.mileage_state,
    damage: data.damage_state,
    expertise: data.expertise_state,
    updatedAt: data.updated_at,
  }
}

export async function fetchListingByCode(code: string): Promise<Listing | null> {
  const { data } = await supabase.from('listings').select(LISTING_SELECT).ilike('listing_code', code).single()
  return data ? (await signPrivateAttachments([dbToListing(data)]))[0] ?? null : null
}

export async function createListing(data: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing> {
  const validationError = validateListingDraft(data)
  if (validationError) throw new Error(validationError)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum acik degil')

  const num = Math.floor(Math.random() * 9_000_000) + 1_000_000
  const row = {
    listing_code: `TKS-${num}`,
    title: data.title,
    category: data.category,
    estimated_value: data.estimatedValue,
    description: data.description,
    wanted_for: data.wantedFor,
    city: data.city,
    images: data.images,
    condition: data.condition,
    tags: data.tags,
    video_url: data.videoUrl ?? null,
    attachments: attachmentsForStorage(data.attachments),
    owner_id: user.id,
    brand:              data.vehicleDetails?.brand ?? null,
    model:              data.vehicleDetails?.model ?? null,
    year:               data.vehicleDetails?.year ?? null,
    km:                 data.vehicleDetails?.km ?? null,
    fuel:               data.vehicleDetails?.fuel ?? null,
    transmission:       data.vehicleDetails?.transmission ?? null,
    color:              data.vehicleDetails?.color ?? null,
    has_accident_record: data.vehicleDetails?.hasAccidentRecord ?? false,
    body_type:          data.vehicleDetails?.bodyType ?? null,
    engine_cc:          data.vehicleDetails?.engineCC ?? null,
    // Elektronik/Gayrimenkul detayları JSON olarak — dbToListing bunları okur
    extra_details: (data.vehicleDetails || data.electronicDetails || data.propertyDetails || data.district) ? {
      location: data.district ? { district: data.district } : null,
      vehicleDetails: data.vehicleDetails ? {
        hasExpertise: data.vehicleDetails.hasExpertise ?? null,
        expertiseFirm: data.vehicleDetails.expertiseFirm ?? null,
        expertiseDate: data.vehicleDetails.expertiseDate ?? null,
        expertiseNote: data.vehicleDetails.expertiseNote ?? null,
      } : null,
      electronicDetails: data.electronicDetails ?? null,
      propertyDetails:   data.propertyDetails ?? null,
    } : null,
  }
  const { data: inserted, error } = await supabase.from('listings').insert(row).select(LISTING_SELECT).single()
  if (error) throw new Error(error.message)
  const listing = (await signPrivateAttachments([dbToListing(inserted)]))[0]
  trackProductEvent('listing_published', { category: data.category, value: data.estimatedValue })
  return listing
}

export async function updateListingApi(id: string, patch: Partial<Listing>): Promise<Listing> {
  if (patch.estimatedValue !== undefined) {
    const valueError = validateListingValue(patch.estimatedValue)
    if (valueError) throw new Error(valueError)
  }
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.title)                     row.title = patch.title
  if (patch.description)               row.description = patch.description
  if (patch.estimatedValue !== undefined) row.estimated_value = patch.estimatedValue
  if (patch.wantedFor)                 row.wanted_for = patch.wantedFor
  if (patch.city)                      row.city = patch.city
  if (patch.images)                    row.images = patch.images
  if (patch.condition)                 row.condition = patch.condition
  if (patch.tags)                      row.tags = patch.tags
  if (patch.vehicleDetails) {
    row.brand               = patch.vehicleDetails.brand
    row.model               = patch.vehicleDetails.model
    row.year                = patch.vehicleDetails.year
    row.km                  = patch.vehicleDetails.km
    row.fuel                = patch.vehicleDetails.fuel
    row.transmission        = patch.vehicleDetails.transmission
    row.color               = patch.vehicleDetails.color
    row.has_accident_record = patch.vehicleDetails.hasAccidentRecord
    row.body_type           = patch.vehicleDetails.bodyType
    row.engine_cc           = patch.vehicleDetails.engineCC
  }
  if (patch.vehicleDetails || patch.electronicDetails || patch.propertyDetails || patch.district !== undefined) {
    const { data: current } = await supabase
      .from('listings')
      .select('extra_details')
      .eq('id', id)
      .single()
    const currentExtra = current?.extra_details ?? {}
    row.extra_details = {
      ...currentExtra,
      location: patch.district !== undefined
        ? { ...(currentExtra.location ?? {}), district: patch.district || null }
        : currentExtra.location ?? null,
      vehicleDetails: patch.vehicleDetails ? {
        ...(currentExtra.vehicleDetails ?? {}),
        hasExpertise: patch.vehicleDetails.hasExpertise ?? null,
        expertiseFirm: patch.vehicleDetails.expertiseFirm ?? null,
        expertiseDate: patch.vehicleDetails.expertiseDate ?? null,
        expertiseNote: patch.vehicleDetails.expertiseNote ?? null,
      } : currentExtra.vehicleDetails ?? null,
      electronicDetails: patch.electronicDetails ?? currentExtra.electronicDetails ?? null,
      propertyDetails:   patch.propertyDetails ?? currentExtra.propertyDetails ?? null,
    }
  }
  const { data, error } = await supabase.from('listings').update(row).eq('id', id).select(LISTING_SELECT).single()
  if (error) throw new Error(error.message)
  return dbToListing(data)
}

export async function deleteListingApi(id: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function uploadFile(file: File, kind: ListingAttachment['kind'] = 'document'): Promise<ListingAttachment> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Belge boyutu 10 MB sınırını aşıyor')
  const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(file.type)) throw new Error('Yalnızca PDF, JPG, PNG veya WEBP yükleyebilirsin')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Belge yüklemek için giriş yapmalısın')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('documents').upload(path, file, {
    upsert: false,
    contentType: file.type,
  })
  if (error) throw new Error(error.message)
  const { data: signed, error: signError } = await supabase.storage.from('documents').createSignedUrl(path, 15 * 60)
  if (signError) throw new Error(signError.message)
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: signed.signedUrl,
    storagePath: path,
    mimeType: file.type,
    kind,
    size: file.size,
    createdAt: new Date().toISOString(),
  }
}

export async function uploadImages(files: File[]): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Görsel yüklemek için giriş yapmalısın')
  const urls: string[] = []
  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) throw new Error('Görsel boyutu 8 MB sınırını aşıyor')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Yalnızca JPG, PNG veya WEBP görsel yükleyebilirsin')
    }
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/listings/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('images').upload(path, file, { upsert: false })
    if (error) throw new Error(error.message)
    const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
    urls.push(publicUrl)
  }
  return urls
}

// ─── Auctions ─────────────────────────────────────────────────────────────────

export async function fetchAuctions(): Promise<LiveAuction[]> {
  await supabase.rpc('finalize_expired_auctions')
  const { data, error } = await supabase
    .from('auctions')
    .select(AUCTION_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(dbToAuction)
}

export async function createAuctionApi(
  auction: Omit<LiveAuction, 'id' | 'createdAt' | 'bids' | 'currentBid' | 'watcherCount'>,
): Promise<LiveAuction> {

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Mezat başlatmak için giriş yapmalısın')
  const { data, error } = await supabase
    .from('auctions')
    .insert({
      listing_id: auction.listingId,
      owner_id: user.id,
      title: auction.title,
      starts_at: auction.startsAt,
      ends_at: auction.endsAt,
      starting_price: auction.startingPrice,
      current_bid: auction.startingPrice,
      bid_increment: auction.bidIncrement,
      reserve_price: auction.reservePrice ?? null,
      status: auction.status,
    })
    .select(AUCTION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return dbToAuction(data)
}

export async function placeAuctionBidApi(
  auctionId: string,
  amount: number,
  note?: string,
): Promise<LiveAuction> {

  const { data, error } = await supabase.rpc('place_auction_bid', {
    p_auction_id: auctionId,
    p_amount: amount,
    p_note: note ?? null,
  })
  if (error) throw new Error(error.message)
  return dbToAuction(data)
}

export async function closeAuctionApi(auctionId: string): Promise<LiveAuction> {
  const { data, error } = await supabase.rpc('finalize_auction', {
    p_auction_id: auctionId,
  })
  if (error) throw new Error(error.message)
  return dbToAuction(data)
}

export function subscribeAuctionStream(onChange: () => void): () => void {
  const channel = supabase
    .channel(`auctions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids' }, onChange)
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function fetchOffers(userId: string): Promise<SwapOffer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(dbToOffer)
}

async function fetchOfferById(offerId: string): Promise<SwapOffer> {
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .eq('id', offerId)
    .single()
  if (error) throw new Error(error.message)
  return dbToOffer(data)
}

export async function createOffer(data: Omit<SwapOffer, 'id' | 'createdAt'>): Promise<SwapOffer> {
  const validate = (actorId: string | undefined) => validateOfferDraft({
    actorId,
    targetOwnerId: data.toUserId,
    targetListingId: data.listingId,
    offeredListingId: data.offeredListingId,
    message: data.message,
    offeredValue: data.offeredValue,
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Teklif göndermek için giriş yapmalısınız')

  const validationError = validate(user.id)
  if (validationError) throw new Error(validationError)

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidPattern.test(data.listingId) || !uuidPattern.test(data.toUserId)) {
    throw new Error('İlan veya kullanıcı bilgisi geçersiz. Sayfayı yenileyip tekrar deneyin')
  }
  if (data.offeredListingId && !uuidPattern.test(data.offeredListingId)) {
    throw new Error('Teklif edilen ilan bilgisi geçersiz')
  }

  const { data: inserted, error } = await supabase.rpc('create_offer', {
    p_listing_id: data.listingId,
    p_message: data.message.trim(),
    p_offered_value: data.offeredValue ?? null,
    p_offered_listing_id: data.offeredListingId ?? null,
  })
  if (error) throw new Error(error.message)
  const insertedOffer = Array.isArray(inserted) ? inserted[0] : inserted
  if (!insertedOffer?.id) throw new Error('Teklif oluşturulamadı')
  trackProductEvent('offer_sent', { has_listing: Boolean(data.offeredListingId), has_cash: Boolean(data.offeredValue) })
  return fetchOfferById(insertedOffer.id)
}

export async function updateOfferStatus(offerId: string, status: SwapOffer['status'], meetingNote?: string): Promise<SwapOffer> {
  const rpcName = status === 'Onaylandı' ? 'accept_offer' : 'update_offer_status'
  const args = status === 'Onaylandı'
    ? { p_offer_id: offerId }
    : { p_offer_id: offerId, p_status: status, p_meeting_note: meetingNote ?? null }
  const { error } = await supabase.rpc(rpcName, args)
  if (error) throw new Error(error.message)
  return fetchOfferById(offerId)
}

export async function confirmOfferComplete(offerId: string): Promise<SwapOffer> {
  const { error } = await supabase.rpc('confirm_offer_complete', { p_offer_id: offerId })
  if (error) throw new Error(error.message)
  const offer = await fetchOfferById(offerId)
  if (offer.status === 'Tamamlandı') trackProductEvent('swap_completed')
  return offer
}

export async function rateOffer(offerId: string, score: number, comment?: string): Promise<{ success: boolean; newRating: number }> {
  const { data, error } = await supabase.rpc('rate_offer', {
    p_offer_id: offerId,
    p_score: score,
    p_comment: comment ?? null,
  })
  if (error) throw new Error(error.message)
  return { success: true, newRating: Number(data) }
}

export async function createListingReport(
  listingId: string,
  reason: string,
  details?: string,
): Promise<ListingReport> {
  const cleanDetails = details?.trim() || undefined
  if (!listingId || !reason || (cleanDetails?.length ?? 0) > 1000) {
    throw new Error('Geçersiz şikayet bilgisi')
  }
  const { data, error } = await supabase.rpc('create_listing_report', {
    p_listing_id: listingId,
    p_reason: reason,
    p_details: cleanDetails ?? null,
  })
  if (error) throw new Error(error.message)
  return {
    id: data.id,
    listingId: data.listing_id,
    reason: data.reason,
    details: data.details ?? undefined,
    createdAt: data.created_at,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToListingQA(row: any): ListingQA {
  const user = row.user ?? {}
  return {
    id: row.id,
    listingId: row.listing_id,
    userId: row.user_id,
    userName: user.name ?? 'Kullanıcı',
    question: row.question,
    answer: row.answer ?? undefined,
    answeredAt: row.answered_at ?? undefined,
    createdAt: row.created_at,
  }
}

export async function fetchListingQuestions(listingId: string): Promise<ListingQA[]> {
  const { data, error } = await supabase
    .from('listing_questions')
    .select('id, listing_id, user_id, question, answer, answered_at, created_at, user:profiles!user_id(name)')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(dbToListingQA)
}

export async function createListingQuestion(listingId: string, question: string): Promise<void> {
  const cleanQuestion = question.trim()
  if (cleanQuestion.length < 5 || cleanQuestion.length > 500) {
    throw new Error('Soru 5 ile 500 karakter arasında olmalıdır')
  }
  const { error } = await supabase.rpc('create_listing_question', {
    p_listing_id: listingId,
    p_question: cleanQuestion,
  })
  if (error) throw new Error(error.message)
}

export async function answerListingQuestion(questionId: string, answer: string): Promise<void> {
  const cleanAnswer = answer.trim()
  if (cleanAnswer.length < 2 || cleanAnswer.length > 1000) {
    throw new Error('Yanıt 2 ile 1000 karakter arasında olmalıdır')
  }
  const { error } = await supabase.rpc('answer_listing_question', {
    p_question_id: questionId,
    p_answer: cleanAnswer,
  })
  if (error) throw new Error(error.message)
}

export async function deleteListingQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_listing_question', { p_question_id: questionId })
  if (error) throw new Error(error.message)
}

export async function reviseOfferApi(offerId: string, patch: { offeredValue?: number; offeredListingId?: string; offeredListingTitle?: string }): Promise<SwapOffer> {
  if (patch.offeredValue !== undefined && (!Number.isSafeInteger(patch.offeredValue) || patch.offeredValue < 0 || patch.offeredValue > 2_000_000_000)) {
    throw new Error('Teklif değeri geçersiz')
  }
  const { error } = await supabase.rpc('revise_offer', {
    p_offer_id: offerId,
    p_offered_value: patch.offeredValue ?? null,
    p_offered_listing_id: patch.offeredListingId ?? null,
    p_offered_listing_title: patch.offeredListingTitle ?? null,
  })
  if (error) throw new Error(error.message)
  return fetchOfferById(offerId)
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function sendMessage(offerId: string, text: string) {
  const cleanText = text.trim()
  if (cleanText.length < 1 || cleanText.length > 4000) throw new Error('Mesaj 1 ile 4000 karakter arasında olmalıdır')
  const { data, error } = await supabase.rpc('send_offer_message', {
    p_offer_id: offerId,
    p_text: cleanText,
  })
  if (error) throw new Error(error.message)
  const message = Array.isArray(data) ? data[0] : data
  if (!message?.id) throw new Error('Mesaj gönderilemedi')
  const conversationKey = `takaslat-conversation-started:${offerId}`
  if (!sessionStorage.getItem(conversationKey)) {
    sessionStorage.setItem(conversationKey, '1')
    trackProductEvent('conversation_started')
  }
  return { id: message.id, text: message.text, createdAt: message.created_at }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((n: any) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, createdAt: n.created_at, read: n.read }))
}

export async function markNotificationsReadApi(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_read')
  if (error) throw new Error(error.message)
}

export async function sendTestNotification(): Promise<Notification> {
  return { id: `notif-${Date.now()}`, type: 'system', title: 'Test', body: 'Test bildirimi', href: '/', createdAt: new Date().toISOString(), read: false }
}

// ─── Realtime (Supabase channels) ────────────────────────────────────────────

export interface RawMessageEvent { _event: 'newMessage'; offerId: string; id: string; text: string; fromUserId: string; fromUserName: string; createdAt: string }
export interface OfferStatusEvent { _event: 'offerStatus'; offerId: string; status: string }

export function subscribeNotificationStream(
  onNotification: (notification: Notification) => void,
  _onMessageEvent?: (event: RawMessageEvent) => void,
  _onOfferStatusEvent?: (event: OfferStatusEvent) => void,
): () => void {
  void _onMessageEvent
  void _onOfferStatusEvent
  // Benzersiz kanal adı: aynı topic'e iki kez abone olup
  // "cannot add postgres_changes after subscribe()" hatasını önler
  const channelName = `notifications-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = payload.new as any
      onNotification({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, createdAt: n.created_at, read: false })
    })
    .subscribe()
  return () => { void supabase.removeChannel(channel) }
}

// ─── AI (DeepSeek edge function) ─────────────────────────────────────────────

// Tüm AI çağrıları için ortak yardımcı: edge function'a action+payload yollar.
async function invokeAI<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ai', { body: { action, payload } })
  if (error) {
    // FunctionsHttpError: gerçek hata gövdesi error.context (Response) içinde — onu oku
    let detail = error.message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context
    if (ctx && typeof ctx.json === 'function') {
      try { const body = await ctx.json(); if (body?.error) detail = body.error } catch { /* */ }
    }
    throw new Error(detail)
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error ?? 'AI servisi yanıt vermedi')
  }
  return data as T
}

// AI hatasını kullanıcı dostu Türkçe mesaja çevirir; ham detayı konsola yazar (debug).
export function aiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Kota mesajı zaten kullanıcı dostu (edge function'dan), olduğu gibi göster
  if (/limit doldu/i.test(raw)) return raw
  // Anahtar / bakiye / DeepSeek tarafı — teknik detayı gizle
  if (/DEEPSEEK_API_KEY|DeepSeek hata|401|402|403|insufficient|balance|invalid api/i.test(raw)) {
    console.error('[AI] servis hatası:', raw)
    return 'AI servisi şu an yanıt veremiyor. Lütfen biraz sonra tekrar dene.'
  }
  // Bağlantı / fonksiyon erişimi
  if (/non-2xx|Failed to fetch|NetworkError|Functions|fetch|timeout/i.test(raw)) {
    console.error('[AI] bağlantı hatası:', raw)
    return 'AI servisine ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.'
  }
  return raw || 'AI işlemi tamamlanamadı, tekrar dene.'
}

export async function queryAI(_p: { query: string; currentListingId?: string | null; conversation?: { role: 'user' | 'assistant'; content: string; candidateIds?: string[] }[] }): Promise<Record<string, unknown>> { void _p; return {} }

// TakaslAI sohbet — LLM yanıtı + gerçek ilan önerileri.
// Hata durumunda fırlatır; çağıran (AIAssistant) yerel motora düşer.
export interface AIChatResult {
  message: string;
  suggestions: { listingId: string; compatibilityScore: number; reasons: string[]; priceDiff: number; negotiationTip: string }[];
}
export async function aiChat(p: {
  query: string;
  currentListing?: { id: string; title: string; value: number; category: string } | null;
  listings: { id: string; title: string; value: number; city: string; category: string; brand?: string; model?: string; year?: number; km?: number; fuel?: string }[];
}): Promise<AIChatResult> {
  return invokeAI<AIChatResult>('chat', p as unknown as Record<string, unknown>)
}

export async function aiDescribe(p: { brand: string; model: string; year: number; km?: number; fuel?: string; transmission?: string; color?: string; bodyType?: string; hasAccidentRecord?: boolean; condition?: string; city?: string }): Promise<{ description: string; basedOnSimilar: number }> {
  const data = await invokeAI<{ description?: string; basedOnSimilar?: number }>('describe', p)
  if (!data.description) throw new Error('AI açıklama üretemedi (boş yanıt)')
  return { description: data.description, basedOnSimilar: data.basedOnSimilar ?? 0 }
}

export interface ValueForecast { listingId: string; title: string; currentValue: number; months: { month: number; value: number; label: string }[]; summary: { after6m: number; after12m: number; totalChange6m: number; totalChange12m: number; monthlyDepreciation: number; inflationAdjust: number }; factors: string[]; recommendation: string }
export async function aiForecast(id: string): Promise<ValueForecast> {
  return invokeAI<ValueForecast>('forecast', { id })
}

export interface Deal { listingId: string; title: string; city: string; category: string; image: string; price: number; avgPrice: number; saving: number; savingPct: number; ownerName: string }
export async function fetchDeals(): Promise<{ deals: Deal[]; totalAnalyzed: number }> {
  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('is_active', true)
  const all = (data ?? []).map(dbToListing)
  // Benzer ilanları grupla (kategori|marka|model), ortalamanın altındakileri fırsat say
  const groups = new Map<string, Listing[]>()
  for (const l of all) {
    const v = l.vehicleDetails
    const key = `${l.category}|${v?.brand ?? ''}|${v?.model ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), l])
  }
  const deals: Deal[] = []
  for (const l of all) {
    const v = l.vehicleDetails
    const peers = groups.get(`${l.category}|${v?.brand ?? ''}|${v?.model ?? ''}`) ?? [l]
    if (peers.length < 2) continue
    const avg = peers.reduce((s, p) => s + p.estimatedValue, 0) / peers.length
    const savingPct = Math.round((1 - l.estimatedValue / avg) * 100)
    if (savingPct >= 8) {
      deals.push({
        listingId: l.id, title: l.title, city: l.city, category: l.category,
        image: l.images[0] ?? '', price: l.estimatedValue, avgPrice: Math.round(avg),
        saving: Math.round(avg - l.estimatedValue), savingPct, ownerName: l.ownerName,
      })
    }
  }
  deals.sort((a, b) => b.savingPct - a.savingPct)
  return { deals: deals.slice(0, 20), totalAnalyzed: all.length }
}

export interface BudgetResult { budget: number; inBudgetCount: number; stretchCount: number; byCategory: { name: string; count: number }[]; inBudget: { listingId: string; title: string; city: string; category: string; image: string; price: number; utilization: number; ownerName: string }[]; stretch: { listingId: string; title: string; city: string; image: string; price: number; overBy: number }[] }
export async function aiBudget(p: { budget: number; category?: string; city?: string }): Promise<BudgetResult> {
  return invokeAI<BudgetResult>('budget', p)
}

export interface HomeMatchResult {
  message: string;
  interpreted: Record<string, unknown>;
  source?: { id: string; title: string; value: number } | null;
  suggestions: {
    listingId: string;
    title: string;
    city: string;
    value: number;
    compatibilityScore: number;
    priceDiff: number | null;
    reasons: string[];
    cashNote: string;
    negotiationTip: string;
  }[];
}

type HomeMatchParams = {
  query: string;
  sourceListingId?: string;
  cashDirection?: 'any' | 'pay' | 'receive';
  cashAmount?: number;
};

function normalizeMatchText(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function buildHomeMatchFallback(
  p: HomeMatchParams,
  listings: Listing[],
  currentUserId?: string | null,
): HomeMatchResult {
  const query = normalizeMatchText(p.query);
  const source = listings.find((listing) => listing.id === p.sourceListingId) ?? null;
  const mileageMatch = query.match(/(\d[\d.\s]*)\s*km\b/);
  const rawMileage = mileageMatch ? Number(mileageMatch[1].replace(/[.\s]/g, '')) : null;
  const maxKm = rawMileage && rawMileage <= 1_000 ? rawMileage * 1_000 : rawMileage;
  const yearMatch = query.match(/\b((?:19|20)\d{2})\b/);
  const minYear = yearMatch && /(ustu|sonrasi|ve yeni|en az)/.test(query) ? Number(yearMatch[1]) : null;
  const transmission = query.includes('otomatik') ? 'otomatik' : query.includes('manuel') ? 'manuel' : null;
  const noAccident = /hasarsiz|hasar kaydi yok/.test(query);
  const bodyTypes = ['sedan', 'suv', 'hatchback', 'station wagon', 'coupe', 'pickup', 'cabrio'];
  const bodyType = bodyTypes.find((value) => query.includes(value)) ?? null;
  const fuels = ['benzin', 'dizel', 'hibrit', 'elektrik', 'lpg'];
  const fuel = fuels.find((value) => query.includes(value)) ?? null;
  const brands = [...new Set(listings.map((listing) => listing.vehicleDetails?.brand).filter(Boolean) as string[])];
  const brand = brands.find((value) => query.includes(normalizeMatchText(value))) ?? null;
  const stopWords = new Set([
    'alti', 'altinda', 'ustu', 'ustunde', 'arac', 'araba', 'ilan', 'istiyorum',
    'ariyorum', 've', 'ile', 'bir', 'olan', 'olsun', 'km', 'model',
  ]);
  const terms = query
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stopWords.has(term) && !/^\d+$/.test(term));

  const candidates = listings
    .filter((listing) => listing.id !== source?.id)
    .filter((listing) => !currentUserId || listing.ownerId !== currentUserId)
    .filter((listing) => {
      const vehicle = listing.vehicleDetails;
      if (maxKm !== null && (!vehicle?.km || vehicle.km > maxKm)) return false;
      if (minYear !== null && (!vehicle?.year || vehicle.year < minYear)) return false;
      if (transmission && normalizeMatchText(vehicle?.transmission ?? '') !== transmission) return false;
      if (noAccident && vehicle?.hasAccidentRecord) return false;
      if (bodyType && !normalizeMatchText(vehicle?.bodyType ?? '').includes(bodyType)) return false;
      if (fuel && !normalizeMatchText(vehicle?.fuel ?? '').includes(fuel)) return false;
      if (brand && normalizeMatchText(vehicle?.brand ?? '') !== normalizeMatchText(brand)) return false;
      if (source && p.cashAmount && p.cashDirection && p.cashDirection !== 'any') {
        const difference = listing.estimatedValue - source.estimatedValue;
        const tolerance = p.cashAmount * 1.15;
        if (p.cashDirection === 'pay' && (difference < 0 || difference > tolerance)) return false;
        if (p.cashDirection === 'receive' && (difference > 0 || Math.abs(difference) > tolerance)) return false;
      }
      return true;
    })
    .map((listing) => {
      const vehicle = listing.vehicleDetails;
      const haystack = normalizeMatchText([
        listing.title,
        listing.description,
        listing.wantedFor,
        listing.city,
        vehicle?.brand,
        vehicle?.model,
        vehicle?.fuel,
        vehicle?.transmission,
        vehicle?.bodyType,
      ].filter(Boolean).join(' '));
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      let score = 48 + Math.min(20, matchedTerms.length * 5);
      const reasons: string[] = [];

      if (source) {
        const ratio = Math.abs(listing.estimatedValue - source.estimatedValue) / Math.max(source.estimatedValue, 1);
        score += Math.max(0, 28 - Math.round(ratio * 35));
        if (listing.category === source.category) score += 8;
        if (listing.city === source.city) {
          score += 6;
          reasons.push('Aynı şehir');
        }
      }
      if (brand) reasons.push(`${brand} eşleşmesi`);
      if (maxKm !== null) reasons.push(`${maxKm.toLocaleString('tr-TR')} km altında`);
      if (minYear !== null) reasons.push(`${minYear} ve üzeri`);
      if (transmission) reasons.push('Otomatik vites');
      if (noAccident) reasons.push('Hasar kaydı yok');
      if (bodyType) reasons.push(`${bodyType.toUpperCase()} kasa`);
      if (fuel) reasons.push(`${fuel} yakıt`);
      if (reasons.length === 0 && matchedTerms.length > 0) reasons.push('Arama ifadenle uyumlu');
      if (reasons.length === 0) reasons.push('Değer ve kategori uyumu');

      const priceDiff = source ? listing.estimatedValue - source.estimatedValue : null;
      return {
        listing,
        score: Math.max(45, Math.min(97, score)),
        priceDiff,
        reasons: reasons.slice(0, 4),
      };
    })
    .sort((a, b) => b.score - a.score || Math.abs(a.priceDiff ?? 0) - Math.abs(b.priceDiff ?? 0))
    .slice(0, 6);

  return {
    message: candidates.length > 0
      ? `Kriterlerine uygun ${candidates.length} ilan buldum.`
      : 'Bu kriterlerle uygun aktif ilan bulamadım. Kilometre veya fiyat farkı aralığını genişletmeyi deneyebilirsin.',
    interpreted: { maxKm, minYear, transmission, noAccident, bodyType, fuel, brand },
    source: source ? { id: source.id, title: source.title, value: source.estimatedValue } : null,
    suggestions: candidates.map(({ listing, score, priceDiff, reasons }) => ({
      listingId: listing.id,
      title: listing.title,
      city: listing.city,
      value: listing.estimatedValue,
      compatibilityScore: score,
      priceDiff,
      reasons,
      cashNote: priceDiff === null
        ? ''
        : priceDiff === 0
          ? 'Değerler birbirine çok yakın.'
          : `${Math.abs(priceDiff).toLocaleString('tr-TR')} TL civarında fark oluşabilir.`,
      negotiationTip: 'Tekliften önce bakım, hasar ve ekspertiz bilgilerini karşılıklı doğrulayın.',
    })),
  };
}

export async function aiHomeMatch(p: {
  query: string;
  sourceListingId?: string;
  cashDirection?: 'any' | 'pay' | 'receive';
  cashAmount?: number;
}, fallbackListings: Listing[] = [], currentUserId?: string | null): Promise<HomeMatchResult> {
  try {
    return await invokeAI<HomeMatchResult>('homeMatch', p as unknown as Record<string, unknown>)
  } catch (error) {
    if (fallbackListings.length === 0) throw error
    console.warn('[AI] homeMatch yerel eşleştirmeye geçti:', error)
    return buildHomeMatchFallback(p, fallbackListings, currentUserId)
  }
}

export interface NegotiationAnalysis { analysis: { tone: 'agresif' | 'pasif' | 'dengeli'; toneReason: string; length: { score: number; note: string }; positives: string[]; negatives: string[]; overallScore: number }; possibilities: { probability: number; type: 'kabul' | 'pazarlik' | 'red'; message: string; reason: string }[]; tips: string[] }
export async function aiNegotiate(p: { myMessage: string; listingId?: string; offeredValue?: number }): Promise<NegotiationAnalysis> {
  return invokeAI<NegotiationAnalysis>('negotiate', p)
}

export async function aiEstimateValue(p: { brand: string; model?: string; year?: number; km?: number; hasAccidentRecord?: boolean }): Promise<{ estimated: number | null; low: number | null; high: number | null; basedOn: number; message: string }> {
  const data = await invokeAI<{ estimated?: number | null; low?: number | null; high?: number | null; basedOn?: number; message?: string }>('estimate', p)
  return { estimated: data.estimated ?? null, low: data.low ?? null, high: data.high ?? null, basedOn: data.basedOn ?? 0, message: data.message ?? '' }
}

export interface SwapAdvice { message: string; candidates: { listingId: string; title: string; city: string; value: number; score: number }[]; tips: string[]; suggestedMessage: string }
export async function aiSwapAdvice(p: { listingId?: string; userText: string }): Promise<SwapAdvice> {
  return invokeAI<SwapAdvice>('swapAdvice', p)
}

export interface SwapScoreResult { source: { id: string; title: string; value: number }; suggestions: { listingId: string; title: string; city: string; value: number; compatibilityScore: number; priceDiff: number; breakdown: Record<string, number>; reasons: string[]; warnings: string[]; negotiationTip: string }[] }
export async function aiSwapScore(p: { sourceListingId: string; targetListingId?: string }): Promise<SwapScoreResult> {
  return invokeAI<SwapScoreResult>('swapScore', p)
}

export interface PriceGapResult { rawDiff: number; payer: 'sourceUser' | 'targetUser' | 'none'; fairRange: { min: number; max: number }; verdict: string; explanation: string }
export async function aiPriceGap(p: { sourceListingId?: string; targetListingId?: string; sourceValue?: number; targetValue?: number }): Promise<PriceGapResult> {
  return invokeAI<PriceGapResult>('priceGap', p)
}

export interface OfferQualityResult { score: number; positives: string[]; issues: string[]; improvedMessage: string }
export async function aiOfferQuality(p: { message: string; listingId?: string; offeredListingId?: string; offeredValue?: number }): Promise<OfferQualityResult> {
  return invokeAI<OfferQualityResult>('offerQuality', p)
}

export async function aiAutoMessage(p: { sourceListingId?: string; targetListingId: string; tone?: 'samimi' | 'profesyonel' | 'kisa' }): Promise<{ message: string; diff: number | null }> {
  return invokeAI<{ message: string; diff: number | null }>('autoMessage', p)
}

export async function aiPersonalFeed(p: { favoriteIds: string[]; searchHistory: string[]; wishlistTerms: string[] }): Promise<{ items: { listingId: string; title: string; city: string; value: number; score: number; reasons: string[] }[]; profileSignals: string[] }> {
  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('is_active', true)
  const all = (data ?? []).map(dbToListing)
  const favs = all.filter((l) => p.favoriteIds.includes(l.id))
  const favBrands = new Set(favs.map((l) => l.vehicleDetails?.brand).filter(Boolean) as string[])
  const favCats = new Set(favs.map((l) => l.category))
  const terms = [...p.searchHistory, ...p.wishlistTerms].join(' ').toLowerCase().split(/\s+/).filter((t) => t.length > 2)

  const signals: string[] = []
  if (favBrands.size) signals.push(`Sevdiğin markalar: ${[...favBrands].join(', ')}`)
  if (favCats.size)   signals.push(`İlgi alanın: ${[...favCats].join(', ')}`)
  if (terms.length)   signals.push(`Aramaların: ${terms.slice(0, 5).join(', ')}`)

  const items = all
    .filter((l) => !p.favoriteIds.includes(l.id))
    .map((l) => {
      const v = l.vehicleDetails
      let score = 0; const reasons: string[] = []
      if (v?.brand && favBrands.has(v.brand)) { score += 40; reasons.push(`${v.brand} ilgini çekiyor`) }
      if (favCats.has(l.category))            { score += 20; reasons.push(`${l.category} kategorisi`) }
      const hay = `${l.title} ${v?.brand ?? ''} ${v?.model ?? ''} ${l.city}`.toLowerCase()
      if (terms.some((t) => hay.includes(t)))  { score += 25; reasons.push('Aramalarına uygun') }
      return { listingId: l.id, title: l.title, city: l.city, value: l.estimatedValue, score, reasons }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return { items, profileSignals: signals }
}

export async function aiConversationCoach(p: { lastMessage: string; listingId?: string }): Promise<{ intent: string; caution: string; replies: string[]; nextBestAction: string }> {
  return invokeAI('conversationCoach', p)
}

export async function aiRisk(p: { listingId: string }): Promise<{ riskScore: number; level: string; risks: string[]; positives: string[]; checklist: string[] }> {
  return invokeAI('risk', p)
}

export async function aiListingQuality(p: { listingId?: string; draft?: Record<string, unknown> }): Promise<{ score: number; grade: string; fixes: string[]; improvedDescription: string }> {
  const data = await invokeAI<{ score?: number; grade?: string; fixes?: string[]; improvedDescription?: string }>('quality', p)
  return { score: data.score ?? 60, grade: data.grade ?? 'B', fixes: data.fixes ?? [], improvedDescription: data.improvedDescription ?? '' }
}

export async function aiMarketInsights(): Promise<{ hotBrands: { brand: string; count: number; avgValue: number; demandScore: number }[]; cityPremiums: { city: string; count: number; avgValue: number }[]; insight: string }> {
  return invokeAI('marketInsights')
}

export async function aiScenarios(p: { sourceListingId?: string; targetText: string; maxCashDiff?: number }): Promise<{ summary: string; scenarios: { name: string; difficulty: string; plan: string; bestFor: string }[] }> {
  return invokeAI('scenarios', p)
}

export async function aiVisualDescription(p: { fileName: string; mimeType: string; size: number }): Promise<{ summary: string; checks: string[]; risks: string[] }> {
  return invokeAI('visualDescription', p as unknown as Record<string, unknown>)
}

// ─── Trends ───────────────────────────────────────────────────────────────────

export interface TrendsData { totalListings: number; avgPrice: number; totalValue: number; recent7d: number; topBrands: { brand: string; count: number; views: number; avgPrice: number; score: number }[]; categories: { name: string; count: number }[]; topCities: { name: string; count: number }[]; fuels: { name: string; count: number }[] }

export async function fetchTrends(): Promise<TrendsData> {
  const { data } = await supabase.from('listings').select('estimated_value, brand, category, city, fuel, created_at').eq('is_active', true)
  const ls = data ?? []
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const group = <T extends string>(arr: T[]) => arr.reduce((acc, v) => { acc[v] = (acc[v] ?? 0) + 1; return acc }, {} as Record<string, number>)
  return {
    totalListings: ls.length,
    avgPrice:      ls.length ? Math.round(ls.reduce((s, l) => s + l.estimated_value, 0) / ls.length) : 0,
    totalValue:    ls.reduce((s, l) => s + l.estimated_value, 0),
    recent7d:      ls.filter(l => new Date(l.created_at) > week).length,
    topBrands:     Object.entries(group(ls.filter(l => l.brand).map(l => l.brand!))).map(([brand, count]) => ({ brand, count, views: 0, avgPrice: 0, score: count })).sort((a, b) => b.count - a.count).slice(0, 5),
    categories:    Object.entries(group(ls.map(l => l.category))).map(([name, count]) => ({ name, count })),
    topCities:     Object.entries(group(ls.map(l => l.city))).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    fuels:         Object.entries(group(ls.filter(l => l.fuel).map(l => l.fuel!))).map(([name, count]) => ({ name, count })),
  }
}

// ─── Dev / Admin ──────────────────────────────────────────────────────────────


export interface AdminStats { users: number; listings: number; pendingListings: number; offers: number; reports: number; notifications: number; recentListings: Array<Listing & { owner?: { id: string; name: string; email: string } }> }
export async function fetchAdminStats(): Promise<AdminStats> {
  const { data: stats, error } = await supabase.rpc('admin_get_stats')
  if (error) throw new Error(error.message)
  const { data: recent } = await supabase.from('listings').select(LISTING_SELECT).order('created_at', { ascending: false }).limit(5)
  return {
    users: Number(stats?.users ?? 0),
    listings: Number(stats?.listings ?? 0),
    pendingListings: Number(stats?.pending_listings ?? 0),
    offers: Number(stats?.offers ?? 0),
    reports: Number(stats?.reports ?? 0),
    notifications: Number(stats?.notifications ?? 0),
    recentListings: (recent ?? []).map(dbToListing),
  }
}

export async function fetchAdminListings(status?: string): Promise<Array<Listing & { owner?: { id: string; name: string; email: string } }>> {
  const { data, error } = await supabase.rpc('admin_get_listings', {
    p_status: status || null,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map(dbToAdminListing)
}

export async function moderateListing(id: string, status: 'pending' | 'approved' | 'rejected', reason?: string) {
  const { error } = await supabase.rpc('admin_moderate_listing', {
    p_listing_id: id,
    p_status: status,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(error.message)
  return { success: true }
}

export interface AdminUser { id: string; name: string; email: string; role: string; emailVerified: boolean; phoneVerified: boolean; rating: number; totalSwaps: number; createdAt: string; _count: { listings: number; sentOffers: number } }
export async function fetchAdminUsers(search?: string): Promise<AdminUser[]> {
  const { data: profiles, error } = await supabase.rpc('admin_get_users', { p_search: search ?? null })
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (profiles ?? []).map((p: any) => ({
    id: p.id, name: p.name ?? '', email: p.email ?? '',
    role: (p.role ?? 'user').toUpperCase(),
    emailVerified: !!p.email_verified, phoneVerified: !!p.phone_verified,
    rating: p.rating ?? 0, totalSwaps: p.total_swaps ?? 0, createdAt: p.created_at,
    _count: { listings: Number(p.listing_count ?? 0), sentOffers: Number(p.offer_count ?? 0) },
  }))
}

export async function setUserRole(userId: string, role: 'USER' | 'ADMIN' | 'MODERATOR') {
  const { error } = await supabase.rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role.toLowerCase(),
  })
  if (error) throw new Error(error.message)
  return { success: true }
}

export async function banUser(userId: string) {
  // Şemada ban kolonu yok — kullanıcının tüm ilanları pasif yapılır
  const { error } = await supabase.rpc('admin_ban_user', { p_user_id: userId })
  if (error) throw new Error(error.message)
  return { success: true }
}
