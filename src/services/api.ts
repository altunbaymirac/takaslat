/**
 * API Service Layer
 *
 * VITE_API_URL tanımlıysa → gerçek Express backend
 * Tanımlı değilse         → mock data (geliştirme modu)
 *
 * Gerçek backend'e geçmek için:
 *   .env dosyasına VITE_API_URL=http://localhost:3001/api ekleyin
 *   ve `cd server && npm run dev` ile backend'i başlatın
 */

import { mockListings, mockOffers } from '../data/mockListings';
import type { Listing, ListingAttachment, Notification, SwapOffer } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? '';
const USE_MOCK = !BASE;

// ─── Token helpers ────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem('takaslat_token');
}
export function setToken(t: string) {
  localStorage.setItem('takaslat_token', t);
}
export function clearToken() {
  localStorage.removeItem('takaslat_token');
}

function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }
           : { 'Content-Type': 'application/json' };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), ...init });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

const delay = (ms = 250) => new Promise(r => setTimeout(r, ms));

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register(payload: { name: string; email: string; password: string; city?: string }) {
  if (USE_MOCK) {
    await delay(400);
    return { user: { id: 'mock-user', name: payload.name, email: payload.email }, token: 'mock-token' };
  }
  return api<{ user: Record<string, unknown>; token: string }>('/auth/register', {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export async function login(email: string, password: string, twoFactorCode?: string) {
  if (USE_MOCK) {
    await delay(300);
    return { user: { id: 'mock-user', name: 'Demo' }, token: 'mock-token' };
  }
  return api<{ user: Record<string, unknown>; token: string }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password, twoFactorCode }),
  });
}

export async function getMe() {
  if (USE_MOCK) return null;
  return api<Record<string, unknown>>('/auth/me');
}

export async function updateMe(patch: { name?: string; city?: string; avatar?: string; phone?: string }) {
  return api<Record<string, unknown>>('/auth/me', {
    method: 'PATCH',
    body:   JSON.stringify(patch),
  });
}

export async function forgotPassword(email: string): Promise<{ message: string; devCode?: string }> {
  return api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(email: string, code: string, password: string): Promise<{ message: string }> {
  return api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, password }) });
}

export async function setupTwoFactor(): Promise<{ message: string; devCode?: string }> {
  return api('/auth/2fa/setup', { method: 'POST' });
}

export async function verifyTwoFactor(code: string): Promise<Record<string, unknown>> {
  return api('/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function disableTwoFactor(): Promise<Record<string, unknown>> {
  return api('/auth/2fa/disable', { method: 'POST' });
}

export async function requestEmailVerification(): Promise<{ message: string; devCode?: string }> {
  return api('/auth/verify/email/request', { method: 'POST' });
}

export async function confirmEmailVerification(code: string): Promise<Record<string, unknown>> {
  return api('/auth/verify/email/confirm', { method: 'POST', body: JSON.stringify({ code }) });
}

export async function requestPhoneVerification(): Promise<{ message: string; devCode?: string }> {
  return api('/auth/verify/phone/request', { method: 'POST' });
}

export async function confirmPhoneVerification(code: string): Promise<Record<string, unknown>> {
  return api('/auth/verify/phone/confirm', { method: 'POST', body: JSON.stringify({ code }) });
}

// ─── Listings ─────────────────────────────────────────────────────────────────

export interface ListingFilters {
  category?: string;
  city?: string;
  minValue?: number;
  maxValue?: number;
  query?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular';
  brand?: string;
  fuel?: string;
  minYear?: number;
  maxYear?: number;
  minKm?: number;
  maxKm?: number;
  noAccidentOnly?: boolean;
}

export interface ListingPage {
  listings: Listing[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function fetchListings(filters: ListingFilters = {}): Promise<Listing[]> {
  if (USE_MOCK) {
    await delay(200);
    let r = [...mockListings];
    if (filters.category && filters.category !== 'Tümü') r = r.filter(l => l.category === filters.category);
    if (filters.city) r = r.filter(l => l.city === filters.city);
    if (filters.minValue) r = r.filter(l => l.estimatedValue >= filters.minValue!);
    if (filters.maxValue && filters.maxValue < 5_000_000) r = r.filter(l => l.estimatedValue <= filters.maxValue!);
    if (filters.query) {
      const q = filters.query.toLowerCase();
      r = r.filter(l => `${l.title} ${l.vehicleDetails?.brand ?? ''} ${l.city}`.toLowerCase().includes(q));
    }
    if (filters.sort === 'price_asc')  r.sort((a, b) => a.estimatedValue - b.estimatedValue);
    if (filters.sort === 'price_desc') r.sort((a, b) => b.estimatedValue - a.estimatedValue);
    if (filters.sort === 'popular')    r.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    if (filters.sort === 'oldest')     r.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return r;
  }
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === false) return;
    p.set(k === 'query' ? 'q' : k, String(v));
  });
  const res = await api<{ listings: Listing[] }>(`/listings?${p}`);
  return res.listings;
}

