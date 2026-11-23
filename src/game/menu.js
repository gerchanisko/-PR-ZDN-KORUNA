// Boot obrazovka, rozbité hlavní menu a správce paměťové karty.
import * as THREE from '../../lib/three.module.js';
import { Room } from './room.js';
import { M, makeCrown } from '../assets/models.js';
import { input } from '../engine/input.js';
import { sound } from '../engine/audio.js';
import { W, H, FONT, scramble, panel } from './ui.js';
import { saveName } from './flow.js';

export function buildMenuScene(game) {
  const R = new Room(game, 'menu');
  R.noPlayer = true;
  R.env = { ...R.env, fog: 0x080410, near: 3, far: 14, ambient: [0.5, 0.4, 0.45], sun: [0.8, 0.5, 0.3], sound: 'ambMenu', soundVol: 0.6 };
  const crown = makeCrown(); R.add(crown, 0, 1.0, 0); crown.scale.setScalar(0.9);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(30, 8, 6), M('sky', { noFog: true, emissive: 1, side: THREE.BackSide, uv: [3, 1] }));
  R.add(sky, 0, -6, 0);
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), M('sun', { noFog: true, emissive: 1 }));
  R.add(sun, 7, 4, -20);
  R.billboard(sun);
  R.every((dt, t) => { crown.rotation.y = t * 0.4; crown.rotation.z = Math.sin(t * 0.7) * 0.08; crown.position.y = 1 + Math.sin(t) * 0.08; });
  R.cameraOverride = (cam) => { cam.position.set(0, 1.6, 5.5); cam.lookAt(0, 1.1, 0); };
  return R;
}

const anyKey = async (game) => { while (true) { await game.nextFrame(); if (input.anyKey) return; } };

