import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signToken, requireAuth, type AuthRequest } from '../middleware/auth';
import { sendMail } from '../lib/mailer';
import { generateTwoFactorCode, storeTwoFactorCode, verifyTwoFactorCode } from '../lib/twoFactor';
import { authRateLimit, verifyRateLimit } from '../middleware/rateLimit';

const router = Router();

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  city: true,
  avatar: true,
  rating: true,
  totalSwaps: true,
  twoFactorEnabled: true,
  role: true,
  emailVerified: true,
  phoneVerified: true,
} as const;

// ─── Register ─────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  name:     z.string().min(2, 'Ad en az 2 karakter olmalı'),
  email:    z.string().email('Geçersiz e-posta'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  city:     z.string().optional(),
  phone:    z.string().optional(),
});

router.post('/register', authRateLimit, async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const { name, email, password, city, phone } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashed, city, phone },
    select: safeUserSelect,
  });

  res.status(201).json({ user, token: signToken(user.id) });
});

// ─── Login ────────────────────────────────────────────────────────────────────

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
  twoFactorCode: z.string().length(6).optional(),
});

router.post('/login', authRateLimit, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Geçersiz giriş bilgileri' });
    return;
  }
  const { email, password, twoFactorCode } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    return;
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorCode) {
      const code = generateTwoFactorCode();
      await storeTwoFactorCode(user.id, code);
      await sendMail({
        to: user.email,
        subject: 'Takaslat giriş doğrulama kodu',
        text: `Giriş kodunuz: ${code}. Bu kod 10 dakika geçerlidir.`,
      });
      res.status(202).json({ requires2FA: true, message: 'Doğrulama kodu e-posta loguna gönderildi' });
      return;
    }
    const ok = await verifyTwoFactorCode(user.id, twoFactorCode);
    if (!ok) {
      res.status(401).json({ error: 'Doğrulama kodu hatalı veya süresi doldu' });
      return;
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  const { password, twoFactorSecret, ...safe } = user;
  void password;
  void twoFactorSecret;
  res.json({ user: safe, token: signToken(user.id) });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: safeUserSelect,
  });
  if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }
  res.json(user);
});

// ─── PATCH /auth/me ───────────────────────────────────────────────────────────

const UpdateMeSchema = z.object({
  name:   z.string().min(2).optional(),
  city:   z.string().min(2).optional(),
  avatar: z.string().url().optional().or(z.literal('')),
  phone:  z.string().optional(),
});

router.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  const parsed = UpdateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (data.avatar === '') data.avatar = null;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data,
    select: safeUserSelect,
  });
  res.json(user);
});

// ─── Verification ─────────────────────────────────────────────────────────────

const VerificationCodeSchema = z.object({ code: z.string().length(6) });

router.post('/verify/email/request', requireAuth, verifyRateLimit, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, emailVerified: true } });
  if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }
  if (user.emailVerified) { res.json({ message: 'E-posta zaten doğrulanmış' }); return; }

  const code = generateTwoFactorCode();
  await storeTwoFactorCode(`${user.id}:email`, code);
  await sendMail({
    to: user.email,
    subject: 'Takaslat e-posta doğrulama kodu',
    text: `E-posta doğrulama kodunuz: ${code}. Bu kod 10 dakika geçerlidir.`,
  });

  res.json({
    message: 'E-posta doğrulama kodu oluşturuldu',
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
});

router.post('/verify/email/confirm', requireAuth, async (req: AuthRequest, res) => {
  const parsed = VerificationCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Kod 6 haneli olmalı' }); return; }

  const ok = await verifyTwoFactorCode(`${req.userId}:email`, parsed.data.code);
  if (!ok) { res.status(401).json({ error: 'Kod hatalı veya süresi doldu' }); return; }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { emailVerified: true },
    select: safeUserSelect,
  });
  res.json(user);
});

router.post('/verify/phone/request', requireAuth, verifyRateLimit, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, phone: true, phoneVerified: true } });
  if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }
  if (!user.phone) { res.status(400).json({ error: 'Önce profilinize telefon ekleyin' }); return; }
  if (user.phoneVerified) { res.json({ message: 'Telefon zaten doğrulanmış' }); return; }

  const code = generateTwoFactorCode();
  await storeTwoFactorCode(`${user.id}:phone`, code);
  await sendMail({
    to: user.email,
    subject: 'Takaslat telefon doğrulama kodu',
    text: `SMS demo kodunuz (${user.phone}): ${code}. Bu kod 10 dakika geçerlidir.`,
  });

  res.json({
    message: 'Telefon doğrulama kodu oluşturuldu',
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
});

