// LEVEL 1a: Nekonečná kuchyně. Dokud se v ní topí, dveře vedou zpátky do ní samé.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeBaker, makeGuard } from '../../assets/models.js';
import { signTex } from '../../assets/textures.js';
import { ps1Mat, setLights } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addNPC } from '../npc.js';
import { bakerLine, faceless } from '../lore.js';
import { addSaveCrystal } from '../flow.js';
import { tex } from '../../assets/models.js';
import { W, H, FONT } from '../ui.js';

const SOLUTION = [1, 2, 0]; // prostřední, pravý, levý (podle kresby: 3 1 2)
const NAMES = ['levý', 'prostřední', 'pravý'];

export function buildKitchen(game) {
  const R = new Room(game, 'kitchen');
  const S = game.state, F = S.flags, ui = game.ui;
  const loop = S.kitchenLoop;
  const solved = !!F.stoveSolved;
  R.env = {
    fog: 0x0e1210, near: 3, far: 15, ambient: loop >= 3 && !solved ? [0.32, 0.16, 0.16] : [0.26, 0.27, 0.25], sun: [0, 0, 0],
    lights: [
      { pos: [0, 2.9, -3.5], color: 0xfff0c0, range: 7, intensity: 0.9 },
      { pos: [0, 2.9, 4], color: 0xfff0c0, range: 7, intensity: 0.9 },
      ...(solved ? [] : [{ pos: [3.6, 1.4, 0], color: 0xff7a20, range: 4.5, intensity: 1.3 }, { pos: [-3, 1, 5.6], color: 0xff5010, range: 4, intensity: 1.2 }]),
    ],
    sound: solved ? 'ambArmory' : 'ambKitchen', soundVol: solved ? 0.25 : 0.5,
  };
  R.spawns = { start: [0, -6.8, 0], save: [3.2, 4.8, 0] };

  // stavba
  R.floor(-5, -8, 5, 8, M('tilesFloor'), 2);
  R.ceiling(-5, -8, 5, 8, 3.3, M('wood', { tint: 0x605048 }), 2);
  const tiles = M('tilesWall');
  R.wall(-5, -8, 5, -8, 3.3, tiles, { tile: 1.6 });
  R.wall(-5, 8, -0.8, 8, 3.3, tiles, { tile: 1.6 });
  R.wall(0.8, 8, 5, 8, 3.3, tiles, { tile: 1.6 });
  R.add(worldBox(1.6, 0.9, 0.4, tiles, 1.6), 0, 2.85, 8);
  R.wall(5, -8, 5, 8, 3.3, tiles, { tile: 1.6 });
  if (loop >= 2 && !solved) { R.wall(-5, -8, -5, 0, 3.3, M('placeholder'), { tile: 3.3 }); R.wall(-5, 0, -5, 8, 3.3, tiles, { tile: 1.6 }); }
  else R.wall(-5, -8, -5, 8, 3.3, tiles, { tile: 1.6 });
  // dveře
  const doorN = R.add(worldBox(1.6, 2.4, 0.15, M('door'), 1.6), 0, 1.2, 8.05);
  R.add(worldBox(1.6, 2.4, 0.15, M('door'), 1.6), 0, 1.2, -7.85);
  const sign = card(1.4, 0.4, ps1Mat(signTex(solved ? 'ZBROJNICE' : 'ZBROJNICE', { w: 96, h: 24, font: 'bold 13px serif' })));
  R.add(sign, 0, 2.75, 7.75, Math.PI);
  // hodiny
  const clk = props.clock(0.35); R.add(clk, 2.2, 2.3, 7.75, Math.PI);

  // sporák (hádanka 1)
  const stove = props.stove(); R.add(stove, 4.35, 0, 0, -Math.PI / 2); R.solid(stove);
  const burners = stove.userData.burners;
  burners.forEach(b => R.billboard(b.flame));
  const lit = solved ? [false, false, false] : [true, true, true];
  let seq = [];
  const sync = () => burners.forEach((b, i) => { b.flame.visible = lit[i]; b.knob.rotation.y = lit[i] ? 0 : Math.PI / 2; });
  sync();
  burners.forEach((b, i) => {
    R.interact([3.55, -0.9 + i * 0.9], () => `Zavřít ${NAMES[i]} hořák`, async () => {
      sound.play('click'); lit[i] = false; sync(); sound.play('hiss', { vol: 0.6 });
      seq.push(i);
      const ok = seq.every((v, k) => v === SOLUTION[k]);
      if (!ok) {
        await game.wait(0.7);
        lit.fill(true); seq = []; sync();
        sound.play('ignite'); game.tear(0.3, 0.6);
        ui.caption('Hořáky se znovu rozhořely. Všechny najednou.', 3.5);
        return;
      }
      if (seq.length === 3) {
        F.stoveSolved = true;
        sound.silence(true, 0.2);
        oven.userData.glow.visible = false;
        game.room.env.lights.length = 2;
        setLights(game.room.env.lights);
        await game.wait(1.8);
        sound.play('thud');
        await game.wait(1.0);
        sound.ambient('ambArmory', 0.25, 2); sound.silence(false, 1);
        ui.caption('Kuchyně ztichla. Hodiny přestaly tikat. Trouba chladne.', 5);
      }
    }, { radius: 1.1, cond: () => lit[i] });
  });

  // dětská kresba (nápověda)
  const drawing = card(1.0, 1.0, M('drawing')); R.add(drawing, -4.78, 1.6, 0.2, Math.PI / 2);
  R.interact([-4.0, 0.2], 'Prohlédnout kresbu', async () => {
    await showPaper(game, tex().drawing.userData.canvas, 'Dětská kresba. Sporák, tři plamínky a čísla.');
  }, { radius: 1.3 });

  // vzkaz na stole
  const table = props.table(1.8, 1.0); R.add(table, -1.6, 0, -4); R.solid(table);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.45), M('note')); note.rotation.x = -Math.PI / 2; note.rotation.z = 0.3; R.add(note, -1.4, 0.92, -4).rotation.set(-Math.PI / 2, 0, 0.3);
  const chairs = loop >= 1 && !solved ? [[-2.8, -4, 2.1], [-0.4, -4.1, 0.4], [-1.6, -2.4, Math.PI * 0.9]] : [[-2.9, -4, Math.PI / 2], [-0.3, -4, -Math.PI / 2]];
  chairs.forEach(([x, z, a]) => { const c = props.chair(); R.add(c, x, 0, z, a); R.solid(c, -0.05); });
  R.interact([-1.4, -3.2], 'Přečíst vzkaz', async () => {
    await showPaper(game, tex().note.userData.canvas, '„Přijdeme v pět. Nezapínej sporák!!  máma“');
  }, { radius: 1.2 });

  // trouba (hádanka 2 – klíč)
  const oven = props.oven(); R.add(oven, -2.8, 0, 7.0, Math.PI); R.solid(oven);
  if (solved) oven.userData.glow.visible = false;
  R.interact([-2.8, 5.6], () => (F.stoveSolved && !game.has('klic') ? 'Sáhnout do trouby' : 'Prohlédnout troubu'), async () => {
    if (!F.stoveSolved) { sound.play('ignite', { vol: 0.4 }); await ui.say(null, 'Trouba je rozpálená do běla. Uvnitř, za plameny, se něco leskne. Dokud se tu topí, nedá se k tomu sáhnout.'); }
    else if (!game.has('klic')) { await ui.say(null, 'Trouba vychladla. V popelu leží klíč. Je ještě teplý.'); game.give('klic', 'KLÍČ OD ZBROJNICE'); }
    else await ui.say(null, 'Prázdná trouba. Voní to tu chlebem a ničím.');
  }, { radius: 1.3 });

  // pult a pekař Bořek (tentýž pekař jako na nádvoří)
  const ctr = props.counter(3, 0.8); R.add(ctr, -4.4, 0, 3.2, Math.PI / 2); R.solid(ctr);
  const bakerOpts = (at) => ({
    name: 'Pekař Bořek', at, radius: 1.5, line: () => bakerLine(S), faceless: () => faceless.baker(S),
    work: () => S.saves < 1, face: () => S.saves >= 1, closeup: 1.45, headY: 1.68,
  });
  const baker = makeBaker();
  addNPC(R, baker, -3.4, 3.2, -Math.PI / 2, bakerOpts([-2.4, 3.2]));
  R.baker = baker;
  if (loop >= 3 && !solved) addNPC(R, makeBaker(), -3.4, 1.4, -Math.PI / 2, bakerOpts([-2.4, 1.4])); // zdvojený pekař
  if (loop >= 2 && !solved) addNPC(R, makeGuard(5), 4.0, -6.8, 0, { name: 'Strážný', line: 'Krásný den v Ardemooru.', forceT: () => true });

  // kuchyňská zbrojnice: stojany se zbraněmi a naběračkami
  for (const x of [-3, 3]) { const r = props.rack(2.4); R.add(r, x, 0, -7.6); R.solid(r); }
  const armor = props.armorStand(); R.add(armor, 4.3, 0, -4.5, -Math.PI / 2); R.solid(armor);

  // SAVE krystal
  addSaveCrystal(R, 3.6, 6.4, 'kitchen', { face: [-0.2, -1] });

  // dveře
  R.interact([0, 6.9], () => (!F.stoveSolved ? 'Projít dveřmi' : game.has('klic') ? 'Odemknout zbrojnici' : 'Dveře do zbrojnice'), async () => {
    if (!F.stoveSolved) {
      sound.play('door');
      S.kitchenLoop++;
      await game.freeze(0.25);
      await game.loadRoom('kitchen', 'start', { fadeTime: 0.12 });
      return;
    }
    if (!game.has('klic')) { sound.play('locked'); await ui.say(null, 'Zamčeno. Zámek je ještě teplý. Na kování je vyrytý meč.'); return; }
    sound.play('door');
    await game.loadRoom('armory', 'start');
  }, { radius: 1.3 });
  R.interact([0, -6.9], 'Dveře zpět', async () => { sound.play('locked'); await ui.say(null, 'Zamčeno zvenku.'); }, { radius: 1.0 });

  R.every((dt, t) => { if (!F.stoveSolved) burners.forEach(b => { b.flame.scale.y = 1 + Math.sin(t * 17 + b.x * 5) * 0.12; }); });

  // kamery
  R.cam([-5, -8, 5, -1], [-4.4, 2.9, -7.5]);
  R.cam([0, -1, 5, 8], [-4.2, 3.0, -1.2]);
  R.cam([-5, -1, 0, 8], [4.3, 3.0, 1.0]);

  R.onEnter = () => {
    const titles = ['KUCHYNĚ', 'KUCHYNĚ', 'KUCHYNĚ?', 'KUCHYNĚ KUCHYNĚ', 'KUCHYNĚ KUCHYNĚ KUCHYNĚ'];
    if (!solved) ui.title(titles[Math.min(loop, titles.length - 1)], 2.5, loop === 0 ? 'nebo zbrojnice' : `${loop + 1}.`);
    if (loop === 1) ui.caption('Tahle kuchyně tu už byla. Židle stojí jinak.', 4.5);
    if (loop >= 2 && !solved) ui.caption('Kuchyně nekončí, dokud se v ní topí.', 5);
  };
  return R;
}

/** Ukáže papír (kresbu / vzkaz) přes celou obrazovku. */
async function showPaper(game, canvas, caption) {
  const ui = game.ui;
  const prev = ui.overlay;
  ui.overlay = (g) => {
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    const s = Math.floor(300 / canvas.width);
    g.drawImage(canvas, (W - canvas.width * s) / 2, 40, canvas.width * s, canvas.height * s);
  };
  sound.play('blip');
  await ui.say(null, caption);
  ui.overlay = prev;
}