export async function runBoot(game) {
  const ui = game.ui;
  game.mode = 'boot';
  ui.overlay = (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.font = `16px ${FONT}`; g.textAlign = 'center'; g.fillStyle = Math.floor(performance.now() / 600) % 2 ? '#888' : '#444';
    g.fillText('STISKNI LIBOVOLNOU KLÁVESU', W / 2, H / 2);
    g.font = `11px ${FONT}`; g.fillStyle = '#333'; g.fillText('(zvuk se zapne po stisku)', W / 2, H / 2 + 24);
    g.textAlign = 'left';
  };
  await anyKey(game);
  sound.init();
  // falešné logo konzole/vydavatele
  let t0 = game.time;
  ui.overlay = (g) => {
    const t = game.time - t0;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const a = Math.min(1, t, Math.max(0, 3.4 - t));
    g.globalAlpha = a;
    g.save(); g.translate(W / 2, H / 2 - 30); g.rotate(Math.PI / 4);
    const grd = g.createLinearGradient(-40, -40, 40, 40); grd.addColorStop(0, '#d0a020'); grd.addColorStop(1, '#802010');
    g.fillStyle = grd; g.fillRect(-36, -36, 72, 72); g.fillStyle = '#000'; g.fillRect(-18, -18, 36, 36);
    g.restore();
    g.font = `bold 22px serif`; g.textAlign = 'center'; g.fillStyle = '#e0d0b0'; g.fillText('ARDEMOOR SOFT', W / 2, H / 2 + 50);
    g.font = `12px ${FONT}`; g.fillStyle = '#887'; g.fillText('© 1998  Všechna práva vyhrazena', W / 2, H / 2 + 72);
    g.globalAlpha = 1; g.textAlign = 'left';
  };
  sound.play('bootChime');
  await game.wait(3.6);
  t0 = game.time;
  ui.overlay = (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.font = `14px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#9a9a9a';
    ['Tato hra podporuje PAMĚŤOVOU KARTU.', 'Během ukládání nevypínejte konzoli', 'a nevyjímejte paměťovou kartu.', '', 'Nevyjímejte paměťovou kartu.', '', 'Prosím.'].forEach((l, i) => {
      if (i < 5 || game.time - t0 > 1.6 + i * 0.3) g.fillText(l, W / 2, H / 2 - 60 + i * 22);
    });
    g.textAlign = 'left';
  };
  await game.wait(3.2);
  ui.overlay = null;
  await titleMenu(game);
}

export async function titleMenu(game) {
  const ui = game.ui;
  game.fadeV = 0;
  await game.loadRoom('menu', 'start', { fade: false });
  game.mode = 'menu';
  game.fade(1, 1.2);
  const opts = ['NOVÁ HRA', 'NAČÍST HRU', 'NASTAVENÍ'];
  let sel = 1, err = 0, errText = '';
  const st = { scr: 0 };
  ui.overlay = (g) => {
    const t = game.time;
    g.textAlign = 'center';
    const title = st.scr > 0 ? scramble('PRÁZDNÁ KORUNA', 0.3) : 'PRÁZDNÁ KORUNA';
    g.font = `bold 46px serif`;
    g.fillStyle = 'rgba(255,0,60,0.6)'; g.fillText(title, W / 2 - 2 + Math.sin(t * 13) * (st.scr > 0 ? 6 : 0), 82);
    g.fillStyle = 'rgba(0,200,255,0.5)'; g.fillText(title, W / 2 + 2, 84);
    g.fillStyle = '#efe2c0'; g.fillText(title, W / 2, 83);
    g.font = `14px ${FONT}`; g.fillStyle = '#b8a888'; g.fillText('— HOLLOW CROWN —   DEMO', W / 2, 108);
    opts.forEach((o, i) => {
      const y = 330 + i * 34;
      const broken = i !== 1;
      let label = o;
      if (broken) label = scramble(o, 0.12 + (err > 0 && sel === i ? 0.5 : 0));
      g.font = `bold 20px ${FONT}`;
      g.fillStyle = broken ? '#5c5658' : '#e8dcc0';
      if (i === sel) { g.fillStyle = broken ? '#8a5050' : '#ffd870'; label = `▶ ${label} ◀`; }
      g.fillText(label, W / 2, y);
    });
    if (err > 0) { g.font = `12px ${FONT}`; g.fillStyle = '#c04040'; g.fillText(errText, W / 2, 440); }
    g.font = `11px ${FONT}`; g.fillStyle = '#665'; g.fillText('© 1998 ARDEMOOR SOFT     16:47', W / 2, 468);
    g.textAlign = 'left';
  };
  while (true) {
    await game.nextFrame();
    const dt = 1 / 60;
    err = Math.max(0, err - dt); st.scr = Math.max(0, st.scr - dt);
    if (Math.random() < 0.004) { st.scr = 0.25; game.tear(0.15, 0.5); }
    if (input.hit('up')) { sel = (sel + 2) % 3; sound.play('blip', { vol: 0.4 }); }
    if (input.hit('down')) { sel = (sel + 1) % 3; sound.play('blip', { vol: 0.4 }); }
    if (input.hit('act')) {
      input.consume('act');
      if (sel === 0) { err = 2; errText = 'CHYBA 0x1647: NOVÁ HRA NENÍ K DISPOZICI. HRA UŽ ZAČALA.'; sound.play('error'); game.tear(0.4, 1); }
      else if (sel === 2) { await ui.system(['NASTAVENÍ', '', 'NENAČTENO'], { title: 'CHYBA' }); }
      else { sound.play('select'); const ok = await memoryCard(game); if (ok) return; }
    }
  }
}

async function memoryCard(game) {
  const ui = game.ui;
  const prev = ui.overlay;
  let sel = 0;
  const slots = 15;
  ui.overlay = (g) => {
    const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#101a4a'); grd.addColorStop(1, '#3a0a3a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.font = `bold 18px ${FONT}`; g.fillStyle = '#d8d8f0'; g.fillText('PAMĚŤOVÁ KARTA  1', 40, 44);
    g.font = `12px ${FONT}`; g.fillStyle = '#8888b0'; g.fillText('volné bloky: 0', 470, 44);
    for (let i = 0; i < slots; i++) {
      const x = 40 + (i % 5) * 64, y = 70 + Math.floor(i / 5) * 64;
      g.fillStyle = i === sel ? '#ffd870' : '#5a5a8a'; g.fillRect(x - 3, y - 3, 58, 58);
      g.fillStyle = '#0a0a20'; g.fillRect(x, y, 52, 52);
      if (i === 0) { // ikona: blikající koruna
        g.fillStyle = Math.floor(game.time * 2) % 2 ? '#e0b030' : '#b08020';
        g.beginPath(); g.moveTo(x + 8, y + 38); g.lineTo(x + 12, y + 14); g.lineTo(x + 20, y + 28); g.lineTo(x + 26, y + 10); g.lineTo(x + 32, y + 28); g.lineTo(x + 40, y + 14); g.lineTo(x + 44, y + 38); g.fill();
        g.fillStyle = '#0a0a20'; g.fillRect(x + 20, y + 26, 12, 6);
      } else { // ostatní bloky jsou "plné" – rozbitá data
        g.fillStyle = '#2a2a4a'; g.font = `10px ${FONT}`;
        g.fillText(scramble('▒▒▒▒', 0.6), x + 4, y + 30);
      }
    }
    panel(g, 370, 70, 240, 180, { bg: 'rgba(0,0,30,0.7)', border: '#8888c0' });
    g.font = `bold 14px ${FONT}`; g.fillStyle = '#fff';
    if (sel === 0) {
      [saveName(), '', 'Ardemoor – nádvoří', 'Čas: 16:47', 'Herní čas: 999:59', 'Uloženo: 16.11.1999', 'Krystaly: 0 / 3'].forEach((l, i) => g.fillText(l, 386, 98 + i * 21));
    } else {
      g.fillStyle = '#888'; ['POŠKOZENÁ DATA', '', scramble('TOMÁŠ_02.SAV', 0.3)].forEach((l, i) => g.fillText(l, 386, 98 + i * 21));
    }
    g.font = `12px ${FONT}`; g.fillStyle = '#8888b0'; g.fillText('[E] načíst    [Esc] zpět', 40, 290);
  };
  while (true) {
    await game.nextFrame();
    if (ui.modal) continue;
    const mv = (d) => { sel = (sel + d + slots) % slots; sound.play('blip', { vol: 0.3 }); };
    if (input.hit('left')) mv(-1); if (input.hit('right')) mv(1);
    if (input.hit('up')) mv(-5); if (input.hit('down')) mv(5);
    if (input.hit('back')) { ui.overlay = prev; return false; }
    if (input.hit('act')) {
      input.consume('act');
      if (sel !== 0) { await ui.system(['Data jsou poškozená.', 'Blok nelze načíst.'], { title: 'PAMĚŤOVÁ KARTA' }); continue; }
      const c = await ui.choice(`Načíst uloženou pozici „${saveName()}“?`, [{ label: 'ANO' }, { label: 'ANO' }]);
      void c;
      ui.overlay = (g) => {
        g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
        g.font = `14px ${FONT}`; g.fillStyle = '#aaa'; g.textAlign = 'center'; g.fillText('NAČÍTÁNÍ...', W / 2, H / 2); g.textAlign = 'left';
      };
      sound.ambient(null, 0, 0.5);
      sound.play('discSeek');
      await game.wait(1.6);
      ui.overlay = null;
      game.fadeV = 0;
      await game.loadRoom('hub', 'start', { fade: false });
      game.mode = 'play';
      await game.fade(1, 1.5);
      game.room.intro?.();
      return true;
    }
  }
}
