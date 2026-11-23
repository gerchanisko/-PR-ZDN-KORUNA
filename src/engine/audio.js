// Veškerý zvuk je syntetizovaný kódem do bufferů s nízkým vzorkováním a bitovou hloubkou.
import { rng } from '../assets/textures.js';

const SR = 22050;
const TAU = Math.PI * 2;

function crush(a, hold = 2, bits = 8) {
  const q = (1 << (bits - 1));
  let v = 0;
  for (let i = 0; i < a.length; i++) { if (i % hold === 0) v = Math.round(a[i] * q) / q; a[i] = v; }
  return a;
}
function lp(a, k) { let y = 0; for (let i = 0; i < a.length; i++) { y += (a[i] - y) * k; a[i] = y; } return a; }
function norm(a, peak = 0.9) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
const len = s => Math.floor(s * SR);
const loopF = (f, sec) => Math.max(1, Math.round(f * sec)) / sec; // celé periody => bezešvá smyčka

function drone(sec, base, seed, { noise = 0.15, crackle = 0.4, partials = [1, 1.5, 2.01, 3.02] } = {}) {
  const r = rng(seed), a = new Float32Array(len(sec));
  const fs = partials.map(p => loopF(base * p, sec));
  const lfo = loopF(0.25, sec), lfo2 = loopF(0.13, sec);
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    let v = 0;
    fs.forEach((f, k) => { v += Math.sin(TAU * f * t + k) * (0.5 / (k + 1)) * (0.6 + 0.4 * Math.sin(TAU * (k % 2 ? lfo : lfo2) * t + k)); });
    n += ((r() * 2 - 1) - n) * 0.05;
    v += n * noise;
    if (r() < 0.0004 * crackle) v += (r() - 0.5) * 1.5;
    a[i] = v;
  }
  return crush(norm(a, 0.6), 3, 6);
}

function tone(sec, f, { wave = 'sq', decay = 8, vol = 1, slide = 0 } = {}) {
  const a = new Float32Array(len(sec));
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (f + slide * t) / SR;
    const p = ph % 1;
    let v = wave === 'sq' ? (p < 0.5 ? 1 : -1) : wave === 'tri' ? 4 * Math.abs(p - 0.5) - 1 : wave === 'saw' ? 2 * p - 1 : Math.sin(TAU * p);
    a[i] = v * Math.exp(-t * decay) * vol;
  }
  return a;
}
function mix(...arrs) { const L = Math.max(...arrs.map(x => x.a.length + (x.at || 0))); const o = new Float32Array(L); arrs.forEach(({ a, at = 0, g = 1 }) => { for (let i = 0; i < a.length; i++) o[i + at] += a[i] * g; }); return o; }
function noiseBuf(sec, seed, k = 0.3, env = t => 1) { const r = rng(seed); const a = new Float32Array(len(sec)); for (let i = 0; i < a.length; i++) a[i] = (r() * 2 - 1) * env(i / SR); return lp(a, k); }

