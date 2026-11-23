// Herní tok: save krystaly, sbírání Krystalů paměti, návrat do hubu, pauza (a secret), tři konce.
import { props } from '../assets/models.js';
import { sound } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { W, H, FONT, scramble, wrap } from './ui.js';
import { ERASED, creditsRoster } from './lore.js';

export const LEVEL_ROOM = { 1: 'armory', 2: 'church', 3: 'school' };

/** Jméno uložené pozice (mění se konci). */
export const saveName = () => localStorage.getItem('pk-save-name') || 'NEHRÁT ZNOVU';

// ------------------------------------------------------------------ save krystal
export function addSaveCrystal(R, x, z, id, { face = [0, 1] } = {}) {
  const game = R.game, ui = game.ui, S = game.state, F = S.flags;
  const ped = props.pedestal(true); R.add(ped, x, 0, z); R.solid(ped);
  const c = ped.userData.crystal;
  const used = () => !!F['save_' + id];
  R.every((dt, t) => { c.userData.spin.rotation.y = t * 1.5; c.position.y = 1.45 + Math.sin(t * 2) * 0.05; c.visible = !used() || Math.sin(t * 20) > 0.6; });
  R.interact([x + face[0] * 1.1, z + face[1] * 1.1], () => (used() ? 'Krystal ukládání (kalný)' : 'Uložit hru'), async () => {
    if (used()) { await ui.say(null, 'Krystal je kalný. Uvnitř je vidět jen tvůj vlastní obrys.'); return; }
    const ch = await ui.choice('Krystal ukládání. Uložit hru na PAMĚŤOVOU KARTU 1?', [{ label: 'ANO' }, { label: 'NE' }]);
    if (ch !== 0) return;
    await saveSequence(game);
    F['save_' + id] = true;
  }, { radius: 1.3 });
}

