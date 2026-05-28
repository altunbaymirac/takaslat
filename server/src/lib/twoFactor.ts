import bcrypt from 'bcryptjs';

const codes = new Map<string, { hash: string; expiresAt: number }>();

export function generateTwoFactorCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeTwoFactorCode(userId: string, code: string) {
  codes.set(userId, {
    hash: await bcrypt.hash(code, 8),
    expiresAt: Date.now() + 10 * 60_000,
  });
}

export async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const stored = codes.get(userId);
  if (!stored || stored.expiresAt < Date.now()) {
    codes.delete(userId);
    return false;
  }
  const ok = await bcrypt.compare(code, stored.hash);
  if (ok) codes.delete(userId);
  return ok;
}