export async function fetchListingPage(filters: ListingFilters = {}): Promise<ListingPage> {
  if (USE_MOCK) {
    const all = await fetchListings(filters);
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 12;
    const start = (page - 1) * limit;
    return {
      listings: all.slice(start, start + limit),
      total: all.length,
      page,
      limit,
      hasMore: start + limit < all.length,
    };
  }
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === false) return;
    p.set(k === 'query' ? 'q' : k, String(v));
  });
  return api<ListingPage>(`/listings?${p}`);
}

export interface PublicUser {
  id: string;
  name: string;
  city?: string;
  avatar?: string;
  rating?: number;
  totalSwaps?: number;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: string;
}

export async function fetchUserById(id: string): Promise<PublicUser | null> {
  if (USE_MOCK) {
    await delay(100);
    return null;
  }
  try { return await api<PublicUser>(`/auth/users/${id}`); }
  catch { return null; }
}

export async function fetchListingById(id: string): Promise<Listing | null> {
  if (USE_MOCK) {
    await delay(100);
    return mockListings.find(l => l.id === id) ?? null;
  }
  try { return await api<Listing>(`/listings/${id}`); }
  catch { return null; }
}

export async function fetchListingByCode(code: string): Promise<Listing | null> {
  if (USE_MOCK) {
    await delay(100);
    return mockListings.find(l => l.listingCode?.toUpperCase() === code.toUpperCase()) ?? null;
  }
  try { return await api<Listing>(`/listings/code/${encodeURIComponent(code.toUpperCase())}`); }
  catch { return null; }
}