router.post('/verify/phone/confirm', requireAuth, async (req: AuthRequest, res) => {
  const parsed = VerificationCodeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Kod 6 haneli olmalı' }); return; }

  const ok = await verifyTwoFactorCode(`${req.userId}:phone`, parsed.data.code);
  if (!ok) { res.status(401).json({ error: 'Kod hatalı veya süresi doldu' }); return; }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { phoneVerified: true },
    select: safeUserSelect,
  });
  res.json(user);
});

router.post('/2fa/setup', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }

  const code = generateTwoFactorCode();
  await storeTwoFactorCode(user.id, code);
  await sendMail({
    to: user.email,
    subject: 'Takaslat 2FA aktivasyon kodu',
    text: `2FA aktivasyon kodunuz: ${code}. Bu kod 10 dakika geçerlidir.`,
  });

  res.json({
    message: '2FA aktivasyon kodu oluşturuldu',
    devCode: process.env.NODE_ENV === 'production' ? undefined : code,
  });
});

const TwoFactorVerifySchema = z.object({ code: z.string().length(6) });

router.post('/2fa/verify', requireAuth, async (req: AuthRequest, res) => {
  const parsed = TwoFactorVerifySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Kod 6 haneli olmalı' }); return; }

  const ok = await verifyTwoFactorCode(req.userId!, parsed.data.code);
  if (!ok) { res.status(401).json({ error: 'Kod hatalı veya süresi doldu' }); return; }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data:  { twoFactorEnabled: true, twoFactorSecret: 'email-code' },
    select: safeUserSelect,
  });
  res.json(user);
});

router.post('/2fa/disable', requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.update({
    where: { id: req.userId },
    data:  { twoFactorEnabled: false, twoFactorSecret: null },
    select: safeUserSelect,
  });
  res.json(user);
});

// ─── Password Reset ───────────────────────────────────────────────────────────

const ForgotSchema = z.object({ email: z.string().email() });
const ResetSchema  = z.object({ email: z.string().email(), code: z.string().length(6), password: z.string().min(6) });

router.post('/forgot-password', verifyRateLimit, async (req, res) => {
  const parsed = ForgotSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Geçersiz e-posta' }); return; }

  // Kullanıcı bulunsun ya da bulunmasın aynı yanıtı döndür (user enumeration önlemi)
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  let devCode: string | undefined;
  if (user) {
    const code = generateTwoFactorCode();
    await storeTwoFactorCode(`${user.id}:reset`, code);
    await sendMail({
      to: user.email,
      subject: 'Takaslat şifre sıfırlama kodu',
      text: `Şifre sıfırlama kodunuz: ${code}\n\nBu kod 10 dakika geçerlidir.\nEğer bu işlemi siz başlatmadıysanız bu e-postayı dikkate almayın.`,
    });
    if (process.env.NODE_ENV !== 'production') devCode = code;
  }

  res.json({
    message: 'E-posta adresiniz kayıtlıysa sıfırlama kodu gönderildi',
    devCode,
  });
});

router.post('/reset-password', verifyRateLimit, async (req, res) => {
  const parsed = ResetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  const { email, code, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { res.status(400).json({ error: 'Kod hatalı veya süresi doldu' }); return; }

  const ok = await verifyTwoFactorCode(`${user.id}:reset`, code);
  if (!ok) { res.status(400).json({ error: 'Kod hatalı veya süresi doldu' }); return; }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

  res.json({ message: 'Şifreniz başarıyla güncellendi' });
});

// ─── GET /auth/users/:id — public profile ─────────────────────────────────────

router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        city: true,
        avatar: true,
        rating: true,
        totalSwaps: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
      },
    });
    if (!user) { res.status(404).json({ error: 'Kullanıcı bulunamadı' }); return; }
    res.json(user);
  } catch (err) {
    console.error('[GET /auth/users/:id]', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

export default router;
