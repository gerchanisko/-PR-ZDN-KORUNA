// LEVEL 2: Kostel pod vodou. Slepý Zvoník slyší kroky. Hádanka: zvony v pořadí čísel písní (16, 4, 7).
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeBellRinger } from '../../assets/models.js';
import { signTex } from '../../assets/textures.js';
import { ps1Mat, setLights, shared } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addStalker, addHideSpots } from '../stalker.js';
import { addMemoryCrystal, addSaveCrystal, returnToHub } from '../flow.js';

const RING = [[0, 6.3], [-5.25, 6.3], [-5.25, -8.6], [5.25, -8.6], [5.25, 6.3]];
const ORDER = [16, 4, 7];

export function buildChurch(game) {
  const R = new Room(game, 'church');
  const S = game.state, F = S.flags, ui = game.ui;
  const escape = !!F.escape2;
  const lights = [
    { pos: [0, 2.2, 10], color: 0xffb060, range: 7, intensity: escape ? 0.4 : 1.1 },
    { pos: [-4, 5, -2], color: 0x60c0e0, range: 11, intensity: 1.0 },
    { pos: [4, 5, 3], color: 0x60c0e0, range: 11, intensity: 1.0 },
    { pos: [0, 4, -8], color: 0x50a0c0, range: 10, intensity: 0.9 },
  ];
  R.env = {
    fog: escape ? 0x04202a : 0x0c3a4a, near: 3, far: 16, ambient: escape ? [0.2, 0.28, 0.32] : [0.32, 0.46, 0.52], sun: [0, 0, 0],
    lights, sound: 'ambChurch', soundVol: 0.6, wave: 1,
  };
  R.moveMul = 0.85; // pod vodou se chodí pomaleji
  R.spawns = { start: [0, -10.8, 0], pedestal: [0, 8.4, Math.PI] };

  // stavba – vše je pod hladinou
  R.floor(-6, -12, 6, 12, M('stone', { tint: 0x7a9a9a }), 2);
  const brick = M('brick', { tint: 0x8aa0a8 });
  R.wall(-6, 12, 6, 12, 6.6, brick, { tile: 2.5 });
  R.wall(-6, -12, -0.9, -12, 6.6, brick, { tile: 2.5 }); R.wall(0.9, -12, 6, -12, 6.6, brick, { tile: 2.5 });
  R.add(worldBox(1.8, 4.2, 0.4, brick, 2.5), 0, 4.5, -12);
  R.add(worldBox(1.8, 2.4, 0.15, M('door', { tint: 0x80a0a0 }), 1.8), 0, 1.2, -11.9);
  R.wall(-6, -12, -6, 12, 6.6, brick, { tile: 2.5 }); R.wall(6, -12, 6, 12, 6.6, brick, { tile: 2.5 });
  // hladina nad hlavou
  const surf = R.ceiling(-6, -12, 6, 12, 6.6, M('water', { emissive: 0.7, scroll: [0.03, 0.017], uv: [1, 1] }), 3);
  void surf;
  // vitráže a světelné paprsky z hladiny
  for (const z of [-6, -1, 4]) for (const s of [-1, 1]) R.add(card(1.4, 2.6, M('stained', { emissive: 0.6 })), s * 5.95, 3.8, z, -s * Math.PI / 2);
  for (const [x, z, r] of [[-3, -4, 0.3], [2.5, 1, -0.25], [-1, 6, 0.2], [3.5, -8, -0.3]]) {
    const ray = card(1.2, 7, M('water', { emissive: 1, opacity: 0.22, noFog: false, side: THREE.DoubleSide, scroll: [0, -0.05] }));
    ray.rotation.z = r; R.add(ray, x, 3.3, z); R.billboard(ray);
  }
  // bubliny
  const bubbles = [];
  for (let i = 0; i < 36; i++) {
    const b = card(0.07, 0.07, M('white', { emissive: 1, tint: 0xc0f0ff, opacity: 0.8 }));
    b.position.set((Math.random() - 0.5) * 11, Math.random() * 6.5, (Math.random() - 0.5) * 23);
    R.scene.add(b); R.billboard(b); bubbles.push(b);
  }
  R.every((dt, t) => { bubbles.forEach((b, i) => { b.position.y += dt * (0.4 + (i % 5) * 0.12); b.position.x += Math.sin(t * 2 + i) * dt * 0.1; if (b.position.y > 6.5) b.position.y = 0; }); });

  // lavice: dva sloupce, uprostřed ulička
  for (let z = -7; z <= 3; z += 2) for (const x of [-3, 3]) { const p = props.pew(3.2); R.add(p, x, 0, z, Math.PI); R.solid(p); }

  // přepážka před oltářem a mříž
  R.wall(-6, 7.5, -3, 7.5, 1.6, M('wood', { tint: 0x6a5a4a }), { tile: 1 });
  R.wall(3, 7.5, 6, 7.5, 1.6, M('wood', { tint: 0x6a5a4a }), { tile: 1 });
  const gate = card(6, 3.2, M('bars', { side: THREE.DoubleSide, uv: [6, 1] })); R.add(gate, 0, 1.6, 7.5);
  const gateCol = R.collider(-3, 7.35, 3, 7.65);
  const setGate = (open) => { gateCol.off = open; gate.userData.open = open; };
  setGate(!!F.gateOpen);
  R.every((dt) => { const want = F.gateOpen ? -1.7 : 1.6; gate.position.y += (want - gate.position.y) * Math.min(1, dt * 1.5); });
  // oltář
  const altar = R.add(worldBox(2.6, 1.1, 1.0, M('stone', { tint: 0xc0c8c0 }), 1), 0, 0.55, 11.1); R.solid(altar);
  for (const x of [-1, 1]) { const f = card(0.25, 0.4, M('flame', { emissive: 1, side: THREE.DoubleSide })); R.add(f, x, 1.35, 11.1); R.billboard(f); }
  R.add(card(2.2, 3.2, M('stained', { emissive: 0.8 })), 0, 4, 11.78, Math.PI);
  addMemoryCrystal(R, 2, 0, 9.6, 1.45, { face: [0, -1] });
  addSaveCrystal(R, -2.4, 9.8, 'church', { face: [0, -1] });

  // tabule s čísly písní (nápověda)
  const hymn = card(0.9, 1.35, ps1Mat(signTex(['PÍSNĚ', '16', '4', '7'], { w: 64, h: 96, font: 'bold 18px serif', bg: '#1a1410' })));
  R.add(hymn, 5.95, 2.4, 0.2, -Math.PI / 2);
  R.interact([5.0, 0.2], 'Přečíst tabuli s čísly písní', async () => {
    await ui.say(null, 'Tabule s čísly písní: 16, 4, 7. Někdo k tomu tužkou připsal: „takhle se zvoní, když se jde domů“.');
  }, { radius: 1.2 });
  const note = card(0.5, 0.6, M('note')); R.add(note, -1.7, 1.5, -11.78);
  R.interact([-1.7, -11.0], 'Přečíst vzkaz', async () => {
    await ui.say(null, '„Zvoník nevidí, jenom slyší. Když jde kolem, nehýbej se. A nezvoň špatně.  —T.“');
  }, { radius: 1.1 });

  // zvony
  const bells = [[5, -5.2, -5.5], [16, 5.2, -2.5], [4, -5.2, 1.5], [7, 5.2, 4.6]];
  let seq = [];
  bells.forEach(([num, x, z]) => {
    const plate = signTex(String(num), { w: 32, h: 24, font: 'bold 18px serif', bg: '#2a2a1a' });
    const b = props.bell(plate); R.add(b, x, 3.4, z, x < 0 ? Math.PI / 2 : -Math.PI / 2);
    let swing = 0;
    R.every((dt, t) => { swing *= Math.pow(0.4, dt); b.rotation.z = Math.sin(t * 6) * swing; });
    R.interact([x * 0.94, z], `Zatáhnout za provaz (zvon ${num})`, async () => {
      swing = 0.35;
      sound.play('bell', { rate: { 16: 0.6, 4: 1.25, 7: 0.95, 5: 1.06 }[num], vol: 0.9 });
      await game.wait(0.6);
      if (F.gateOpen) return;
      if (num === 5) {
        seq = []; ui.caption('Zvon odbil pět. Nikdo nepřišel.', 3.5);
        game.tear(0.3, 0.6); R.stalker?.alert(x, z); return;
      }
      if (num === ORDER[seq.length]) {
        seq.push(num);
        if (seq.length === ORDER.length) {
          F.gateOpen = true; setGate(true);
          await game.wait(0.8); sound.play('thud');
          ui.caption('Mříž před oltářem se propadla do bahna.', 4);
        }
      } else {
        seq = []; sound.play('bell', { rate: 0.5, vol: 0.6 });
        ui.caption('Zvony se rozezněly falešně. Něco to slyšelo.', 3.5);
        R.stalker?.alert(x, z);
      }
    }, { radius: 1.1 });
  });

  // zpovědnice na schování
  addHideSpots(R, [[-4.0, -10.6, 0], [4.0, -10.6, 0]], { kind: 'confessional', label: 'Schovat se do zpovědnice', caption: 'Ve zpovědnici je vzduch. Starý, ale je.', model: props.confessional, front: 1.0 });

  // ZVONÍK – slepý, slyší pohyb
  addStalker(R, {
    obj: makeBellRinger(), ring: RING, start: escape ? [0, 4.6] : [0, 6.3], startWp: 1, escape, float: true,
    sight: 0, hearing: 1.3, speeds: { patrol: 1.0, chase: 2.2, search: 1.0, escape: 2.3 },
    alarmSound: 'handbell', alarmEvery: 5,
    seenText: 'Zvoník tě uslyšel.',
    captureSpawn: escape ? 'pedestal' : 'start',
    captureText: escape ? 'Voda tě vrátila k oltáři.' : 'Kostel se znovu napustil.',
    initialMode: () => 'patrol',
  });

  // únik
  R.interact([0, -11.1], () => (escape ? 'UTÉCT' : 'Dveře zpět'), async () => {
    if (escape) return returnToHub(game, 2);
    sound.play('locked'); await ui.say(null, 'Dveře drží tlak vody. Zpátky to nejde.');
  }, { radius: 1.1 });
  if (escape) R.trigger([-1.2, -12, 1.2, -11.3], () => { if (!game.lock) returnToHub(game, 2); });

  // kamery (fixní režim)
  R.cam([-6, -12, 6, -6], [4.5, 4.5, -11.4]);
  R.cam([-6, -6, 0, 7.5], [-5.4, 4.8, -7.5]);
  R.cam([0, -6, 6, 7.5], [5.4, 4.8, -7.5]);
  R.cam([-6, 7.5, 6, 12], [4.8, 4, 6.2]);

  R.onEnter = async () => {
    if (escape) {
      ui.title('UTEČ', 2);
      R.worstMoment = true;
      await game.wait(1.0);
      // nejhorší chvíle: zhasne všechno světlo
      sound.play('thud'); setLights([]);
      const amb = shared.uAmbient.value.clone(); shared.uAmbient.value.setRGB(0.03, 0.05, 0.07);
      ui.caption('Tma.', 2.5);
      await game.wait(2.8);
      for (let i = 0; i < 6; i++) { setLights(i % 2 ? lights : []); await game.wait(0.1 + Math.random() * 0.2); }
      setLights(lights); shared.uAmbient.value.copy(amb);
      R.worstMoment = false;
      ui.caption('Dveře na jihu. Plav. Utíkej.', 4);
      return;
    }
    ui.title('KOSTEL POD VODOU', 3, 'tma a hloubka');
    if (!F.churchIntro) {
      F.churchIntro = true;
      await game.wait(3.2);
      ui.caption('Kostel je zatopený. Dýchá se tu, i když by se nemělo. Někde hluboko zvoní zvonek.', 6);
    }
  };
  return R;
}
