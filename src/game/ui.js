// UI vrstva: titulky, dialogy, volby, systémová okna, oznámení. Kreslí se na 640x480 canvas.
import { input } from '../engine/input.js';
import { sound } from '../engine/audio.js';

export const W = 640, H = 480;
export const FONT = '"DejaVu Sans Mono", "Liberation Mono", monospace';
const GLYPHS = '▓▒░█#@%&?¿§¤';

export function scramble(text, amount) {
  return [...text].map(c => (c !== ' ' && Math.random() < amount ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : c)).join('');
}

export function wrap(g, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export function panel(g, x, y, w, h, { bg = 'rgba(8,6,16,0.88)', border = '#9a8a6a' } = {}) {
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.strokeStyle = border; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
}

export class UI {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.dialog = null; this.choiceBox = null; this.sys = null;
    this.toasts = []; this.prompt = null; this.titleCard = null; this.overlay = null;
    this.subtitle = null; this.glitchText = 0; this.log = [];
  }
  get modal() { return !!(this.dialog || this.choiceBox || this.sys || this.codeBox); }

  say(speaker, text, opts = {}) {
    this.log.push(`${speaker ? speaker + ': ' : ''}${text}`);
    return new Promise(res => { this.dialog = { speaker, text, shown: 0, res, ...opts }; });
  }
  async lines(speaker, arr, opts) { for (const t of arr) await this.say(speaker, t, opts); }
  choice(text, options, opts = {}) {
    this.log.push(`[volba] ${text}`);
    return new Promise(res => { this.choiceBox = { text, options, sel: options.findIndex(o => !o.disabled), res, t: 0, ...opts }; });
  }
  system(lines, opts = {}) {
    this.log.push(`[systém] ${[].concat(lines).join(' / ')}`);
    sound.play(opts.sound ?? 'error');
    return new Promise(res => { this.sys = { lines: [].concat(lines), res, t: 0, title: opts.title ?? 'SYSTÉM', buttons: opts.buttons ?? ['OK'], sel: 0, minT: opts.minT ?? 0.4 }; });
  }
  /** Číselný zámek: vrátí zadaný kód (string) nebo null (zrušeno). */
  code(title, n = 4) {
    this.log.push(`[zámek] ${title}`);
    return new Promise(res => { this.codeBox = { title, d: Array(n).fill(0), i: 0, res, t: 0 }; });
  }
  toast(text, sec = 3) { this.log.push(`[info] ${text}`); this.toasts.push({ text, t: sec }); }
  title(text, sec = 2.5, sub = '') { this.titleCard = { text, sub, t: sec, max: sec }; }
  /** Tichý titulek bez nutnosti potvrzení (atmosféra). */
  caption(text, sec = 4) { this.log.push(`[titulek] ${text}`); this.subtitle = { text, t: sec }; }

  update(dt) {
    const d = this.dialog;
    if (d) {
      const before = Math.floor(d.shown);
      d.shown = Math.min(d.text.length, d.shown + dt * (d.speed ?? 38));
      if (!d.silent && Math.floor(d.shown) !== before && Math.floor(d.shown) % 3 === 0) sound.play('type', { vol: 0.5 });
      if (input.hit('act')) {
        input.consume('act');
        if (d.shown < d.text.length) d.shown = d.text.length;
        else { this.dialog = null; sound.play('blip', { vol: 0.4 }); d.res(); }
      }
    } else if (this.choiceBox) {
      const c = this.choiceBox; c.t += dt;
      const move = s => {
        let i = c.sel;
        for (let k = 0; k < c.options.length; k++) { i = (i + s + c.options.length) % c.options.length; if (!c.options[i].disabled || c.allowDisabled) break; }
        c.sel = i; sound.play('blip', { vol: 0.3 });
      };
      if (input.hit('up') || input.hit('left')) move(-1);
      if (input.hit('down') || input.hit('right')) move(1);
      if (input.hit('act') && c.t > 0.25) {
        input.consume('act');
        const o = c.options[c.sel];
        if (o.disabled) { sound.play('error'); this.glitchText = 0.5; if (o.onDisabled) o.onDisabled(); }
        else { this.choiceBox = null; sound.play('select'); c.res(c.sel); }
      }
    } else if (this.codeBox) {
      const c = this.codeBox; c.t += dt;
      if (input.hit('left')) { c.i = (c.i + c.d.length - 1) % c.d.length; sound.play('blip', { vol: 0.3 }); }
      if (input.hit('right')) { c.i = (c.i + 1) % c.d.length; sound.play('blip', { vol: 0.3 }); }
      if (input.hit('up')) { c.d[c.i] = (c.d[c.i] + 1) % 10; sound.play('click', { vol: 0.4 }); }
      if (input.hit('down')) { c.d[c.i] = (c.d[c.i] + 9) % 10; sound.play('click', { vol: 0.4 }); }
      if (input.hit('back')) { this.codeBox = null; c.res(null); }
      else if (input.hit('act') && c.t > 0.25) { input.consume('act'); this.codeBox = null; c.res(c.d.join('')); }
    } else if (this.sys) {
      const s = this.sys; s.t += dt;
      if (input.hit('left') || input.hit('right')) { s.sel = (s.sel + 1) % s.buttons.length; sound.play('blip', { vol: 0.3 }); }
      if (input.hit('act') && s.t > s.minT) { input.consume('act'); this.sys = null; sound.play('blip'); s.res(s.sel); }
    }
    this.toasts.forEach(t => (t.t -= dt)); this.toasts = this.toasts.filter(t => t.t > 0);
    if (this.titleCard && (this.titleCard.t -= dt) <= 0) this.titleCard = null;
    if (this.subtitle && (this.subtitle.t -= dt) <= 0) this.subtitle = null;
    this.glitchText = Math.max(0, this.glitchText - dt);
  }

  draw() {
    const g = this.g;
    g.clearRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    if (this.overlay) this.overlay(g);
    if (this.titleCard) {
      const tc = this.titleCard, a = Math.min(1, tc.t, (tc.max - tc.t) * 2);
      g.globalAlpha = a; g.textAlign = 'center';
      g.font = `bold 28px ${FONT}`; g.fillStyle = '#000'; g.fillText(tc.text, W / 2 + 2, 92);
      g.fillStyle = '#e8d8b0'; g.fillText(tc.text, W / 2, 90);
      if (tc.sub) { g.font = `14px ${FONT}`; g.fillStyle = '#a89878'; g.fillText(tc.sub, W / 2, 114); }
      g.globalAlpha = 1; g.textAlign = 'left';
    }
    if (this.subtitle && !this.dialog && !this.hideSubs) {
      g.font = `italic 16px ${FONT}`; g.textAlign = 'center';
      const L = wrap(g, this.subtitle.text, 560);
      L.forEach((l, i) => { const y = H - 40 - (L.length - 1 - i) * 20; g.fillStyle = '#000'; g.fillText(l, W / 2 + 1, y + 1); g.fillStyle = '#d8d0c0'; g.fillText(l, W / 2, y); });
      g.textAlign = 'left';
    }
    if (this.prompt && !this.modal) {
      g.font = `bold 14px ${FONT}`;
      const t = `[E] ${this.prompt}`, w = g.measureText(t).width + 20;
      panel(g, W - w - 12, H - 44, w, 32);
      g.fillStyle = '#e8d8b0'; g.fillText(t, W - w - 2, H - 23);
    }
    this.toasts.forEach((t, i) => {
      g.font = `bold 15px ${FONT}`;
      const w = g.measureText(t.text).width + 28;
      g.globalAlpha = Math.min(1, t.t * 2);
      panel(g, (W - w) / 2, 16 + i * 40, w, 32, { border: '#c8a040' });
      g.fillStyle = '#f0e0a0'; g.textAlign = 'center'; g.fillText(t.text, W / 2, 37 + i * 40); g.textAlign = 'left';
      g.globalAlpha = 1;
    });
    if (this.dialog) {
      const d = this.dialog;
      panel(g, 20, H - 140, W - 40, 124);
      let y = H - 112;
      if (d.speaker) { g.font = `bold 16px serif`; g.fillStyle = d.color ?? '#e0b050'; g.fillText(d.speaker.toUpperCase(), 40, y); y += 24; }
      g.font = `16px ${FONT}`; g.fillStyle = '#e8e4d8';
      let txt = d.text.slice(0, Math.floor(d.shown));
      if (d.glitch) txt = scramble(txt, d.glitch);
      wrap(g, txt, W - 90).slice(0, 4).forEach((l, i) => g.fillText(l, 40, y + i * 21));
      if (d.shown >= d.text.length && Math.floor(performance.now() / 400) % 2) { g.fillStyle = '#e0b050'; g.fillText('▼', W - 50, H - 28); }
    }
    if (this.choiceBox) {
      const c = this.choiceBox;
      const h = 70 + c.options.length * 26;
      panel(g, 120, (H - h) / 2, 400, h);
      g.font = `bold 16px ${FONT}`; g.fillStyle = '#e8d8b0'; g.textAlign = 'center';
      wrap(g, c.text, 360).forEach((l, i) => g.fillText(l, W / 2, (H - h) / 2 + 32 + i * 20));
      c.options.forEach((o, i) => {
        const y = (H - h) / 2 + 66 + i * 26;
        let label = o.label;
        if (o.disabled) label = scramble(label, o.glitch ?? 0.15 + this.glitchText);
        g.fillStyle = o.disabled ? '#5a5250' : i === c.sel ? '#ffd870' : '#c8c0b0';
        g.fillText((i === c.sel ? '▶ ' : '  ') + label, W / 2, y);
      });
      g.textAlign = 'left';
    }
    if (this.codeBox) {
      const c = this.codeBox;
      panel(g, 170, 150, 300, 170);
      g.textAlign = 'center'; g.font = `bold 15px ${FONT}`; g.fillStyle = '#e8d8b0'; g.fillText(c.title, W / 2, 182);
      c.d.forEach((v, i) => {
        const x = W / 2 + (i - (c.d.length - 1) / 2) * 52;
        g.fillStyle = i === c.i ? '#3a3020' : '#1a1610'; g.fillRect(x - 20, 200, 40, 56);
        g.strokeStyle = i === c.i ? '#ffd870' : '#6a5a40'; g.strokeRect(x - 20, 200, 40, 56);
        g.font = `bold 30px ${FONT}`; g.fillStyle = i === c.i ? '#ffd870' : '#c8c0b0'; g.fillText(String(v), x, 240);
      });
      g.font = `12px ${FONT}`; g.fillStyle = '#8a7a6a'; g.fillText('←→ číslice  ↑↓ změnit  [E] zkusit  [Esc] pryč', W / 2, 300);
      g.textAlign = 'left';
    }
    if (this.sys) {
      const s = this.sys;
      g.font = `bold 15px ${FONT}`;
      const h = 90 + s.lines.length * 22;
      const y0 = (H - h) / 2;
      g.fillStyle = '#000'; g.fillRect(70, y0 + 6, 512, h);
      g.fillStyle = '#1b2a6a'; g.fillRect(64, y0, 512, h);
      g.strokeStyle = '#c8c8e0'; g.lineWidth = 2; g.strokeRect(65, y0 + 1, 510, h - 2);
      g.fillStyle = '#c8c8e0'; g.fillRect(64, y0, 512, 24);
      g.fillStyle = '#1b2a6a'; g.fillText(s.title, 76, y0 + 17);
      g.fillStyle = '#ffffff'; g.textAlign = 'center';
      s.lines.forEach((l, i) => g.fillText(l, W / 2, y0 + 52 + i * 22));
      s.buttons.forEach((b, i) => {
        const x = W / 2 + (i - (s.buttons.length - 1) / 2) * 140;
        g.fillStyle = i === s.sel ? '#ffd870' : '#8a8ab0';
        g.fillText(i === s.sel ? `[ ${b} ]` : b, x, y0 + h - 20);
      });
      g.textAlign = 'left';
    }
  }
}
