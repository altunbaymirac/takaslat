import { describe, it, expect } from 'vitest';
import { detectBot, MIN_FILL_MS } from './botGuard';

describe('detectBot', () => {
  const start = 1_000_000;

  it('bal küpü alanı doluysa botu yakalar', () => {
    expect(detectBot({ honeypot: 'http://spam.example', startedAt: start, now: start + 60_000 })).toBe('honeypot');
  });

  it('form insan hızının altında gönderildiyse yakalar', () => {
    expect(detectBot({ honeypot: '', startedAt: start, now: start + MIN_FILL_MS - 1 })).toBe('too_fast');
  });

  it('normal bir kullanıcıyı geçirir', () => {
    expect(detectBot({ honeypot: '', startedAt: start, now: start + 15_000 })).toBeNull();
  });

  it('yalnızca boşluktan oluşan bal küpünü dolu saymaz', () => {
    expect(detectBot({ honeypot: '   ', startedAt: start, now: start + 15_000 })).toBeNull();
  });
});
