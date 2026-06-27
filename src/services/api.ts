/**
 * API Service Layer
 *
 * VITE_SUPABASE_URL tanımlıysa → Supabase (gerçek DB + Auth)
 * Tanımlı değilse               → mock data (demo modu)
 */

import { createClient } from '@supabase/supabase-js'
import { mockListings, mockOffers } from '../data/mockListings'
import type { Listing, ListingAttachment, Notification, SwapOffer } from '../types'

// ─── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const USE_MOCK = !SUPABASE_URL || !SUPABASE_KEY

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_KEY || 'placeholder',
)

// ─── Token helpers (backward compat) ─────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('takaslat_token')
}
export function setToken(t: string) {
  localStorage.setItem('takaslat_token', t)
}
export function clearToken() {
  localStorage.removeItem('takaslat_token')
  if (!USE_MOCK) supabase.auth.signOut()
}

const delay = (ms = 250) => new Promise(r => setTimeout(r, ms))

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
    images: Array.isArray(row.images) ? row.images : [],
    condition: row.condition,
    tags: Array.isArray(row.tags) ? row.tags : [],
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
    } : undefined,
    electronicDetails: row.extra_details?.electronicDetails,
    propertyDetails: row.extra_details?.propertyDetails,
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

const LISTING_SELECT = `*, owner:profiles!owner_id(name, avatar, rating, total_swaps, email_verified, phone_verified)`
const OFFER_SELECT   = `*, messages(*), listing:listings!listing_id(id, title, estimated_value, images, city), from_profile:profiles!from_user_id(name), to_profile:profiles!to_user_id(name)`

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(payload: { name: string; email: string; password: string; city?: string }) {
  if (USE_MOCK) {
    await delay(400)
    return { user: { id: 'mock-user', name: payload.name, email: payload.email }, token: 'mock-token' }
  }
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
  if (USE_MOCK) {
    await delay(300)
    return { user: { id: 'mock-user', name: 'Demo' }, token: 'mock-token' }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Giris basarisiz')

  const token = data.session?.access_token ?? ''
  if (token) setToken(token)

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
  return {
    user: {
      id: data.user.id,
      name: profile?.name ?? email.split('@')[0],
      email: data.user.email,
      city: profile?.city,
      avatar: profile?.avatar,
      rating: profile?.rating,
      totalSwaps: profile?.total_swaps,
    },
    token,
  }
}

export async function getMe() {
  if (USE_MOCK) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
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
  if (USE_MOCK) return {}
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum acik degil')
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...(patch.name   !== undefined && { name: patch.name }),
      ...(patch.city   !== undefined && { city: patch.city }),
      ...(patch.avatar !== undefined && { avatar: patch.avatar }),
      ...(patch.phone  !== undefined && { phone: patch.phone }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
  if (USE_MOCK) return { message: 'Mock: e-posta gonderildi' }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new Error(error.message)
  return { message: 'Sifre sifirlama e-postasi gonderildi' }
}

export async function resetPassword(_email: string, _code: string, password: string): Promise<{ message: string }> {
  if (USE_MOCK) return { message: 'Mock: sifre sifirlandi' }
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  return { message: 'Sifre basariyla guncellendi' }
}

export async function setupTwoFactor(): Promise<{ message: string; devCode?: string }> { return { message: 'Mock' } }
export async function verifyTwoFactor(_code: string): Promise<Record<string, unknown>> { return {} }
export async function disableTwoFactor(): Promise<Record<string, unknown>> { return {} }
export async function requestEmailVerification(): Promise<{ message: string }> {
  if (USE_MOCK) return { message: 'Mock: doğrulama bağlantısı gönderildi' }
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
  if (USE_MOCK) {
    await delay(200)
    let r = [...mockListings]
    if (filters.category && filters.category !== 'Tümü') r = r.filter(l => l.category === filters.category)
    if (filters.city) r = r.filter(l => l.city === filters.city)
    if (filters.minValue) r = r.filter(l => l.estimatedValue >= filters.minValue!)
    if (filters.maxValue && filters.maxValue < 5_000_000) r = r.filter(l => l.estimatedValue <= filters.maxValue!)
    if (filters.query) {
      const q = filters.query.toLowerCase()
      r = r.filter(l => `${l.title} ${l.vehicleDetails?.brand ?? ''} ${l.city}`.toLowerCase().includes(q))
    }
    if (filters.sort === 'price_asc')  r.sort((a, b) => a.estimatedValue - b.estimatedValue)
    if (filters.sort === 'price_desc') r.sort((a, b) => b.estimatedValue - a.estimatedValue)
    if (filters.sort === 'popular')    r.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    if (filters.sort === 'oldest')     r.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return r
  }

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
  return (data ?? []).map(dbToListing)
}

export async function fetchListingPage(filters: ListingFilters = {}): Promise<ListingPage> {
  if (USE_MOCK) {
    const all = await fetchListings(filters)
    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 12
    const start = (page - 1) * limit
    return { listings: all.slice(start, start + limit), total: all.length, page, limit, hasMore: start + limit < all.length }
  }
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
  return { listings: (data ?? []).map(dbToListing), total, page, limit, hasMore: from + limit < total }
}

export interface PublicUser {
  id: string; name: string; city?: string; avatar?: string
  rating?: number; totalSwaps?: number; emailVerified?: boolean; phoneVerified?: boolean; createdAt?: string
}

export async function fetchUserById(id: string): Promise<PublicUser | null> {
  if (USE_MOCK) { await delay(100); return null }
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  if (!data) return null
  return { id: data.id, name: data.name, city: data.city, avatar: data.avatar, rating: data.rating, totalSwaps: data.total_swaps, emailVerified: data.email_verified, phoneVerified: data.phone_verified, createdAt: data.created_at }
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  if (USE_MOCK) { await delay(100); return mockListings.find(l => l.id === id) ?? null }
  const { data } = await supabase.from('listings').select(LISTING_SELECT).eq('id', id).single()
  if (!data) return null
  supabase.from('listings').update({ view_count: (data.view_count ?? 0) + 1 }).eq('id', id).then(() => {})
  return dbToListing(data)
}

export async function fetchListingByCode(code: string): Promise<Listing | null> {
  if (USE_MOCK) { await delay(100); return mockListings.find(l => l.listingCode?.toUpperCase() === code.toUpperCase()) ?? null }
  const { data } = await supabase.from('listings').select(LISTING_SELECT).ilike('listing_code', code).single()
  return data ? dbToListing(data) : null
}

export async function createListing(data: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing> {
  if (USE_MOCK) {
    await delay(400)
    const num = Math.floor(Math.random() * 9_000_000) + 1_000_000
    const l: Listing = { ...data, id: `lst-${Date.now()}`, listingCode: `TKS-${num}`, createdAt: new Date().toISOString() }
    mockListings.unshift(l)
    return l
  }
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
    attachments: data.attachments ?? null,
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
  }
  const { data: inserted, error } = await supabase.from('listings').insert(row).select(LISTING_SELECT).single()
  if (error) throw new Error(error.message)
  return dbToListing(inserted)
}

export async function updateListingApi(id: string, patch: Partial<Listing>): Promise<Listing> {
  if (USE_MOCK) {
    const current = mockListings.find((l) => l.id === id)
    if (!current) throw new Error('İlan bulunamadi')
    Object.assign(current, patch)
    return current
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
  const { data, error } = await supabase.from('listings').update(row).eq('id', id).select(LISTING_SELECT).single()
  if (error) throw new Error(error.message)
  return dbToListing(data)
}

export async function deleteListingApi(id: string): Promise<void> {
  if (USE_MOCK) return
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function uploadFile(file: File, kind: ListingAttachment['kind'] = 'document'): Promise<ListingAttachment> {
  await delay(150)
  return { id: `att-${Date.now()}-${file.name}`, name: file.name, url: URL.createObjectURL(file), mimeType: file.type, kind, size: file.size, createdAt: new Date().toISOString() }
}

export async function uploadImages(files: File[]): Promise<string[]> {
  if (USE_MOCK) { await delay(200); return files.map((f) => URL.createObjectURL(f)) }
  const urls: string[] = []
  for (const file of files) {
    const ext  = file.name.split('.').pop() ?? 'jpg'
    const path = `listings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true })
    if (error) {
      urls.push(await readAsDataUrl(file))
    } else {
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path)
      urls.push(publicUrl)
    }
  }
  return urls
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function fetchOffers(userId: string): Promise<SwapOffer[]> {
  if (USE_MOCK) { await delay(150); return mockOffers.filter(o => o.fromUserId === userId || o.toUserId === userId) }
  const { data, error } = await supabase
    .from('offers')
    .select(OFFER_SELECT)
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(dbToOffer)
}

export async function createOffer(data: Omit<SwapOffer, 'id' | 'createdAt'>): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(300)
    const o: SwapOffer = { ...data, id: `offer-${Date.now()}`, createdAt: new Date().toISOString() }
    mockOffers.unshift(o)
    return o
  }
  const { data: inserted, error } = await supabase
    .from('offers')
    .insert({
      message:               data.message,
      listing_id:            data.listingId,
      from_user_id:          data.fromUserId,
      to_user_id:            data.toUserId,
      offered_value:         data.offeredValue ?? null,
      offered_listing_id:    data.offeredListingId ?? null,
      offered_listing_title: data.offeredListingTitle ?? null,
    })
    .select(OFFER_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return dbToOffer(inserted)
}

export async function updateOfferStatus(offerId: string, status: SwapOffer['status'], meetingNote?: string): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200)
    const o = mockOffers.find(x => x.id === offerId)
    if (!o) throw new Error('Teklif bulunamadi')
    o.status = status
    return o
  }
  const { data, error } = await supabase
    .from('offers')
    .update({ status, ...(meetingNote && { meeting_note: meetingNote }), updated_at: new Date().toISOString() })
    .eq('id', offerId)
    .select(OFFER_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return dbToOffer(data)
}

export async function confirmOfferComplete(offerId: string): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200)
    const o = mockOffers.find(x => x.id === offerId)
    if (!o) throw new Error('Teklif bulunamadi')
    o.status = 'Tamamlandı'
    return o
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum acik degil')
  const { data: offer } = await supabase.from('offers').select('from_user_id, to_user_id, from_confirmed, to_confirmed').eq('id', offerId).single()
  if (!offer) throw new Error('Teklif bulunamadi')

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const isFrom = user.id === offer.from_user_id
  const isTo   = user.id === offer.to_user_id
  if (isFrom) patch.from_confirmed = true
  if (isTo)   patch.to_confirmed   = true
  const bothConfirmed = (isFrom && offer.to_confirmed) || (isTo && offer.from_confirmed)
  if (bothConfirmed) patch.status = 'Tamamlandı'

  const { data, error } = await supabase.from('offers').update(patch).eq('id', offerId).select(OFFER_SELECT).single()
  if (error) throw new Error(error.message)
  return dbToOffer(data)
}

export async function rateOffer(_offerId: string, score: number, _comment?: string): Promise<{ success: boolean; newRating: number }> {
  return { success: true, newRating: score }
}

export async function reviseOfferApi(offerId: string, patch: { offeredValue?: number; offeredListingId?: string; offeredListingTitle?: string }): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200)
    const o = mockOffers.find(x => x.id === offerId)
    if (!o) throw new Error('Teklif bulunamadi')
    Object.assign(o, patch, { status: 'Görüşülüyor' as const })
    return o
  }
  const { data, error } = await supabase
    .from('offers')
    .update({
      ...(patch.offeredValue         !== undefined && { offered_value: patch.offeredValue }),
      ...(patch.offeredListingId     !== undefined && { offered_listing_id: patch.offeredListingId }),
      ...(patch.offeredListingTitle  !== undefined && { offered_listing_title: patch.offeredListingTitle }),
      status: 'Görüşülüyor',
      updated_at: new Date().toISOString(),
    })
    .eq('id', offerId)
    .select(OFFER_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return dbToOffer(data)
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function sendMessage(offerId: string, text: string) {
  if (USE_MOCK) { await delay(150); return { id: `msg-${Date.now()}`, text, createdAt: new Date().toISOString() } }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Oturum acik degil')
  const { data, error } = await supabase.from('messages').insert({ offer_id: offerId, from_user_id: user.id, text }).select().single()
  if (error) throw new Error(error.message)
  return { id: data.id, text: data.text, createdAt: data.created_at }
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
  if (USE_MOCK) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((n: any) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, createdAt: n.created_at, read: n.read }))
}

export async function markNotificationsReadApi(): Promise<void> {
  if (USE_MOCK) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
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
  if (USE_MOCK) return () => undefined
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
// USE_MOCK ise çağıran fonksiyon kendi fallback'ini döndürür (helper çağrılmaz).
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

export async function queryAI(_p: { query: string; currentListingId?: string | null; conversation?: { role: 'user' | 'assistant'; content: string; candidateIds?: string[] }[] }): Promise<Record<string, unknown>> { return {} }

// TakaslAI sohbet — LLM yanıtı + gerçek ilan önerileri.
// USE_MOCK veya hata durumunda fırlatır; çağıran (AIAssistant) yerel motora düşer.
export interface AIChatResult {
  message: string;
  suggestions: { listingId: string; compatibilityScore: number; reasons: string[]; priceDiff: number; negotiationTip: string }[];
}
export async function aiChat(p: {
  query: string;
  currentListing?: { id: string; title: string; value: number; category: string } | null;
  listings: { id: string; title: string; value: number; city: string; category: string; brand?: string; model?: string; year?: number; km?: number; fuel?: string }[];
}): Promise<AIChatResult> {
  if (USE_MOCK) throw new Error('mock')
  return invokeAI<AIChatResult>('chat', p as unknown as Record<string, unknown>)
}

export async function aiDescribe(p: { brand: string; model: string; year: number; km?: number; fuel?: string; transmission?: string; color?: string; bodyType?: string; hasAccidentRecord?: boolean; condition?: string; city?: string }): Promise<{ description: string; basedOnSimilar: number }> {
  if (USE_MOCK) {
    return { description: `${p.year} model ${p.brand} ${p.model} — bakimli, takasa acik. Detaylar icin iletisime gecin.`, basedOnSimilar: 0 }
  }
  const data = await invokeAI<{ description?: string; basedOnSimilar?: number }>('describe', p)
  if (!data.description) throw new Error('AI açıklama üretemedi (boş yanıt)')
  return { description: data.description, basedOnSimilar: data.basedOnSimilar ?? 0 }
}

export interface ValueForecast { listingId: string; title: string; currentValue: number; months: { month: number; value: number; label: string }[]; summary: { after6m: number; after12m: number; totalChange6m: number; totalChange12m: number; monthlyDepreciation: number; inflationAdjust: number }; factors: string[]; recommendation: string }
export async function aiForecast(id: string): Promise<ValueForecast> {
  if (USE_MOCK) throw new Error('Backend gerekli')
  return invokeAI<ValueForecast>('forecast', { id })
}

export interface Deal { listingId: string; title: string; city: string; category: string; image: string; price: number; avgPrice: number; saving: number; savingPct: number; ownerName: string }
export async function fetchDeals(): Promise<{ deals: Deal[]; totalAnalyzed: number }> { return { deals: [], totalAnalyzed: 0 } }

export interface BudgetResult { budget: number; inBudgetCount: number; stretchCount: number; byCategory: { name: string; count: number }[]; inBudget: { listingId: string; title: string; city: string; category: string; image: string; price: number; utilization: number; ownerName: string }[]; stretch: { listingId: string; title: string; city: string; image: string; price: number; overBy: number }[] }
export async function aiBudget(p: { budget: number; category?: string; city?: string }): Promise<BudgetResult> {
  if (USE_MOCK) return { budget: 0, inBudgetCount: 0, stretchCount: 0, byCategory: [], inBudget: [], stretch: [] }
  return invokeAI<BudgetResult>('budget', p)
}

export interface NegotiationAnalysis { analysis: { tone: 'agresif' | 'pasif' | 'dengeli'; toneReason: string; length: { score: number; note: string }; positives: string[]; negatives: string[]; overallScore: number }; possibilities: { probability: number; type: 'kabul' | 'pazarlik' | 'red'; message: string; reason: string }[]; tips: string[] }
export async function aiNegotiate(p: { myMessage: string; listingId?: string; offeredValue?: number }): Promise<NegotiationAnalysis> {
  if (USE_MOCK) return { analysis: { tone: 'dengeli', toneReason: 'Mock', length: { score: 80, note: 'OK' }, positives: [], negatives: [], overallScore: 80 }, possibilities: [], tips: ['Mock mod'] }
  return invokeAI<NegotiationAnalysis>('negotiate', p)
}

export async function aiEstimateValue(p: { brand: string; model?: string; year?: number; km?: number; hasAccidentRecord?: boolean }): Promise<{ estimated: number | null; low: number | null; high: number | null; basedOn: number; message: string }> {
  if (USE_MOCK) {
    return { estimated: null, low: null, high: null, basedOn: 0, message: 'Mock modda deger hesaplanamaz.' }
  }
  const data = await invokeAI<{ estimated?: number | null; low?: number | null; high?: number | null; basedOn?: number; message?: string }>('estimate', p)
  return { estimated: data.estimated ?? null, low: data.low ?? null, high: data.high ?? null, basedOn: data.basedOn ?? 0, message: data.message ?? '' }
}

export interface SwapAdvice { message: string; candidates: { listingId: string; title: string; city: string; value: number; score: number }[]; tips: string[]; suggestedMessage: string }
export async function aiSwapAdvice(p: { listingId?: string; userText: string }): Promise<SwapAdvice> {
  if (USE_MOCK) return { message: 'Mock modda yerel oneri uretildi.', candidates: [], tips: ['DB bagliyken gercek ilanlardan aday cikarilir.'], suggestedMessage: 'Merhaba, ilaniyla ilgileniyorum. Takas detaylarini konusabilir miyiz?' }
  return invokeAI<SwapAdvice>('swapAdvice', p)
}

export interface SwapScoreResult { source: { id: string; title: string; value: number }; suggestions: { listingId: string; title: string; city: string; value: number; compatibilityScore: number; priceDiff: number; breakdown: Record<string, number>; reasons: string[]; warnings: string[]; negotiationTip: string }[] }
export async function aiSwapScore(p: { sourceListingId: string; targetListingId?: string }): Promise<SwapScoreResult> {
  if (USE_MOCK) throw new Error('Backend gerekli')
  return invokeAI<SwapScoreResult>('swapScore', p)
}

export interface PriceGapResult { rawDiff: number; payer: 'sourceUser' | 'targetUser' | 'none'; fairRange: { min: number; max: number }; verdict: string; explanation: string }
export async function aiPriceGap(p: { sourceListingId?: string; targetListingId?: string; sourceValue?: number; targetValue?: number }): Promise<PriceGapResult> {
  if (USE_MOCK) throw new Error('Backend gerekli')
  return invokeAI<PriceGapResult>('priceGap', p)
}

export interface OfferQualityResult { score: number; positives: string[]; issues: string[]; improvedMessage: string }
export async function aiOfferQuality(p: { message: string; listingId?: string; offeredListingId?: string; offeredValue?: number }): Promise<OfferQualityResult> {
  if (USE_MOCK) return { score: 70, positives: [], issues: [], improvedMessage: '' }
  return invokeAI<OfferQualityResult>('offerQuality', p)
}

export async function aiAutoMessage(p: { sourceListingId?: string; targetListingId: string; tone?: 'samimi' | 'profesyonel' | 'kisa' }): Promise<{ message: string; diff: number | null }> {
  if (USE_MOCK) return { message: 'Merhaba, ilaniyla ilgileniyorum. Takas detaylarini konusabilir miyiz?', diff: null }
  return invokeAI<{ message: string; diff: number | null }>('autoMessage', p)
}

export async function aiPersonalFeed(p: { favoriteIds: string[]; searchHistory: string[]; wishlistTerms: string[] }): Promise<{ items: { listingId: string; title: string; city: string; value: number; score: number; reasons: string[] }[]; profileSignals: string[] }> {
  if (USE_MOCK) return { items: [], profileSignals: [] }
  return invokeAI('personalFeed', p)
}

export async function aiConversationCoach(p: { lastMessage: string; listingId?: string }): Promise<{ intent: string; caution: string; replies: string[]; nextBestAction: string }> {
  if (USE_MOCK) return { intent: 'ilgi', caution: '', replies: [], nextBestAction: 'Bekle' }
  return invokeAI('conversationCoach', p)
}

export async function aiRisk(p: { listingId: string }): Promise<{ riskScore: number; level: string; risks: string[]; positives: string[]; checklist: string[] }> {
  if (USE_MOCK) return { riskScore: 20, level: 'Dusuk', risks: [], positives: [], checklist: [] }
  return invokeAI('risk', p)
}

export async function aiListingQuality(p: { listingId?: string; draft?: Record<string, unknown> }): Promise<{ score: number; grade: string; fixes: string[]; improvedDescription: string }> {
  if (USE_MOCK) return { score: 75, grade: 'B', fixes: [], improvedDescription: '' }
  const data = await invokeAI<{ score?: number; grade?: string; fixes?: string[]; improvedDescription?: string }>('quality', p)
  return { score: data.score ?? 60, grade: data.grade ?? 'B', fixes: data.fixes ?? [], improvedDescription: data.improvedDescription ?? '' }
}

export async function aiMarketInsights(): Promise<{ hotBrands: { brand: string; count: number; avgValue: number; demandScore: number }[]; cityPremiums: { city: string; count: number; avgValue: number }[]; insight: string }> {
  if (USE_MOCK) return { hotBrands: [], cityPremiums: [], insight: 'Mock mod' }
  return invokeAI('marketInsights')
}

export async function aiScenarios(p: { sourceListingId?: string; targetText: string; maxCashDiff?: number }): Promise<{ summary: string; scenarios: { name: string; difficulty: string; plan: string; bestFor: string }[] }> {
  if (USE_MOCK) return { summary: '', scenarios: [] }
  return invokeAI('scenarios', p)
}

export async function aiVisualDescription(p: { fileName: string; mimeType: string; size: number }): Promise<{ summary: string; checks: string[]; risks: string[] }> {
  if (USE_MOCK) return { summary: 'Mock analiz: gorsel/ekspertiz dosyasi ilana guven sinyali olarak eklendi.', checks: ['Panel araliklar', 'Lastik durumu', 'Far ve tampon uyumu'], risks: [] }
  return invokeAI('visualDescription', p as unknown as Record<string, unknown>)
}

// ─── Trends ───────────────────────────────────────────────────────────────────

export interface TrendsData { totalListings: number; avgPrice: number; totalValue: number; recent7d: number; topBrands: { brand: string; count: number; views: number; avgPrice: number; score: number }[]; categories: { name: string; count: number }[]; topCities: { name: string; count: number }[]; fuels: { name: string; count: number }[] }

export async function fetchTrends(): Promise<TrendsData> {
  if (USE_MOCK) return { totalListings: 0, avgPrice: 0, totalValue: 0, recent7d: 0, topBrands: [], categories: [], topCities: [], fuels: [] }
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

export async function seedDemoData(): Promise<{ created: number; total: number }> { return { created: 0, total: 0 } }
export async function clearDevData(): Promise<{ deleted: { listings: number; offers: number; messages: number } }> { return { deleted: { listings: 0, offers: 0, messages: 0 } } }

export interface AdminStats { users: number; listings: number; pendingListings: number; offers: number; reports: number; notifications: number; recentListings: Array<Listing & { owner?: { id: string; name: string; email: string } }> }
export async function fetchAdminStats(): Promise<AdminStats> {
  if (USE_MOCK) return { users: 0, listings: 0, pendingListings: 0, offers: 0, reports: 0, notifications: 0, recentListings: [] }
  const [{ count: users }, { count: listings }, { count: offers }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('listings').select('*', { count: 'exact', head: true }),
    supabase.from('offers').select('*', { count: 'exact', head: true }),
  ])
  const { data: recent } = await supabase.from('listings').select(LISTING_SELECT).order('created_at', { ascending: false }).limit(5)
  return { users: users ?? 0, listings: listings ?? 0, pendingListings: 0, offers: offers ?? 0, reports: 0, notifications: 0, recentListings: (recent ?? []).map(dbToListing) }
}

export async function fetchAdminListings(_status?: string): Promise<Array<Listing & { owner?: { id: string; name: string; email: string } }>> {
  if (USE_MOCK) return []
  const { data } = await supabase.from('listings').select(LISTING_SELECT).order('created_at', { ascending: false })
  return (data ?? []).map(dbToListing)
}

export async function moderateListing(id: string, status: 'pending' | 'approved' | 'rejected', reason?: string) {
  if (USE_MOCK) return {}
  await supabase.from('listings').update({ moderation_status: status, rejection_reason: reason ?? null }).eq('id', id)
  return { success: true }
}

export interface AdminUser { id: string; name: string; email: string; role: string; emailVerified: boolean; phoneVerified: boolean; rating: number; totalSwaps: number; createdAt: string; _count: { listings: number; sentOffers: number } }
export async function fetchAdminUsers(_search?: string): Promise<AdminUser[]> { return [] }
export async function setUserRole(_userId: string, _role: 'USER' | 'ADMIN' | 'MODERATOR') { return {} }
export async function banUser(_userId: string) { return {} }
