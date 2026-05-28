/**
 * Sesli bildirim — Web Audio API ile inline beep
 * (harici dosya gerekmez, ses üreten)
 */

let audioCtx: AudioContext | null = null;
let enabled  = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    audioCtx = new C();
  }
  return audioCtx;
}

export function setSoundEnabled(on: boolean) { enabled = on; }
export function isSoundEnabled(): boolean    { return enabled; }

/** İki tonlu kısa "ding" — teklif/mesaj geldiğinde */
export function playDing() {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now  = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.value = 0.12;
  gain.connect(ctx.destination);

  // İlk ton (E5)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 659.25;
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.18);

  // İkinci ton (G5) — biraz sonra
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 783.99;
  osc2.connect(gain);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.35);

  // Fade-out
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
}

/** Kısa pozitif "tıngırdama" — başarı için */
export function playSuccess() {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.value = 0.15;
  gain.connect(ctx.destination);

  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(now + i * 0.08);
    osc.stop(now + i * 0.08 + 0.15);
  });

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
}
