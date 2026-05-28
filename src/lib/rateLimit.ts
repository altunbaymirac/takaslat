/**
 * Client-side rate limiter — localStorage tabanlı.
 * Backend olmadan kaba kuvvet saldırılarını yavaşlatır.
 * (Gerçek koruma Supabase Auth tarafında da var.)
 */

interface RateLimitRecord {
  attempts: number[]   // epoch ms timestamp listesi
  blockedUntil?: number
}

const STORAGE_KEY = 'takaslat_rl'

function load(): Record<string, RateLimitRecord> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function save(data: Record<string, RateLimitRecord>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* storage dolu */ }
}

export interface RateLimitConfig {
  /** Kaç deneme izinli */
  maxAttempts: number
  /** Pencere süresi (ms) */
  windowMs: number
  /** Blok süresi (ms) — varsayılan: windowMs */
  blockMs?: number
}

export const LIMITS = {
  login:         { maxAttempts: 5,  windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 },
  register:      { maxAttempts: 3,  windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  forgotPassword:{ maxAttempts: 3,  windowMs: 30 * 60 * 1000, blockMs: 30 * 60 * 1000 },
  createListing: { maxAttempts: 10, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 },
  createOffer:   { maxAttempts: 20, windowMs: 60 * 60 * 1000, blockMs: 30 * 60 * 1000 },
  sendMessage:   { maxAttempts: 30, windowMs: 60 * 60 * 1000, blockMs: 10 * 60 * 1000 },
} satisfies Record<string, RateLimitConfig>

export type LimitKey = keyof typeof LIMITS

/** Kalan süreyi okunabilir formata çevir */
export function formatTimeLeft(ms: number): string {
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min > 0) return `${min} dakika ${sec > 0 ? `${sec} saniye` : ''}`
  return `${sec} saniye`
}

/** Deneme kaydı, limit aşıldıysa hata fırlatır */
export function checkRateLimit(key: LimitKey, identifier = 'global'): void {
  const cfg  = LIMITS[key]
  const now  = Date.now()
  const id   = `${key}:${identifier}`
  const data = load()
  const rec  = data[id] ?? { attempts: [] }

  // Blok süresi dolmadıysa
  if (rec.blockedUntil && now < rec.blockedUntil) {
    const left = rec.blockedUntil - now
    throw new Error(`Çok fazla deneme. ${formatTimeLeft(left)} sonra tekrar dene.`)
  }

  // Pencere dışındaki denemeleri temizle
  rec.attempts = rec.attempts.filter(t => now - t < cfg.windowMs)

  // Limit kontrolü
  if (rec.attempts.length >= cfg.maxAttempts) {
    rec.blockedUntil = now + (cfg.blockMs ?? cfg.windowMs)
    data[id] = rec
    save(data)
    const left = cfg.blockMs ?? cfg.windowMs
    throw new Error(`Çok fazla deneme. ${formatTimeLeft(left)} sonra tekrar dene.`)
  }

  // Denemeyi kaydet
  rec.attempts.push(now)
  data[id] = rec
  save(data)
}

/** Başarılı işlem sonrası kayıtları sıfırla */
export function resetRateLimit(key: LimitKey, identifier = 'global'): void {
  const id   = `${key}:${identifier}`
  const data = load()
  delete data[id]
  save(data)
}

/** Kalan deneme hakkını döner */
export function getRemainingAttempts(key: LimitKey, identifier = 'global'): number {
  const cfg  = LIMITS[key]
  const now  = Date.now()
  const id   = `${key}:${identifier}`
  const data = load()
  const rec  = data[id]
  if (!rec) return cfg.maxAttempts
  if (rec.blockedUntil && now < rec.blockedUntil) return 0
  const recent = rec.attempts.filter(t => now - t < cfg.windowMs)
  return Math.max(0, cfg.maxAttempts - recent.length)
}
