// Inventář na papíře + mapa nakreslená pastelkami. Mapa občas lže.
import { input } from '../engine/input.js';
import { sound } from '../engine/audio.js';
import { rng } from '../assets/textures.js';
import { W, H, FONT, wrap, scramble } from './ui.js';

export const ITEMS = {
  mapa: { name: 'MAPA ARDEMOORU', desc: 'Nakreslená pastelkami na zadní stranu účtenky z obchodu. Někdo se hodně snažil o rovné čáry.' },
  klic: { name: 'KLÍČ OD ZBROJNICE', desc: 'Je ještě teplý a voní chlebem. Na hlavě klíče je vyrytý meč, nebo možná vařečka.' },
  krystal1: { name: 'KRYSTAL PAMĚTI 1', desc: 'Uvnitř je slyšet tikání hodin. Pak už ani to ne.' },
  krystal2: { name: 'KRYSTAL PAMĚTI 2', desc: 'Je studený a mokrý. Když se do něj díváš dlouho, zhasne v něm lampička.' },
  krystal3: { name: 'KRYSTAL PAMĚTI 3', desc: 'Voní křídou a kabátem. Uvnitř někdo pořád čeká u dveří.' },
  propustka: { name: 'PROPUSTKA', desc: '„Tomáš smí odejít domů. Podpis rodiče: ______“. Podpis chybí.' },
};

export class Inventory {
  constructor(game) { this.game = game; this.open = false; this.sel = 0; this.view = 'list'; this.seed = 1; }
  toggle() {
    this.open = !this.open;
    sound.play(this.open ? 'select' : 'blip', { vol: 0.5 });
    this.view = 'list'; this.sel = 0; this.seed = Math.floor(Math.random() * 1000);
    this.game.ui.overlay = this.open ? (g) => this.draw(g) : null;
    this.game.ui.hideSubs = this.open;
  }
  update() {
    if (!this.open) return;
    const inv = this.game.state.inv;
    if (input.hit('back') || (input.hit('inv') && false)) { this.toggle(); return; }
    if (this.view === 'map') { if (input.hit('act')) { input.consume('act'); this.view = 'list'; sound.play('blip'); } return; }
    if (input.hit('up')) { this.sel = (this.sel - 1 + inv.length) % Math.max(1, inv.length); sound.play('blip', { vol: 0.3 }); }
    if (input.hit('down')) { this.sel = (this.sel + 1) % Math.max(1, inv.length); sound.play('blip', { vol: 0.3 }); }
    if (input.hit('act') && inv[this.sel] === 'mapa') { input.consume('act'); this.view = 'map'; sound.play('select'); }
  }
  draw(g) {
    paper(g, 30, 24, W - 60, H - 48, this.seed);
    if (this.view === 'map') return drawMap(g, this.game, this.seed);
    const inv = this.game.state.inv;
    g.font = `bold 22px serif`; g.fillStyle = '#3a2a1a'; g.fillText('VĚCI', 60, 70);
    g.font = `12px ${FONT}`; g.fillStyle = '#6a5a4a'; g.fillText('[↑↓] vybrat   [E] prohlédnout mapu   [Tab/Esc] zavřít', 60, H - 44);
    if (!inv.length) { g.font = `16px ${FONT}`; g.fillText('(nic)', 60, 110); }
    inv.forEach((k, i) => {
      g.font = `bold 16px ${FONT}`;
      g.fillStyle = i === this.sel ? '#9a1a1a' : '#3a2a1a';
      g.fillText((i === this.sel ? '▶ ' : '  ') + ITEMS[k].name, 60, 110 + i * 30);
    });
    const it = ITEMS[inv[this.sel]];
    if (it) {
      g.font = `14px ${FONT}`; g.fillStyle = '#3a2a1a';
      wrap(g, it.desc, 250).forEach((l, i) => g.fillText(l, 330, 110 + i * 20));
    }
    // hodiny – vždy stejný čas
    g.font = `bold 14px ${FONT}`; g.fillStyle = '#6a5a4a'; g.fillText('16:47', W - 110, 70);
  }
}

function paper(g, x, y, w, h, seed) {
  const r = rng(seed);
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e6dcc2'; g.fillRect(x, y, w, h);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,100,70,${r() * 0.15})`; g.fillRect(x + r() * w, y + r() * h, 2, 2); }
  g.fillStyle = 'rgba(140,110,60,0.18)'; g.beginPath(); g.arc(x + w * 0.8, y + h * 0.75, 40, 0, 7); g.fill();
}

function crayon(g, pts, col, r, width = 3) {
  g.strokeStyle = col; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.beginPath();
    pts.forEach(([x, y], i) => { const a = x + (r() - 0.5) * 4, b = y + (r() - 0.5) * 4; i ? g.lineTo(a, b) : g.moveTo(a, b); });
    g.stroke();
  }
}
const rect = (g, x, y, w, h, col, r) => crayon(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], col, r);
function label(g, t, x, y, col = '#2a2a6a', size = 14) { g.font = `bold ${size}px "Comic Sans MS", "Comic Neue", sans-serif`; g.fillStyle = col; g.fillText(t, x, y); }

