/**
 * Basit input sanitization — XSS ve SQL injection önlemi.
 * React zaten JSX render'da XSS'e karşı koruma sağlar,
 * bu util sunucuya gönderilmeden önce verileri temizler.
 */

/** HTML özel karakterleri escape et */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/** Metin alanlarını temizle: trim + max uzunluk + null byte kaldır */
export function sanitizeText(str: string, maxLength = 5000): string {
  return str
    .replace(/\0/g, '')          // null byte
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // kontrol karakterleri
    .trim()
    .slice(0, maxLength)
}

/** URL doğrula: sadece http/https kabul et */
export function sanitizeUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    return url
  } catch {
    return ''
  }
}

/** İlan formu verisini temizle */
export function sanitizeListing(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeText(value, key === 'description' ? 5000 : 500)
    } else {
      clean[key] = value
    }
  }
  return clean
}

/** E-posta formatını doğrula */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** Şifre gücünü kontrol et */
export function checkPasswordStrength(password: string): {
  score: number   // 0-4
  label: string
  color: string
} {
  let score = 0
  if (password.length >= 8)  score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const levels = [
    { label: 'Çok zayıf', color: 'text-red-500' },
    { label: 'Zayıf',     color: 'text-orange-500' },
    { label: 'Orta',      color: 'text-yellow-500' },
    { label: 'Güçlü',     color: 'text-blue-500' },
    { label: 'Çok güçlü', color: 'text-green-500' },
  ]
  return { score, ...levels[Math.min(score, 4)] }
}