export async function createListing(data: Omit<Listing, 'id' | 'createdAt'>): Promise<Listing> {
  if (USE_MOCK) {
    await delay(400);
    const num = Math.floor(Math.random() * 9_000_000) + 1_000_000;
    const l: Listing = {
      ...data,
      id:          `lst-${Date.now()}`,
      listingCode: `TKS-${num}`,
      createdAt:   new Date().toISOString(),
    };
    mockListings.unshift(l);
    return l;
  }
  const payload = {
    ...data,
    brand:             data.vehicleDetails?.brand,
    model:             data.vehicleDetails?.model,
    year:              data.vehicleDetails?.year,
    km:                data.vehicleDetails?.km,
    fuel:              data.vehicleDetails?.fuel,
    transmission:      data.vehicleDetails?.transmission,
    color:             data.vehicleDetails?.color,
    hasAccidentRecord: data.vehicleDetails?.hasAccidentRecord ?? false,
    bodyType:          data.vehicleDetails?.bodyType,
    engineCC:          data.vehicleDetails?.engineCC,
  };
  return api<Listing>('/listings', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateListingApi(id: string, patch: Partial<Listing>): Promise<Listing> {
  if (USE_MOCK) {
    const current = mockListings.find((l) => l.id === id);
    if (!current) throw new Error('İlan bulunamadı');
    Object.assign(current, patch);
    return current;
  }
  const payload = {
    ...patch,
    brand:             patch.vehicleDetails?.brand,
    model:             patch.vehicleDetails?.model,
    year:              patch.vehicleDetails?.year,
    km:                patch.vehicleDetails?.km,
    fuel:              patch.vehicleDetails?.fuel,
    transmission:      patch.vehicleDetails?.transmission,
    color:             patch.vehicleDetails?.color,
    hasAccidentRecord: patch.vehicleDetails?.hasAccidentRecord,
    bodyType:          patch.vehicleDetails?.bodyType,
    engineCC:          patch.vehicleDetails?.engineCC,
  };
  return api<Listing>(`/listings/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteListingApi(id: string): Promise<void> {
  if (USE_MOCK) return;
  await api<{ success: boolean }>(`/listings/${id}`, { method: 'DELETE' });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function uploadFile(file: File, kind: ListingAttachment['kind'] = 'document'): Promise<ListingAttachment> {
  if (USE_MOCK) {
    await delay(150);
    return {
      id: `att-${Date.now()}-${file.name}`,
      name: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type,
      kind,
      size: file.size,
      createdAt: new Date().toISOString(),
    };
  }

  const dataUrl = await readAsDataUrl(file);
  const uploaded = await api<ListingAttachment>('/uploads', {
    method: 'POST',
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataUrl, kind }),
  });
  return {
    ...uploaded,
    url: uploaded.url.startsWith('http') ? uploaded.url : `${BASE.replace('/api', '')}${uploaded.url}`,
  };
}

// ─── Image upload (multipart/form-data → WebP, max 8 files) ─────────────────
export async function uploadImages(files: File[]): Promise<string[]> {
  if (USE_MOCK) {
    await delay(200);
    return files.map((f) => URL.createObjectURL(f));
  }
  const form = new FormData();
  for (const f of files) form.append('images', f);
  const token = getToken();
  const res = await fetch(`${BASE}/uploads/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Görsel yüklenemedi');
  }
  const data = await res.json() as { urls: string[] };
  return data.urls;
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function fetchOffers(userId: string): Promise<SwapOffer[]> {
  if (USE_MOCK) {
    await delay(150);
    return mockOffers.filter(o => o.fromUserId === userId || o.toUserId === userId);
  }
  return api<SwapOffer[]>('/offers');
}

export async function createOffer(data: Omit<SwapOffer, 'id' | 'createdAt'>): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(300);
    const o: SwapOffer = { ...data, id: `offer-${Date.now()}`, createdAt: new Date().toISOString() };
    mockOffers.unshift(o);
    return o;
  }
  return api<SwapOffer>('/offers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateOfferStatus(
  offerId: string,
  status: SwapOffer['status'],
  meetingNote?: string,
): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200);
    const o = mockOffers.find(x => x.id === offerId);
    if (!o) throw new Error('Teklif bulunamadı');
    o.status = status;
    return o;
  }
  return api<SwapOffer>(`/offers/${offerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, meetingNote }),
  });
}

export async function confirmOfferComplete(offerId: string): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200);
    const o = mockOffers.find(x => x.id === offerId);
    if (!o) throw new Error('Teklif bulunamadı');
    o.status = 'Tamamlandı';
    return o;
  }
  return api<SwapOffer>(`/offers/${offerId}/confirm`, { method: 'PATCH' });
}

export async function rateOffer(offerId: string, score: number, comment?: string): Promise<{ success: boolean; newRating: number }> {
  if (USE_MOCK) {
    await delay(200);
    return { success: true, newRating: score };
  }
  return api(`/offers/${offerId}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score, comment }),
  });
}

