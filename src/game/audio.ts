/** Small procedural SFX bus. No sampled Riot audio — oscillators only. */

export type SfxName =
  | "click"
  | "ui"
  | "play"
  | "channel"
  | "march"
  | "showdown"
  | "score"
  | "hold"
  | "deny"
  | "invite"
  | "ready"
  | "win"
  | "combat"
  | "move"
  | "pack"
  | "reveal";

type Cue = SfxName;

let ctx: AudioContext | null = null;
let unlocked = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  c: AudioContext,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.05,
  at = 0,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noiseBurst(c: AudioContext, dur: number, gain: number, at = 0) {
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  src.buffer = buf;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.start(t);
  src.stop(t + dur + 0.02);
}

class SoundManager {
  muted = false;

  setMuted(next: boolean) {
    this.muted = next;
  }

  unlock() {
    const c = ac();
    unlocked = !!c;
    return unlocked;
  }

  play(kind: Cue) {
    if (this.muted) return;
    const c = ac();
    if (!c) return;
    switch (kind) {
      case "click":
      case "ui":
        tone(c, 620, 0.045, "triangle", 0.028);
        break;
      case "play":
        tone(c, 280, 0.11, "square", 0.035);
        tone(c, 420, 0.09, "triangle", 0.028, 0.035);
        break;
      case "channel":
        tone(c, 220, 0.08, "sine", 0.036);
        tone(c, 330, 0.1, "sine", 0.028, 0.05);
        tone(c, 440, 0.08, "sine", 0.02, 0.1);
        break;
      case "move":
      case "march":
        tone(c, 170, 0.09, "sawtooth", 0.022);
        tone(c, 255, 0.07, "triangle", 0.018, 0.05);
        break;
      case "combat":
      case "showdown":
        noiseBurst(c, 0.12, 0.05);
        tone(c, 86, 0.16, "square", 0.05);
        tone(c, 140, 0.11, "sawtooth", 0.032, 0.04);
        break;
      case "score":
        tone(c, 440, 0.09, "triangle", 0.045);
        tone(c, 660, 0.13, "triangle", 0.036, 0.07);
        break;
      case "hold":
        tone(c, 392, 0.1, "sine", 0.04);
        tone(c, 588, 0.14, "triangle", 0.032, 0.06);
        break;
      case "deny":
        tone(c, 160, 0.12, "square", 0.03);
        tone(c, 110, 0.14, "sawtooth", 0.022, 0.05);
        break;
      case "invite":
        tone(c, 494, 0.06, "triangle", 0.03);
        tone(c, 740, 0.08, "sine", 0.024, 0.05);
        break;
      case "ready":
        tone(c, 520, 0.07, "sine", 0.03);
        tone(c, 780, 0.09, "triangle", 0.022, 0.05);
        break;
      case "win":
        tone(c, 392, 0.15, "triangle", 0.045);
        tone(c, 523, 0.16, "triangle", 0.04, 0.11);
        tone(c, 659, 0.26, "triangle", 0.045, 0.22);
        break;
      case "pack":
        noiseBurst(c, 0.1, 0.04);
        tone(c, 180, 0.12, "sawtooth", 0.03);
        tone(c, 360, 0.1, "triangle", 0.026, 0.06);
        tone(c, 540, 0.09, "sine", 0.02, 0.12);
        break;
      case "reveal":
        tone(c, 660, 0.07, "triangle", 0.03);
        tone(c, 880, 0.09, "sine", 0.022, 0.05);
        break;
      default:
        break;
    }
  }
}

export const sound = new SoundManager();

export function unlockAudio() {
  sound.unlock();
}

export function setMuted(next: boolean) {
  sound.setMuted(next);
}

export function sfx(kind: SfxName) {
  sound.play(kind);
}