export const GEN = {
  // --- ambienty (smyčky)
  ambMenu: () => { const a = drone(8, 55, 1, { noise: 0.25 }); const w = tone(8, loopF(1760, 8), { wave: 'sin', decay: 0, vol: 0.03 }); return crush(mix({ a }, { a: w }), 3, 6); },
  ambHub: () => {
    // "fantasy" hudba z roku 1998, která se trochu rozpadá
    const bpm = 66, beat = 60 / bpm, notes = [
      [57, 2], [60, 1], [64, 1], [62, 2], [60, 1], [59, 1], [57, 2], [55, 2], [57, 4],
      [64, 2], [65, 1], [64, 1], [62, 2], [60, 2], [59, 2], [56, 2], [57, 4]];
    const total = notes.reduce((s, n) => s + n[1], 0) * beat;
    const out = new Float32Array(len(total + 0.01));
    let t = 0;
    const r = rng(5);
    notes.forEach(([m, d], i) => {
      const detune = r() < 0.15 ? 0.45 : 0; // "špatné" noty
      const f = 440 * Math.pow(2, (m - 69 + detune) / 12);
      const n = tone(d * beat, f, { wave: 'tri', decay: 1.2, vol: 0.5 });
      const b = tone(d * beat, f / 4, { wave: 'sq', decay: 0.8, vol: 0.12 });
      const st = len(t);
      if (!(i === 9)) for (let k = 0; k < n.length && st + k < out.length; k++) out[st + k] += n[k] + b[k]; // jedna nota chybí
      t += d * beat;
    });
    const dr = drone(total, 55, 2, { noise: 0.08, crackle: 1 });
    for (let i = 0; i < out.length; i++) out[i] = out[i] * 0.6 + (dr[i] || 0) * 0.35;
    return crush(lp(out, 0.5), 2, 6);
  },
  ambKitchen: () => {
    const sec = 8, a = drone(sec, 50, 3, { partials: [1, 2, 3, 4.02], noise: 0.06, crackle: 0.2 });
    for (let s = 0; s < sec; s++) { const c = tone(0.03, 2400, { wave: 'sq', decay: 120, vol: 0.5 }); const st = len(s); for (let k = 0; k < c.length; k++) a[st + k] += c[k]; }
    return a;
  },
  ambArmory: () => {
    const sec = 12, a = drone(sec, 36.7, 4, { partials: [1, 1.41, 2.13, 2.9], noise: 0.2, crackle: 0.8 });
    const r = rng(9);
    for (let i = 0; i < 4; i++) { const c = tone(0.6, 180 + r() * 200, { wave: 'saw', decay: 4, vol: 0.12, slide: -80 }); const st = len(r() * (sec - 1)); for (let k = 0; k < c.length; k++) a[st + k] += c[k]; }
    return a;
  },
  ambMemory: () => {
    const sec = 4, a = noiseBuf(sec, 11, 0.6, () => 0.05);
    for (let s = 0; s < sec; s++) { const c = tone(0.04, 1800, { wave: 'sq', decay: 90, vol: 0.4 }); const st = len(s); for (let k = 0; k < c.length; k++) a[st + k] += c[k]; }
    return crush(a, 2, 6);
  },
  stalker: () => { // dech + hluboké bručení, smyčka
    const sec = 3, a = noiseBuf(sec, 12, 0.08, t => Math.pow(Math.sin(Math.PI * (t % 1.5) / 1.5), 2) * 1.2);
    const h = tone(sec, loopF(41, sec), { wave: 'saw', decay: 0, vol: 0.18 });
    return crush(norm(mix({ a }, { a: lp(h, 0.1) }), 0.8), 3, 6);
  },
  heartbeat: () => { const a = new Float32Array(len(1)); [0, 0.22].forEach(at => { const b = tone(0.15, 55, { wave: 'sin', decay: 20 }); for (let k = 0; k < b.length; k++) a[len(at) + k] += b[k] * 0.9; }); return a; },
  // --- efekty
  step: () => noiseBuf(0.07, 13, 0.15, t => Math.exp(-t * 50)),
  blip: () => tone(0.05, 880, { decay: 40, vol: 0.4 }),
  select: () => mix({ a: tone(0.05, 660, { decay: 30, vol: 0.4 }) }, { a: tone(0.08, 990, { decay: 20, vol: 0.4 }), at: len(0.05) }),
  error: () => crush(mix({ a: tone(0.35, 110, { decay: 3, vol: 0.3 }) }, { a: tone(0.35, 117, { decay: 3, vol: 0.3 }) }), 4, 5),
  type: () => tone(0.015, 1400, { decay: 200, vol: 0.12 }),
  glitch: () => { const r = rng(14); const a = new Float32Array(len(0.45)); let v = 0; for (let i = 0; i < a.length; i++) { if (i % (20 + Math.floor(r() * 200)) === 0) v = r() * 2 - 1; a[i] = v * 0.6; } return crush(a, 6, 3); },
  door: () => mix({ a: tone(0.5, 160, { wave: 'saw', decay: 3, vol: 0.25, slide: 120 }) }, { a: noiseBuf(0.25, 15, 0.08, t => Math.exp(-t * 18)), at: len(0.45) }),
  locked: () => mix({ a: noiseBuf(0.1, 16, 0.3, t => Math.exp(-t * 40)) }, { a: noiseBuf(0.1, 17, 0.3, t => Math.exp(-t * 40)), at: len(0.12) }),
  save: () => { const parts = [523, 659, 784, 1046].map((f, i) => ({ a: tone(0.12, f, { decay: 10, vol: 0.35 }), at: len(i * 0.1) })); return mix(...parts); },
  saveSad: () => { const fs = [220, 261.6, 329.6, 311]; return crush(norm(mix(...fs.map(f => ({ a: tone(3, f, { wave: 'tri', decay: 0.9, vol: 0.4, slide: -6 }) })))), 3, 5); },
  crystal: () => { const fs = [1046, 1318, 1568, 2093, 2637]; return mix(...fs.map((f, i) => ({ a: tone(2.5, f, { wave: 'sin', decay: 1.5 + i * 0.4, vol: 0.3 }), at: len(i * 0.07) }))); },
  pickup: () => mix({ a: tone(0.1, 1200, { decay: 20, vol: 0.3 }) }, { a: tone(0.15, 1600, { decay: 15, vol: 0.3 }), at: len(0.08) }),
  ignite: () => noiseBuf(0.8, 18, 0.3, t => Math.min(1, t * 6) * Math.exp(-t * 3)),
  hiss: () => noiseBuf(0.6, 19, 0.6, t => Math.exp(-t * 6) * 0.6),
  click: () => tone(0.03, 300, { decay: 80, vol: 0.6 }),
  tick: () => tone(0.03, 1800, { decay: 90, vol: 0.5 }),
  thud: () => lp(tone(0.6, 45, { wave: 'sin', decay: 6, vol: 1 }), 0.3),
  discSeek: () => { const r = rng(20); const a = new Float32Array(len(1.2)); for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = (r() * 2 - 1) * 0.15 * (0.5 + 0.5 * Math.sin(TAU * 7 * t)) + Math.sin(TAU * 90 * t) * 0.05; } return crush(a, 4, 4); },
  buzz: () => crush(mix({ a: tone(2, 118, { wave: 'sq', decay: 0, vol: 0.35 }) }, { a: tone(2, 236.5, { wave: 'saw', decay: 0, vol: 0.2 }) }), 2, 4),
  bootChime: () => { const fs = [392, 523, 784, 659]; return lp(mix(...fs.map((f, i) => ({ a: tone(2.8, f, { wave: 'sin', decay: 1.1, vol: 0.35 }), at: len(i * 0.18) }))), 0.4); },
  sting: () => crush(norm(mix({ a: noiseBuf(1.5, 21, 0.05, t => Math.exp(-t * 2)) }, { a: tone(1.5, 73, { wave: 'saw', decay: 1.5, vol: 0.8 }) }, { a: tone(1.5, 77.8, { wave: 'saw', decay: 1.5, vol: 0.8 }) })), 3, 5),
  whoosh: () => noiseBuf(0.5, 22, 0.2, t => Math.sin(Math.PI * t / 0.5)),
  // --- plná hra
  bell: () => { const f0 = 220; const ps = [0.5, 1, 1.19, 1.5, 2, 2.51, 2.99]; return crush(norm(mix(...ps.map((p, i) => ({ a: tone(4, f0 * p, { wave: 'sin', decay: 0.6 + i * 0.35, vol: 1 / (i + 1) }) })))), 2, 6); },
  handbell: () => { const ps = [1, 2.4, 3.9]; return norm(mix(...ps.map((p, i) => ({ a: tone(0.9, 1400 * p, { wave: 'sin', decay: 5 + i * 3, vol: 1 / (i + 1) }) }))), 0.5); },
  bubbles: () => { const r = rng(30); const a = new Float32Array(len(1.2)); for (let k = 0; k < 7; k++) { const b = tone(0.08, 400 + r() * 900, { wave: 'sin', decay: 40, vol: 0.4, slide: 3000 }); const st = len(r() * 1.1); for (let i = 0; i < b.length && st + i < a.length; i++) a[st + i] += b[i]; } return a; },
  ambChurch: () => {
    const sec = 10, a = drone(sec, 41.2, 31, { partials: [1, 1.5, 2, 3.01], noise: 0.35, crackle: 0.2 });
    lp(a, 0.25);
    const r = rng(32);
    for (let k = 0; k < 12; k++) { const b = tone(0.06, 500 + r() * 700, { wave: 'sin', decay: 50, vol: 0.25, slide: 2500 }); const st = len(r() * (sec - 0.1)); for (let i = 0; i < b.length; i++) a[st + i] += b[i]; }
    return crush(a, 3, 6);
  },
  ambSchool: () => {
    const sec = 6, a = tone(sec, loopF(100, sec), { wave: 'saw', decay: 0, vol: 0.06 });
    const h = tone(sec, loopF(200, sec), { wave: 'sin', decay: 0, vol: 0.05 });
    const d = drone(sec, 49, 33, { noise: 0.05, crackle: 0.3 });
    for (let i = 0; i < a.length; i++) a[i] = a[i] * 1.6 + h[i] * 1.5 + d[i] * 0.6;
    for (let s = 0; s < sec; s++) { const c = tone(0.03, 2000, { wave: 'sq', decay: 100, vol: 0.3 }); const st = len(s); for (let k = 0; k < c.length; k++) a[st + k] += c[k]; }
    return crush(a, 2, 6);
  },
  ambBoss: () => { const a = drone(12, 27.5, 34, { partials: [1, 1.06, 2, 2.13, 3, 4.24], noise: 0.25, crackle: 1.5 }); return a; },
  ambCredits: () => {
    // klidná durová melodie – až moc klidná
    const beat = 0.6, seq = [60, 64, 67, 72, 67, 64, 60, 64, 65, 69, 72, 69, 65, 69, 67, 71, 74, 71, 67, 71, 60, 64, 67, 72];
    const out = new Float32Array(len(seq.length * beat));
    seq.forEach((m, i) => { const n = tone(beat * 1.5, 440 * Math.pow(2, (m - 69) / 12), { wave: 'tri', decay: 2, vol: 0.35 }); const st = len(i * beat); for (let k = 0; k < n.length && st + k < out.length; k++) out[st + k] += n[k]; });
    return crush(lp(out, 0.4), 2, 7);
  },
  crtOff: () => mix({ a: tone(0.4, 15600 / 2, { wave: 'sin', decay: 6, vol: 0.15 }) }, { a: lp(tone(0.5, 60, { wave: 'sin', decay: 9, vol: 1 }), 0.4), at: len(0.05) }, { a: noiseBuf(0.15, 35, 0.5, t => Math.exp(-t * 30)) }),
  fill: () => { const parts = [523, 587, 659, 698, 784, 880, 988, 1046].map((f, i) => ({ a: tone(0.18, f, { wave: 'tri', decay: 8, vol: 0.3 }), at: len(i * 0.09) })); return mix(...parts); },
};