export async function reviseOfferApi(offerId: string, patch: {
  offeredValue?: number;
  offeredListingId?: string;
  offeredListingTitle?: string;
}): Promise<SwapOffer> {
  if (USE_MOCK) {
    await delay(200);
    const o = mockOffers.find(x => x.id === offerId);
    if (!o) throw new Error('Teklif bulunamadı');
    Object.assign(o, patch, { status: 'Görüşülüyor' as const });
    o.messages = [
      ...(o.messages ?? []),
      {
        id: `msg-${Date.now()}`,
        fromUserId: 'mock-user',
        text: 'Teklif revize edildi.',
        createdAt: new Date().toISOString(),
      },
    ];
    return o;
  }
  return api<SwapOffer>(`/offers/${offerId}/revision`, { method: 'PATCH', body: JSON.stringify(patch) });
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export async function queryAI(params: {
  query: string;
  currentListingId?: string | null;
  conversation?: { role: 'user' | 'assistant'; content: string; candidateIds?: string[] }[];
}): Promise<Record<string, unknown>> {
  if (USE_MOCK) {
    return {};
  }
  return api<Record<string, unknown>>('/ai/match', {
    method: 'POST',
    body:   JSON.stringify(params),
  });
}

export async function aiDescribe(payload: {
  brand: string; model: string; year: number;
  km?: number; fuel?: string; transmission?: string; color?: string;
  bodyType?: string; hasAccidentRecord?: boolean; condition?: string; city?: string;
}): Promise<{ description: string; basedOnSimilar: number }> {
  if (USE_MOCK) {
    return {
      description: `${payload.year} model ${payload.brand} ${payload.model} — bakımlı, takasa açık. Detaylar için iletişime geçin.`,
      basedOnSimilar: 0,
    };
  }
  return api('/ai/describe', { method: 'POST', body: JSON.stringify(payload) });
}

export interface ValueForecast {
  listingId:    string;
  title:        string;
  currentValue: number;
  months:       { month: number; value: number; label: string }[];
  summary: {
    after6m:              number;
    after12m:             number;
    totalChange6m:        number;
    totalChange12m:       number;
    monthlyDepreciation:  number;
    inflationAdjust:      number;
  };
  factors:        string[];
  recommendation: string;
}

export async function aiForecast(listingId: string): Promise<ValueForecast> {
  return api('/ai/forecast', { method: 'POST', body: JSON.stringify({ listingId }) });
}

export interface Deal {
  listingId: string; title: string; city: string; category: string; image: string;
  price: number; avgPrice: number; saving: number; savingPct: number; ownerName: string;
}
export async function fetchDeals(): Promise<{ deals: Deal[]; totalAnalyzed: number }> {
  return api('/ai/deals');
}

export interface BudgetResult {
  budget:        number;
  inBudgetCount: number;
  stretchCount:  number;
  byCategory:    { name: string; count: number }[];
  inBudget: { listingId: string; title: string; city: string; category: string; image: string; price: number; utilization: number; ownerName: string }[];
  stretch:  { listingId: string; title: string; city: string; image: string; price: number; overBy: number }[];
}
export async function aiBudget(payload: { budget: number; category?: string; city?: string }): Promise<BudgetResult> {
  return api('/ai/budget', { method: 'POST', body: JSON.stringify(payload) });
}

export interface NegotiationAnalysis {
  analysis: {
    tone:          'agresif' | 'pasif' | 'dengeli';
    toneReason:    string;
    length:        { score: number; note: string };
    positives:     string[];
    negatives:     string[];
    overallScore:  number;
  };
  possibilities: { probability: number; type: 'kabul' | 'pazarlık' | 'red'; message: string; reason: string }[];
  tips:          string[];
}

export async function aiNegotiate(payload: {
  myMessage: string; listingId?: string; offeredValue?: number;
}): Promise<NegotiationAnalysis> {
  if (USE_MOCK) {
    return {
      analysis: { tone: 'dengeli', toneReason: 'Mock', length: { score: 80, note: 'OK' }, positives: [], negatives: [], overallScore: 80 },
      possibilities: [],
      tips: ['Mock mod — gerçek backend\'de daha detaylı analiz olur'],
    };
  }
  return api('/ai/negotiate', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiEstimateValue(payload: {
  brand: string; model?: string; year?: number; km?: number; hasAccidentRecord?: boolean;
}): Promise<{ estimated: number | null; low: number | null; high: number | null; basedOn: number; message: string }> {
  if (USE_MOCK) {
    return { estimated: null, low: null, high: null, basedOn: 0, message: 'Mock modda değer hesaplanamaz.' };
  }
  return api('/ai/estimate-value', { method: 'POST', body: JSON.stringify(payload) });
}

export interface SwapAdvice {
  message: string;
  candidates: { listingId: string; title: string; city: string; value: number; score: number }[];
  tips: string[];
  suggestedMessage: string;
}

export async function aiSwapAdvice(payload: { listingId?: string; userText: string }): Promise<SwapAdvice> {
  if (USE_MOCK) {
    return {
      message: 'Mock modda yerel öneri üretildi.',
      candidates: [],
      tips: ['DB bağlıyken gerçek ilanlardan aday çıkarılır.'],
      suggestedMessage: 'Merhaba, ilanınızla ilgileniyorum. Takas detaylarını konuşabilir miyiz?',
    };
  }
  return api('/ai/advice', { method: 'POST', body: JSON.stringify(payload) });
}

export interface SwapScoreResult {
  source: { id: string; title: string; value: number };
  suggestions: {
    listingId: string;
    title: string;
    city: string;
    value: number;
    compatibilityScore: number;
    priceDiff: number;
    breakdown: Record<string, number>;
    reasons: string[];
    warnings: string[];
    negotiationTip: string;
  }[];
}

export async function aiSwapScore(payload: { sourceListingId: string; targetListingId?: string }): Promise<SwapScoreResult> {
  return api('/ai/swap-score', { method: 'POST', body: JSON.stringify(payload) });
}

export interface PriceGapResult {
  rawDiff: number;
  payer: 'sourceUser' | 'targetUser' | 'none';
  fairRange: { min: number; max: number };
  verdict: string;
  explanation: string;
}

export async function aiPriceGap(payload: {
  sourceListingId?: string;
  targetListingId?: string;
  sourceValue?: number;
  targetValue?: number;
}): Promise<PriceGapResult> {
  return api('/ai/price-gap', { method: 'POST', body: JSON.stringify(payload) });
}

export interface OfferQualityResult {
  score: number;
  positives: string[];
  issues: string[];
  improvedMessage: string;
}

export async function aiOfferQuality(payload: {
  message: string;
  listingId?: string;
  offeredListingId?: string;
  offeredValue?: number;
}): Promise<OfferQualityResult> {
  return api('/ai/offer-quality', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiAutoMessage(payload: {
  sourceListingId?: string;
  targetListingId: string;
  tone?: 'samimi' | 'profesyonel' | 'kısa';
}): Promise<{ message: string; diff: number | null }> {
  return api('/ai/auto-message', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiPersonalFeed(payload: {
  favoriteIds: string[];
  searchHistory: string[];
  wishlistTerms: string[];
}): Promise<{ items: { listingId: string; title: string; city: string; value: number; score: number; reasons: string[] }[]; profileSignals: string[] }> {
  return api('/ai/personal-feed', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiConversationCoach(payload: {
  lastMessage: string;
  listingId?: string;
}): Promise<{ intent: string; caution: string; replies: string[]; nextBestAction: string }> {
  return api('/ai/conversation-coach', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiRisk(payload: { listingId: string }): Promise<{
  riskScore: number;
  level: string;
  risks: string[];
  positives: string[];
  checklist: string[];
}> {
  return api('/ai/risk', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiListingQuality(payload: { listingId?: string; draft?: Record<string, unknown> }): Promise<{
  score: number;
  grade: string;
  fixes: string[];
  improvedDescription: string;
}> {
  return api('/ai/listing-quality', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiMarketInsights(): Promise<{
  hotBrands: { brand: string; count: number; avgValue: number; demandScore: number }[];
  cityPremiums: { city: string; count: number; avgValue: number }[];
  insight: string;
}> {
  return api('/ai/market-insights');
}

export async function aiScenarios(payload: {
  sourceListingId?: string;
  targetText: string;
  maxCashDiff?: number;
}): Promise<{ summary: string; scenarios: { name: string; difficulty: string; plan: string; bestFor: string }[] }> {
  return api('/ai/scenarios', { method: 'POST', body: JSON.stringify(payload) });
}

export async function aiVisualDescription(payload: {
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<{ summary: string; checks: string[]; risks: string[] }> {
  if (USE_MOCK) {
    return {
      summary: 'Mock analiz: görsel/ekspertiz dosyası ilana güven sinyali olarak eklendi.',
      checks: ['Panel aralıkları', 'Lastik durumu', 'Far ve tampon uyumu'],
      risks: [],
    };
  }
  return api('/ai/visual-description', { method: 'POST', body: JSON.stringify(payload) });
}

// ─── Dev / Seed ───────────────────────────────────────────────────────────────

export async function seedDemoData(): Promise<{ created: number; total: number }> {
  return api('/dev/seed', { method: 'POST' });
}

export async function clearDevData(): Promise<{ deleted: { listings: number; offers: number; messages: number } }> {
  return api('/dev/clear', { method: 'POST' });
}

export interface TrendsData {
  totalListings: number;
  avgPrice:      number;
  totalValue:    number;
  recent7d:      number;
  topBrands:     { brand: string; count: number; views: number; avgPrice: number; score: number }[];
  categories:    { name: string; count: number }[];
  topCities:     { name: string; count: number }[];
  fuels:         { name: string; count: number }[];
}

export async function fetchTrends(): Promise<TrendsData> {
  if (USE_MOCK) {
    return {
      totalListings: 0, avgPrice: 0, totalValue: 0, recent7d: 0,
      topBrands: [], categories: [], topCities: [], fuels: [],
    };
  }
  return api<TrendsData>('/ai/trends');
}

export { USE_MOCK };

export async function sendMessage(offerId: string, text: string) {
  if (USE_MOCK) {
    await delay(150);
    return { id: `msg-${Date.now()}`, text, createdAt: new Date().toISOString() };
  }
  return api<Record<string, unknown>>(`/offers/${offerId}/messages`, {
    method: 'POST', body: JSON.stringify({ text }),
  });
}

export async function fetchNotifications(): Promise<Notification[]> {
  if (USE_MOCK) return [];
  return api<Notification[]>('/notifications');
}

export async function markNotificationsReadApi(): Promise<void> {
  if (USE_MOCK) return;
  await api<{ success: boolean }>('/notifications/read', { method: 'POST' });
}

export async function sendTestNotification(): Promise<Notification> {
  return api<Notification>('/notifications/test', { method: 'POST' });
}

export interface RawMessageEvent {
  _event: 'newMessage';
  offerId: string;
  id: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  createdAt: string;
}

export interface OfferStatusEvent {
  _event: 'offerStatus';
  offerId: string;
  status: string;
}

export function subscribeNotificationStream(
  onNotification: (notification: Notification) => void,
  onMessageEvent?: (event: RawMessageEvent) => void,
  onOfferStatusEvent?: (event: OfferStatusEvent) => void,
): () => void {
  if (USE_MOCK) return () => undefined;
  const token = getToken();
  if (!token || typeof EventSource === 'undefined') return () => undefined;
  const root = BASE.replace('/api', '');
  const source = new EventSource(`${root}/api/notifications/stream?token=${encodeURIComponent(token)}`);
  source.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      if (data._event === 'newMessage' && onMessageEvent) {
        onMessageEvent(data as unknown as RawMessageEvent);
      } else if (data._event === 'offerStatus' && onOfferStatusEvent) {
        onOfferStatusEvent(data as unknown as OfferStatusEvent);
      } else if (data?.id && data?.title) {
        onNotification(data as unknown as Notification);
      }
    } catch { /* ignore malformed event */ }
  };
  return () => source.close();
}

export interface AdminStats {
  users: number;
  listings: number;
  pendingListings: number;
  offers: number;
  reports: number;
  notifications: number;
  recentListings: Array<Listing & { owner?: { id: string; name: string; email: string } }>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return api<AdminStats>('/admin/stats');
}

export async function fetchAdminListings(status?: string): Promise<Array<Listing & { owner?: { id: string; name: string; email: string } }>> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/admin/listings${qs}`);
}

export async function moderateListing(id: string, status: 'pending' | 'approved' | 'rejected', reason?: string) {
  return api(`/admin/listings/${id}/moderation`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  rating: number;
  totalSwaps: number;
  createdAt: string;
  _count: { listings: number; sentOffers: number };
}

export async function fetchAdminUsers(search?: string): Promise<AdminUser[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return api(`/admin/users${qs}`);
}

export async function setUserRole(userId: string, role: 'USER' | 'ADMIN' | 'MODERATOR') {
  return api(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
}

export async function banUser(userId: string) {
  return api(`/admin/users/${userId}/ban`, { method: 'PATCH' });
}
