let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.05, at = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  o.connect(g);
  g.connect(c.destination);
  const t = c.currentTime + at;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function sfx(kind: "play" | "move" | "combat" | "score" | "win" | "ui" | "channel") {
  switch (kind) {
    case "ui":
      tone(520, 0.06, "triangle", 0.03);
      break;
    case "play":
      tone(280, 0.12, "square", 0.04);
      tone(420, 0.1, "triangle", 0.03, 0.04);
      break;
    case "channel":
      tone(240, 0.08, "sine", 0.04);
      tone(360, 0.1, "sine", 0.03, 0.05);
      break;
    case "move":
      tone(180, 0.1, "sawtooth", 0.025);
      break;
    case "combat":
      tone(90, 0.18, "square", 0.06);
      tone(140, 0.12, "sawtooth", 0.04, 0.04);
      break;
    case "score":
      tone(440, 0.1, "triangle", 0.05);
      tone(660, 0.14, "triangle", 0.04, 0.08);
      break;
    case "win":
      tone(392, 0.16, "triangle", 0.05);
      tone(523, 0.18, "triangle", 0.045, 0.12);
      tone(659, 0.28, "triangle", 0.05, 0.24);
      break;
    default:
      break;
  }
}
