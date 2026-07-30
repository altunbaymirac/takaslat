import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { rateLimit, aiRateLimit } from './middleware/rateLimit';
import { securityHeaders } from './middleware/securityHeaders';
import authRoutes     from './routes/auth';
import listingRoutes  from './routes/listings';
import offerRoutes    from './routes/offers';
import aiRoutes       from './routes/ai';
import devRoutes      from './routes/dev';
import uploadRoutes   from './routes/uploads';
import notificationRoutes from './routes/notifications';
import adminRoutes    from './routes/admin';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

// CLIENT_URL birden fazla URL içerebilir (virgülle ayrılmış)
// Örn: "https://takaslat.vercel.app,https://takaslat.com,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_URL ?? 'http://localhost:5173')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // origin yoksa (curl, Postman, SSR) veya whitelist'teyse izin ver
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    // Vercel preview URL'leri: *.vercel.app
    if (/\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: ${origin} izin verilmedi`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(securityHeaders);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/api', rateLimit);          // Genel: 240 req/dk
app.use('/api/ai', aiRateLimit);     // AI: 30 req/dk (hesaplama yoğun)

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',     authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/offers',   offerRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/dev',      devRoutes);
app.use('/api/uploads',  uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',    adminRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Sunucu hatası oluştu' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Takaslat API → http://localhost:${PORT}/api`);
  console.log(`   DB  → SQLite (server/prisma/dev.db)`);
  console.log(`   ENV → ${process.env.NODE_ENV ?? 'development'}\n`);
});
