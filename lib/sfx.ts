/**
 * Synthesized cyberpunk SFX (Web Audio, no asset files). Subtle by design.
 * Safe to import in client components; all browser access is guarded.
 */

let ctx: AudioContext | null = null;
let enabled = true;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  if (!enabled) return;
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  init() {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("billtime.sfx");
    enabled = saved !== "off";
  },
  isOn() {
    return enabled;
  },
  setOn(v: boolean) {
    enabled = v;
    if (typeof window !== "undefined") window.localStorage.setItem("billtime.sfx", v ? "on" : "off");
    if (v) tone(760, 0.05, "square", 0.04);
  },
  hover() {
    tone(1200, 0.025, "square", 0.012);
  },
  click() {
    tone(540, 0.05, "square", 0.04, 900);
  },
  confirm() {
    tone(660, 0.06, "sine", 0.05);
    setTimeout(() => tone(1040, 0.09, "sine", 0.05), 55);
  },
  start() {
    tone(380, 0.08, "sawtooth", 0.04, 760);
  },
  stop() {
    tone(520, 0.1, "sawtooth", 0.045, 180);
  },
  error() {
    tone(200, 0.18, "sawtooth", 0.05);
  },
};