function drawMap(g, game, seed) {
  const r = rng(seed);
  const st = game.state, f = st.flags, room = game.roomName;
  label(g, 'ARDEMOOR', 230, 70, '#8a1a1a', 22);
  // hrad
  rect(g, 120, 120, 220, 230, '#5a4a3a', r);
  label(g, 'HRAD', 200, 140);
  // král + koruna
  crayon(g, [[210, 170], [215, 155], [225, 168], [232, 152], [240, 168], [248, 155], [252, 170], [210, 170]], '#c09010', r);
  label(g, 'KRÁL', 212, 192, '#2a2a6a', 11);
  // pekař – po uložení přeškrtnutý
  label(g, 'PEKAŘ', 132, 260, '#2a2a6a', 12);
  label(g, '(anička)', 132, 276, '#6a6a9a', 10);
  if (f.saved) {
    for (let i = 0; i < 6; i++) crayon(g, [[128, 250 + i * 5], [196, 255 + i * 4]], '#1a1a1a', r, 4);
    label(g, 'kdo?', 150, 300, '#1a1a1a', 12);
  }
  // dveře I II III + IV, které neexistují
  ['I', 'II', 'III', 'IV'].forEach((d, i) => { rect(g, 338, 170 + i * 40, 18, 28, '#6a3a1a', r); label(g, d, 362, 190 + i * 40, '#6a3a1a', 12); });
  // kuchyně
  crayon(g, [[356, 184], [420, 184], [440, 150]], '#3a6a3a', r);
  const kitchens = Math.min(3, 1 + (st.kitchenLoop >= 2 ? st.kitchenLoop - 1 : 0));
  for (let i = 0; i < kitchens; i++) { rect(g, 430 + i * 8, 100 - i * 8, 120, 60, '#3a6a3a', r); }
  label(g, 'KUCHYNĚ', 448, 136, '#3a6a3a', 13);
  // lež: východ z kuchyně, který není
  crayon(g, [[555, 130], [590, 130], [580, 122], [590, 130], [580, 138]], '#c02020', r);
  label(g, 'VÝCHOD', 540, 160, '#c02020', 11);
  // zbrojnice – jen otazník
  label(g, 'ZBROJNICE ?', 450, 182, '#5a5a5a', 11);
  // kostel pod vodou (vlnky) a škola
  crayon(g, [[356, 222], [420, 236]], '#2a5a8a', r);
  rect(g, 425, 215, 110, 50, '#2a5a8a', r);
  for (let i = 0; i < 3; i++) crayon(g, [[432, 255 - i * 9], [448, 250 - i * 9], [464, 255 - i * 9], [480, 250 - i * 9], [496, 255 - i * 9], [512, 250 - i * 9], [528, 255 - i * 9]], '#3a8ac0', r, 2);
  label(g, 'KOSTEL', 455, 232, '#2a5a8a', 12);
  crayon(g, [[356, 262], [430, 300]], '#8a5a2a', r);
  rect(g, 430, 290, 150, 26, '#8a5a2a', r);
  label(g, 'ŠKOLA', 470, 309, '#8a5a2a', 12);
  crayon(g, [[580, 303], [600, 303]], '#8a5a2a', r);
  label(g, 'TRŮN?', 560, 335, '#8a5a2a', 11);
  // dveře IV – vedou k něčemu, co je přeškrtané
  crayon(g, [[356, 302], [400, 350]], '#5a2a5a', r, 2);
  label(g, (f.crown ?? 0) >= 3 ? 'TEN KDO ČEKÁ' : '???', 380, 370, '#5a2a5a', 12);
  if ((f.crown ?? 0) >= 3) crayon(g, [[380, 376], [500, 376]], '#5a2a5a', r, 2);
  // TY JSI TADY – ukazuje špatně, pokud nejsi na nádvoří
  const pos = { hub: [230, 300], kitchen: [230, 300], armory: [490, 130], church: [500, 300], school: [470, 245], boss: [230, 200] }[room] ?? [230, 300];
  const [mx, my] = room === 'kitchen' ? [270, 320] : pos;
  crayon(g, [[mx - 8, my - 8], [mx + 8, my + 8]], '#d01010', r, 4); crayon(g, [[mx + 8, my - 8], [mx - 8, my + 8]], '#d01010', r, 4);
  label(g, 'TY', mx + 12, my + 4, '#d01010', 12);
  // dům mimo hrad – nikdo k němu nekreslí cestu
  rect(g, 80, 380, 60, 44, '#3a3a3a', r);
  crayon(g, [[80, 380], [110, 360], [140, 380]], '#3a3a3a', r);
  label(g, 'DOMA', 88, 446, '#3a3a3a', 12);
  label(g, scramble('maminka přijde v 5', 0.05), 160, 420, '#7a7a9a', 11);
  g.font = `12px ${FONT}`; g.fillStyle = '#6a5a4a'; g.fillText('[E] zpět', 60, H - 44);
}
