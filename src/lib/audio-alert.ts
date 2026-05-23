// Lightweight Web Audio chime. Synthesised — no asset file, no autoplay hassles
// once the user has clicked anywhere on the page. Falls back to silent no-op if
// AudioContext is unavailable (older mobile Safari, headless browsers).

let ctx: AudioContext | null = null;
let unlockedAt = 0;

type AudioContextCtor = typeof AudioContext;

function getCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Attach a one-time pointer/key listener that resumes a suspended AudioContext
 *  on the first user gesture — required by Chrome's autoplay policy. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  if (unlockedAt > 0) return;
  const handler = () => {
    unlockedAt = Date.now();
    const c = ensureCtx();
    if (c && c.state === 'suspended') {
      void c.resume().catch(() => {/* ignore */});
    }
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler, { once: true });
  window.addEventListener('keydown', handler, { once: true });
}

/** Two-note chime: 880Hz → 660Hz, 220ms total. Silently no-ops on failure. */
export function playNewOrderChime(): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    void c.resume().catch(() => {/* ignore */});
  }
  const now = c.currentTime;
  const dur1 = 0.11;
  const dur2 = 0.13;

  const playTone = (freq: number, start: number, dur: number) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start + dur);
  };

  try {
    playTone(880, now, dur1);
    playTone(660, now + dur1, dur2);
  } catch {
    /* swallow — user has likely closed the tab mid-call */
  }
}
