import rateLimit from 'express-rate-limit';

const errorResponse = (msg: string) => ({ error: msg });

// ── Genel API limiti — 240 istek / dk / IP ───────────────────────────────────
export const apiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('Çok fazla istek. Lütfen biraz sonra tekrar deneyin.'),
});

// Backward-compat alias (index.ts uses `rateLimit`)
export { apiRateLimit as rateLimit };

// ── AI endpoint limiti — 30 istek / dk / IP ──────────────────────────────────
export const aiRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('AI limiti aşıldı. Lütfen 1 dakika bekleyin.'),
});

// ── Auth brute-force koruması — 10 deneme / 15 dk / IP ───────────────────────
export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,   // Başarılı girişler sayılmaz
  message: errorResponse('Çok fazla başarısız giriş. 15 dakika sonra tekrar deneyin.'),
});

// ── Doğrulama kodu istekleri — 5 istek / 15 dk / IP ─────────────────────────
export const verifyRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: errorResponse('Çok fazla doğrulama isteği. 15 dakika sonra tekrar deneyin.'),
});
