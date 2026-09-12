/**
 * SoundManager — synthesizes soft UI chimes via Web Audio API.
 * No external audio files required.
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
  // Some browsers suspend the context until user interaction
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a soft two-note chime.
 * @param {object} opts
 * @param {number[]} opts.freqs - Frequencies (Hz) to play in sequence
 * @param {number} opts.duration - Duration of each note in seconds
 * @param {number} opts.gain - Volume (0..1)
 * @param {"sine"|"triangle"} opts.type - Waveform
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

    // Envelope: quick attack, gentle decay
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

/* Predefined sounds */
export const sounds = {
  search: () => playChime({ freqs: [523.25, 659.25], gain: 0.07 }),
  read:   () => playChime({ freqs: [587.33, 783.99], gain: 0.07 }),
  write:  () => playChime({ freqs: [659.25, 880.00], gain: 0.08 }),
  verify: () => playChime({ freqs: [698.46, 932.33], gain: 0.07 }),
  critique: () => playChime({ freqs: [783.99, 1046.5], gain: 0.08 }),
  done:   () => playChime({ freqs: [659.25, 880.00, 1174.66], gain: 0.09, duration: 0.16 }),
  error:  () => playChime({ freqs: [220, 165], gain: 0.08, type: "triangle" }),
};