export class Sound {
  constructor() { this.ctx = null; this.buffers = {}; this.amb = null; this.loops = new Set(); this.muted = false; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ sampleRate: 44100 });
    this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
    this.ambBus = this.ctx.createGain(); this.ambBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
    for (const [k, fn] of Object.entries(GEN)) {
      const data = fn();
      const b = this.ctx.createBuffer(1, data.length, SR);
      b.copyToChannel(data, 0);
      this.buffers[k] = b;
    }
  }
  play(name, { vol = 1, rate = 1 } = {}) {
    if (!this.ctx || !this.buffers[name]) return null;
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.sfxBus); s.start();
    return s;
  }
  loop(name, vol = 1, bus = 'sfx') {
    if (!this.ctx) return { set() {}, stop() {} };
    const s = this.ctx.createBufferSource(); s.buffer = this.buffers[name]; s.loop = true;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(bus === 'amb' ? this.ambBus : this.sfxBus); s.start();
    const h = {
      src: s, gain: g,
      set: (v, t = 0.1) => g.gain.setTargetAtTime(v, this.ctx.currentTime, t),
      rate: (r) => { s.playbackRate.value = r; },
      stop: (fade = 0.3) => { g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3); setTimeout(() => { try { s.stop(); } catch {} }, fade * 1000 + 50); this.loops.delete(h); },
    };
    this.loops.add(h);
    return h;
  }
  ambient(name, vol = 0.6, fade = 1) {
    if (this.amb && this.amb.name === name) return;
    if (this.amb) this.amb.h.stop(fade);
    this.amb = name ? { name, h: this.loop(name, 0, 'amb') } : null;
    if (this.amb) this.amb.h.set(vol, fade / 3);
  }
  /** Ticho před událostí: ztlumí ambient. */
  silence(on, t = 0.3) { if (this.ctx) this.ambBus.gain.setTargetAtTime(on ? 0 : 1, this.ctx.currentTime, t); }
  stopAll() { for (const h of [...this.loops]) h.stop(0.05); this.amb = null; }
  /** Zadrhnutí zvuku při zamrznutí obrazu. */
  stutter(sec = 0.4) {
    if (!this.ctx) return;
    this.master.gain.setValueAtTime(0.8, this.ctx.currentTime);
    for (let i = 0; i < sec / 0.06; i++) this.master.gain.setValueAtTime(i % 2 ? 0.8 : 0.0, this.ctx.currentTime + i * 0.06);
    this.master.gain.setValueAtTime(0.8, this.ctx.currentTime + sec);
  }
}
export const sound = new Sound();
