import { Router } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ─── Uploads directory ────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
mkdir(UPLOAD_DIR, { recursive: true }).catch(() => undefined);

function publicUrl(filename: string): string {
  const port = process.env.PORT ?? 3002;
  const host = `http://localhost:${port}`;
  return `${host}/uploads/${filename}`;
}

// ─── Route 1: POST /api/uploads  (legacy: base64 JSON body) ──────────────────
//   For backward compat with the existing frontend image picker flow.

const UploadSchema = z.object({
  fileName: z.string().min(1).max(180),
  mimeType: z.string().min(3).max(120),
  dataUrl:  z.string().min(20),
  kind:     z.enum(['image', 'expertise', 'document']).default('document'),
});

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']);

function extensionFor(mimeType: string, fileName: string): string {
  const fromName = path.extname(fileName).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(fromName)) return fromName;
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
  if (mimeType.includes('png'))  return '.png';
  if (mimeType.includes('webp')) return '.webp';
  if (mimeType.includes('pdf'))  return '.pdf';
  return '.bin';
}

router.post('/', requireAuth, async (req, res) => {
  const parsed = UploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { fileName, mimeType, dataUrl, kind } = parsed.data;
  if (!ALLOWED_MIME.has(mimeType)) {
    res.status(400).json({ error: 'Sadece JPG, PNG, WEBP ve PDF dosyaları destekleniyor' });
    return;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || match[1] !== mimeType) {
    res.status(400).json({ error: 'Geçersiz dosya verisi' });
    return;
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 8 * 1024 * 1024) {
    res.status(413).json({ error: 'Dosya en fazla 8 MB olabilir' });
    return;
  }

  let finalBuffer = buffer;
  let ext = extensionFor(mimeType, fileName);

  // Resize images with sharp
  if (mimeType.startsWith('image/')) {
    finalBuffer = Buffer.from(await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer());
    ext = '.webp';
  }

  const storedName = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, storedName), finalBuffer);

  res.status(201).json({
    id:        randomUUID(),
    name:      fileName,
    url:       publicUrl(storedName),
    mimeType:  mimeType.startsWith('image/') ? 'image/webp' : mimeType,
    kind,
    size:      finalBuffer.length,
    createdAt: new Date().toISOString(),
  });
});

// ─── Route 2: POST /api/uploads/images  (multipart/form-data, up to 8 files) ─
//   Field name: "images"
//   Returns: { urls: string[] }

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Yalnızca JPEG, PNG, WebP veya GIF görseller kabul edilir'));
    }
  },
});

router.post('/images', requireAuth, memUpload.array('images', 8), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'Hiç görsel gönderilmedi' });
    return;
  }

  const urls: string[] = [];

  for (const file of files) {
    const filename = `${randomUUID()}.webp`;
    await sharp(file.buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(UPLOAD_DIR, filename));

    urls.push(publicUrl(filename));
  }

  res.json({ urls });
});

export default router;
