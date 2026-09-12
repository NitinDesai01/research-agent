/**
 * SoundManager — synthesizes soft UI chimes via Web Audio API.
 * No external audio files required.
 *
 * IMPORTANT: browsers suspend AudioContext until a user gesture.
 * Call `warmup()` from the first click handler to unlock playback.
 */
let audioCtx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Call this ONCE from a user click handler (e.g., the Research button).
 * It creates and resumes the AudioContext so subsequent chimes can play.
 */
export function warmup() {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    /* ignore */
  }
}

/**
 * Play a soft two-note chime.
 */
export function playChime({
  freqs = [660, 880],
  duration = 0.14,
  gain = 0.08,
  type = "sine",
} = {}) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = type;
    osc.frequency.value = f;

    const start = now + i * duration * 0.85;
    const end = start + duration * 1.6;

    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.02);
  });
}

export const sounds = {
  search: () => playChime({ freqs: [523.25, 659.25], gain: 0.07 }),
  read: () => playChime({ freqs: [587.33, 783.99], gain: 0.07 }),
  write: () => playChime({ freqs: [659.25, 880.0], gain: 0.08 }),
  verify: () => playChime({ freqs: [698.46, 932.33], gain: 0.07 }),
  critique: () => playChime({ freqs: [783.99, 1046.5], gain: 0.08 }),
  done: () =>
    playChime({ freqs: [659.25, 880.0, 1174.66], gain: 0.09, duration: 0.16 }),
  error: () => playChime({ freqs: [220, 165], gain: 0.08, type: "triangle" }),
};