async function saveSequence(game) {
  const ui = game.ui, S = game.state;
  sound.silence(true, 0.2);
  let p = 0;
  const prev = ui.overlay;
  ui.overlay = (g) => {
    prev?.(g);
    g.fillStyle = 'rgba(0,0,20,0.85)'; g.fillRect(120, 180, 400, 110);
    g.strokeStyle = '#c8c8e0'; g.strokeRect(121, 181, 398, 108);
    g.font = `bold 15px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center';
    g.fillText(p < 1 ? 'UKLÁDÁNÍ...' : 'ULOŽENO.', W / 2, 212);
    g.font = `12px ${FONT}`; g.fillStyle = '#aab';
    g.fillText(`Nevyjímejte PAMĚŤOVOU KARTU 1  –  „${saveName()}“`, W / 2, 234);
    g.fillStyle = '#334'; g.fillRect(170, 252, 300, 14);
    g.fillStyle = '#8fa8ff'; g.fillRect(170, 252, 300 * Math.min(1, p), 14);
    g.textAlign = 'left';
  };
  for (let i = 0; i < 8; i++) { await game.wait(0.22 + Math.random() * 0.2); p = (i + 1) / 8; sound.play('blip', { vol: 0.25, rate: 1 + i * 0.1 }); }
  sound.play('save');
  await game.wait(1.4);
  ui.overlay = prev;
  await game.wait(1.6); // ticho... a pak se něco změní
  S.saves++;
  S.erased.push(ERASED[S.saves] ?? 'něco');
  sound.play('saveSad', { vol: 0.8 });
  game.tear(0.5, 1.2); game.glitch.flash = 0.6;
  await game.wait(0.8);
  sound.silence(false, 2);
  ui.toast('Uloženo. Přepsán 1 blok.', 3.5);
}

// ------------------------------------------------------------------ Krystal paměti
export function addMemoryCrystal(R, n, x, z, y = 1.45, { face = [0, -1], label = 'Vzít Krystal paměti' } = {}) {
  const game = R.game, F = game.state.flags;
  const ped = props.pedestal(false); R.add(ped, x, y - 1.45, z); if (y < 2) R.solid(ped);
  const cr = ped.userData.crystal;
  cr.visible = !game.has('krystal' + n) && !(F.crown >= n);
  R.every((dt, t) => { cr.userData.spin.rotation.y = t * 1.2; cr.position.y = 1.45 + Math.sin(t * 1.6) * 0.06; });
  R.interact([x + face[0] * 1.1, z + face[1] * 1.1], label, async () => {
    if (R.stalker) R.stalker.mode = 'off';
    sound.silence(true, 0.1);
    await game.wait(1.2);
    sound.play('crystal'); game.glitch.flash = 1.2; cr.visible = false;
    game.give('krystal' + n, `KRYSTAL PAMĚTI  ${n}/3`);
    game.state.memory = n;
    await game.wait(1.5);
    await game.freeze(0.5);
    game.fadeV = 0;
    await game.loadRoom('memory', 'start', { fade: false });
  }, { radius: 1.3, cond: () => cr.visible });
  return ped;
}

/** Útěk z levelu zpátky do hubu: loading bar se zasekne na 99 %, pak skočí. */
export async function returnToHub(game, n) {
  if (game.state.flags['done' + n]) return;
  game.state.flags['done' + n] = true;
  game.lock++;
  if (game.room.stalker) game.room.stalker.mode = 'off';
  sound.play('door');
  await game.fade(0, 0.3);
  game.room.onLeave?.(); game.room.leaves.length = 0;
  sound.ambient(null, 0, 0.2);
  let p = 0;
  game.ui.overlay = (g) => loadingScreen(g, p, 'ARDEMOOR – NÁDVOŘÍ');
  game.fadeV = 1; game.fadeTarget = 1;
  game.room.scene.visible = false;
  for (const s of [14, 38, 61, 80, 92, 99]) { sound.play('discSeek', { vol: 0.4, rate: 0.9 + Math.random() * 0.3 }); await game.wait(0.25 + Math.random() * 0.3); p = s; }
  await game.wait(2.2);
  sound.play('glitch', { vol: 0.4 }); game.tear(0.2, 1);
  p = 100; await game.wait(0.3);
  game.ui.overlay = null;
  game.fadeV = 0;
  game.lock--;
  await game.loadRoom('hub', 'door' + n, { fade: false });
  await game.fade(1, 0.6);
}

export function loadingScreen(g, p, title, msg) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = `bold 16px ${FONT}`; g.fillStyle = '#c8b898'; g.fillText('NAČÍTÁNÍ', W / 2, 200);
  g.font = `13px ${FONT}`; g.fillStyle = '#8a7a6a'; g.fillText(title, W / 2, 222);
  g.strokeStyle = '#8a7a6a'; g.strokeRect(160, 250, 320, 18);
  g.fillStyle = '#c8a040'; g.fillRect(163, 253, 314 * p / 100, 12);
  g.fillStyle = '#c8b898'; g.fillText(`${Math.floor(p)} %`, W / 2, 292);
  if (msg) { g.fillStyle = '#6a5a5a'; g.fillText(msg, W / 2, 330); }
  g.textAlign = 'left';
}

// ------------------------------------------------------------------ pauza (+ secret konec)
export class Pause {
  constructor(game) { this.game = game; this.open = false; this.sel = 0; this.idle = 0; this.t = 0; }
  get crownDone() { return (this.game.state.flags.crown ?? 0) >= 3; }
  toggle() {
    this.open = !this.open; this.sel = 0; this.idle = 0; this.t = 0;
    sound.play(this.open ? 'select' : 'blip', { vol: 0.5 });
    this.game.ui.overlay = this.open ? (g) => this.draw(g) : null;
    this.game.ui.hideSubs = this.open;
    if (this.open) document.exitPointerLock?.();
    sound.silence(this.open, 0.3);
  }
  update(dt) {
    if (!this.open || this.busy) return;
    this.t += dt; this.idle += dt;
    const any = ['up', 'down', 'act', 'back', 'left', 'right', 'inv'].some(a => input.hit(a)) || input.anyKey;
    if (any) this.idle = 0;
    // SECRET: nechat Wrena v menu (po složení koruny)
    if (this.crownDone && this.idle > 40) { this.busy = true; secretEnding(this.game); return; }
    if (input.hit('back') && this.t > 0.2) { this.toggle(); return; }
    const n = 2;
    if (input.hit('up')) { this.sel = (this.sel + n - 1) % n; sound.play('blip', { vol: 0.3 }); }
    if (input.hit('down')) { this.sel = (this.sel + 1) % n; sound.play('blip', { vol: 0.3 }); }
    if (input.hit('act') && this.t > 0.2) {
      input.consume('act');
      if (this.sel === 0) this.toggle();
      else if (!this.crownDone) { sound.play('error'); this.game.tear(0.3, 0.7); this.err = 2; }
      else { this.busy = true; this.open = false; this.game.ui.hideSubs = false; consoleOffEnding(this.game); }
    }
    this.err = Math.max(0, (this.err ?? 0) - dt);
  }
  draw(g) {
    const glitch = this.crownDone ? Math.max(0, (this.idle - 12) / 28) : 0;
    g.fillStyle = `rgba(0,0,0,${0.7 + glitch * 0.25})`; g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.font = `bold 26px serif`; g.fillStyle = '#e8dcc0'; g.fillText(scramble('PAUZA', glitch * 0.5), W / 2, 150);
    const opts = ['POKRAČOVAT', 'VYPNOUT KONZOLI'];
    opts.forEach((o, i) => {
      g.font = `bold 18px ${FONT}`;
      const dis = i === 1 && !this.crownDone;
      g.fillStyle = dis ? '#5a5250' : i === this.sel ? '#ffd870' : '#c8c0b0';
      g.fillText((i === this.sel ? '▶ ' : '') + scramble(dis ? scramble(o, 0.15) : o, glitch * 0.3), W / 2, 230 + i * 34);
    });
    if (this.err > 0) { g.font = `12px ${FONT}`; g.fillStyle = '#c04040'; g.fillText('Ještě ne. Někdo ještě čeká.', W / 2, 310); }
    g.font = `12px ${FONT}`; g.fillStyle = '#6a6a6a';
    g.fillText(`Uloženo: „${saveName()}“   ·   Krystaly v koruně: ${this.game.state.flags.crown ?? 0}/3   ·   16:47`, W / 2, 420);
    if (glitch > 0.3) { g.fillStyle = `rgba(200,200,200,${glitch - 0.3})`; g.fillText('Tady se nikdo nebojí.', W / 2, 360); }
    if (glitch > 0.65) { g.fillStyle = `rgba(200,200,200,${glitch - 0.65})`; g.fillText('Zůstaň.', W / 2, 382); }
    g.textAlign = 'left';
  }
}

// ------------------------------------------------------------------ KONEC 1: Dohraješ hru
export async function finishEnding(game) {
  const ui = game.ui, S = game.state;
  game.mode = 'end'; S.ending = 'e1';
  sound.stopAll();
  localStorage.setItem('pk-save-name', 'DOKONČENO');
  await game.fade(0, 2);
  game.room?.onLeave?.(); game.room = null; game.ui.overlay = null;
  game.fadeV = 1; game.fadeTarget = 1;
  sound.ambient('ambCredits', 0.5, 2);
  const roster = creditsRoster(S);
  const lines = ['PRÁZDNÁ KORUNA', '', 'hra byla dohrána', '', '', ...roster.map(([a, b]) => `${a.padEnd(15, '.')} ${b}`), '', '',
    'Je 17:00.', 'Hodiny jdou.', '', 'Nikdo už nečeká.', 'Nikdo už není, kdo by čekal.', '', '', 'Děkujeme, že jste hráli.', '', '', '', 'KONEC 1 / 3', 'DOHRÁNO'];
  const t0 = game.time;
  ui.overlay = (g) => {
    const t = game.time - t0;
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#9ac0e0'); grd.addColorStop(1, '#f0e8d8');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    lines.forEach((l, i) => {
      const y = H + 40 + i * 28 - t * 32;
      const yy = Math.max(y, i >= lines.length - 2 ? H / 2 - 20 + (i - lines.length + 2) * 36 : -100);
      g.font = i === 0 || i >= lines.length - 2 ? `bold 26px serif` : `16px ${FONT}`;
      g.fillStyle = l.startsWith('Tomáš') ? '#a0a8b0' : '#3a4a5a';
      g.fillText(l, W / 2, yy);
    });
    g.textAlign = 'left';
  };
  const dur = (H + 40 + lines.length * 28) / 32;
  await game.wait(dur - 4);
  S.ending = 'e1-done';
  await waitAct(game, 'zpět do menu');
  location.reload();
}

// ------------------------------------------------------------------ KONEC 2: Vypneš konzoli
export async function consoleOffEnding(game) {
  const ui = game.ui, S = game.state;
  game.mode = 'end'; S.ending = 'e2';
  game.lock++;
  // CRT vypnutí: obraz se slije do čáry a tečky
  sound.stopAll(); sound.play('crtOff');
  game.r.frozen = true;
  const t0 = performance.now();
  ui.overlay = (g) => {
    const t = (performance.now() - t0) / 1000;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const hh = Math.max(2, H * (1 - t * 6)), ww = t < 0.2 ? W : Math.max(2, W * (1 - (t - 0.2) * 3));
    if (t < 0.6) { g.fillStyle = '#fff'; g.fillRect((W - ww) / 2, (H - hh) / 2, ww, hh); }
  };
  game.fadeV = 1; game.fadeTarget = 1;
  await new Promise(r => setTimeout(r, 3500));
  // epilog: Ardemoor ve 16:47, všichni stojí a čekají
  game.r.frozen = false;
  S.flags.epilogue = true;
  ui.overlay = null;
  game.fadeV = 0;
  game.mode = 'play';
  await game.loadRoom('hub', 'start', { fade: false });
  game.mode = 'end';
  sound.ambient('ambMenu', 0.25, 3);
  const shots = [
    [[0, 1.7, -12], [0, 1.5, 4], 'Konzole je vypnutá.'],
    [[-6, 1.6, -3], [-9.3, 1.5, -0.4], 'Pekař pořád stojí u pece. Chleba se nedopeče.'],
    [[0, 2.2, 6.5], [0, 2.2, 11.3], 'Král drží prázdnou korunu.'],
    [[6, 1.6, -9], [10, 1.4, -5.6], 'Strážní stojí a dívají se na dveře.'],
    [[2, 3.5, -10], [-8, 15, 40], 'V Ardemooru je navždy 16:47.'],
  ];
  game.fade(1, 1.5);
  for (const [pos, look, cap] of shots) {
    game.room.cameraOverride = (cam) => { const k = (game.time % 100) * 0.02; cam.position.set(pos[0] + k * 0.0, pos[1], pos[2] + k * 0.1); cam.lookAt(...look); if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); } };
    ui.caption(cap, 4.6);
    await game.wait(5);
  }
  await game.fade(0, 2);
  S.ending = 'e2-done';
  const t1 = game.time;
  ui.overlay = (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalAlpha = Math.min(1, (game.time - t1) / 2); g.textAlign = 'center';
    g.font = `bold 32px serif`; g.fillStyle = '#e8dcc0'; g.fillText('KONEC 2 / 3', W / 2, H / 2 - 10);
    g.font = `16px ${FONT}`; g.fillStyle = '#8a7a6a'; g.fillText('ČEKÁNÍ', W / 2, H / 2 + 22);
    g.fillStyle = '#4a4a4a'; g.font = `12px ${FONT}`; g.fillText('Všichni pořád stojí a čekají, až se někdo vrátí.', W / 2, H / 2 + 60);
    g.globalAlpha = 1; g.textAlign = 'left';
  };
  game.fadeV = 1; game.fadeTarget = 1; game.room = null;
  game.lock--;
  await waitAct(game, 'zpět do menu');
  location.reload();
}

// ------------------------------------------------------------------ KONEC 3 (secret): Wren zůstane v menu
export async function secretEnding(game) {
  const ui = game.ui, S = game.state;
  game.mode = 'end'; S.ending = 'e3';
  game.lock++;
  sound.stopAll();
  const name = (game.playerName || 'HRÁČ').toUpperCase();
  const old = saveName();
  let shown = old, t0 = performance.now(), phase = 'card';
  ui.overlay = (g) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#101a4a'); grd.addColorStop(1, '#3a0a3a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.font = `bold 18px ${FONT}`; g.fillStyle = '#d8d8f0'; g.fillText('PAMĚŤOVÁ KARTA  1', 40, 44);
    g.fillStyle = '#ffd870'; g.fillRect(37, 67, 58, 58); g.fillStyle = '#0a0a20'; g.fillRect(40, 70, 52, 52);
    g.fillStyle = '#e0b030'; g.beginPath(); g.moveTo(48, 108); g.lineTo(52, 84); g.lineTo(60, 98); g.lineTo(66, 80); g.lineTo(72, 98); g.lineTo(80, 84); g.lineTo(84, 108); g.fill();
    g.font = `bold 22px ${FONT}`; g.fillStyle = '#fff'; g.fillText(shown + (Math.floor(performance.now() / 300) % 2 ? '_' : ''), 120, 104);
    g.font = `12px ${FONT}`; g.fillStyle = '#8888b0'; g.fillText('Ardemoor – menu   ·   16:47', 120, 124);
    if (phase === 'done') { g.fillStyle = '#c8c8e0'; g.textAlign = 'center'; g.fillText('Uložená pozice byla přejmenována.', W / 2, 300); g.textAlign = 'left'; }
  };
  game.fadeV = 1; game.fadeTarget = 1; game.r.frozen = true;
  await sleep(1500);
  // přepisování jména písmeno po písmenu
  while (shown.length) { shown = shown.slice(0, -1); sound.play('type'); await sleep(90); }
  await sleep(600);
  for (const ch of name) { shown += ch; sound.play('blip', { vol: 0.3 }); await sleep(160); }
  localStorage.setItem('pk-save-name', name);
  phase = 'done'; sound.play('save');
  await sleep(2500);
  // vzkaz
  const nice = name.charAt(0) + name.slice(1).toLowerCase();
  const msg = [`Ahoj, ${nice}.`, '', 'Tohle je moje hra. Dělal jsem ji v roce 1999.', 'Každý den ve 16:47 jsem se do ní schoval', 'a poslouchal, jestli cvaknou dveře.', '',
    'Jednou jsem ji vypnul uprostřed hraní', 'a už jsem se nevrátil.', '', 'Wren tu nemusí nic dohrávat.', 'V menu se nikdo nebojí. V menu se nečeká.', '', 'Nech ho tady. Pohlídej ho.', '', '— T.'];
  let shownChars = 0; const total = msg.join('\n').length; phase = 'msg'; t0 = performance.now();
  S.ending = 'e3-msg';
  ui.overlay = (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.font = `15px ${FONT}`; g.fillStyle = '#d8d8d8'; g.textAlign = 'center';
    let left = shownChars;
    msg.forEach((l, i) => { const s2 = l.slice(0, Math.max(0, left)); left -= l.length + 1; g.fillText(s2, W / 2, 80 + i * 22); });
    g.textAlign = 'left';
  };
  while (shownChars < total) { shownChars++; if (shownChars % 2) sound.play('type', { vol: 0.4 }); await sleep(45); }
  await sleep(3500);
  S.ending = 'e3-done';
  ui.overlay = (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.textAlign = 'center';
    g.font = `bold 32px serif`; g.fillStyle = '#e8dcc0'; g.fillText('KONEC 3 / 3', W / 2, H / 2 - 10);
    g.font = `16px ${FONT}`; g.fillStyle = '#8a7a6a'; g.fillText(name, W / 2, H / 2 + 22);
    g.textAlign = 'left';
  };
  game.r.frozen = false; game.paused = false;
  game.lock--;
  await waitAct(game, 'zpět do menu');
  location.reload();
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitAct(game, label) {
  const t0 = game.time;
  const prev = game.ui.overlay;
  game.ui.overlay = (g) => { prev?.(g); if (game.time - t0 > 2) { g.font = `12px ${FONT}`; g.fillStyle = '#7a7a7a'; g.textAlign = 'center'; g.fillText(`[E] ${label}`, W / 2, H - 30); g.textAlign = 'left'; } };
  while (true) { await game.nextFrame(); if (game.time - t0 > 2 && input.hit('act')) return; }
}

export { wrap };
