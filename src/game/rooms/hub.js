// HUB: nádvoří hradu Ardemoor. Král Oswin, pekař Bořek, strážní, troje dveře.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeKing, makeBaker, makeGuard, makeCrown, makeCrystal } from '../../assets/models.js';
import { bakerLine, guardLine, kingRepeat, faceless, CROWN_LINES } from '../lore.js';
import { addSaveCrystal } from '../flow.js';
import { signTex } from '../../assets/textures.js';
import { ps1Mat } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addNPC, closeup } from '../npc.js';


export function buildHub(game) {
  const R = new Room(game, 'hub');
  const S = game.state, F = S.flags, ui = game.ui;
  R.env = {
    fog: 0x5a3848, near: 10, far: 36, ambient: [0.36, 0.28, 0.32], sun: [0.95, 0.55, 0.3], sunDir: [0.5, -0.45, -0.6],
    lights: [
      { pos: [-10.5, 1.5, -1], color: 0xff7020, range: 5, intensity: 1.2 },
      { pos: [-2, 2.5, 11], color: 0xffa040, range: 5 },
      { pos: [2, 2.5, 11], color: 0xffa040, range: 5 },
    ],
    sound: 'ambHub', soundVol: 0.45,
  };
  R.spawns = { start: [0, -11.5, 0], door1: [10.2, -8, -Math.PI / 2], door2: [10.2, -3, -Math.PI / 2], door3: [10.2, 2, -Math.PI / 2], door4: [10.2, 7, -Math.PI / 2] };

  // obloha + JPEG slunce
  const sky = new THREE.Mesh(new THREE.SphereGeometry(45, 10, 6), M('sky', { noFog: true, emissive: 1, side: THREE.BackSide, uv: [4, 1] }));
  R.add(sky, 0, -10, 0);
  const sun = R.add(card(9, 9, M('sun', { noFog: true, emissive: 1 })), -8, 15, 40);
  R.billboard(sun);

  // podlaha a hradby
  R.floor(-12, -14, 12, 14, M('cobble'), 2.5);
  const stone = M('stone', { tint: 0xd8c8c0 });
  R.wall(-12, 14, 12, 14, 6, stone);
  R.wall(-12, -14, 2, -14, 6, stone);
  R.wall(2, -14, 8, -14, 6, M('placeholder'), { tile: 6 });
  R.wall(8, -14, 12, -14, 6, stone);
  R.wall(-12, -14, -12, 14, 6, stone);
  R.wall(12, -14, 12, 14, 6, stone);
  for (let x = -11; x <= 11; x += 2) for (const z of [-13.9, 13.9]) R.add(worldBox(1, 0.8, 0.6, stone, 1), x, 6.4, z);
  for (let z = -13; z <= 13; z += 2) for (const x of [-11.9, 11.9]) R.add(worldBox(0.6, 0.8, 1, stone, 1), x, 6.4, z);
  // nedokončený dům – jen PLACEHOLDER
  const ph = R.add(worldBox(4, 5, 5, M('placeholder'), 5), -10, 2.5, 9.5); R.solid(ph);

  // hodinová věž – vždy 16:47
  const tower = R.add(worldBox(4, 13, 4, stone, 2), 10, 6.5, 12); R.solid(tower);
  const clk = props.clock(1.2); R.add(clk, 10, 9.5, 9.95, Math.PI);
  R.add(worldBox(4.6, 1, 4.6, M('wood'), 1), 10, 13.4, 12);

  // trůn a král
  const plat = R.add(worldBox(7, 0.4, 4, M('stone', { tint: 0xa08070 }), 1.5), 0, 0.2, 12); R.solid(plat);
  R.add(worldBox(3, 0.02, 6, M('carpet'), 3), 0, 0.02, 7);
  R.add(props.throne(), 0, 0.4, 13);
  for (const x of [-2.6, 2.6]) for (const z of [10.4, 13.6]) R.add(worldBox(0.2, 4, 0.2, M('gold'), 1), x, 2.2, z);
  R.add(worldBox(5.6, 0.2, 3.6, M('cloth', { tint: 0x7a1020 }), 2), 0, 4.2, 12);
  for (const x of [-5, 5]) R.add(card(1.4, 3, M('banner')), x, 3.5, 13.75).rotation.y = Math.PI;
  // pochodně
  for (const x of [-2, 2]) {
    R.add(worldBox(0.1, 1.2, 0.1, M('wood'), 1), x, 2.0, 10.2);
    const f = R.add(card(0.4, 0.6, M('flame', { emissive: 1, side: THREE.DoubleSide })), x, 2.8, 10.2); R.billboard(f);
  }
  const king = makeKing();
  const ep = () => !!F.epilogue;
  addNPC(R, king, 0, 11.3, Math.PI, {
    name: 'Král Oswin', y: 0.4, silent: true, at: [0, 9.6], radius: 1.8, solid: false,
    line: () => kingRepeat(S, F), faceless: () => faceless.king(S), forceT: ep,
  });
  R.collider(-0.6, 10.6, 0.6, 12);
  // koruna nad trůnem – plní se krystaly
  const crown = makeCrown(); crown.scale.setScalar(0.45); R.add(crown, 0, 3.2, 12.4);
  const slots = [0, 1, 2].map(i => { const c = makeCrystal(); c.scale.setScalar(0.5); const a = i / 3 * Math.PI * 2; c.position.set(Math.sin(a) * 0.5, 3.2, 12.4 + Math.cos(a) * 0.5); R.scene.add(c); return c; });
  R.every((dt, t) => { crown.rotation.y = t * 0.3; slots.forEach((c, i) => { c.visible = (F.crown ?? 0) > i; c.userData.spin.rotation.y = t * 2; }); });
  R.interactables.pop();
  R.interact([0, 9.6], 'Mluvit s králem', async () => {
    const back = closeup(R, king, 1.6, 1.75);
    const say = (t, o = {}) => ui.say('Král Oswin', t, { silent: true, ...o });
    if (!F.talkedKing) {
      sound.silence(true, 0.5);
      await ui.lines('Král Oswin', [
        'Wrene. Můj věrný učni. Konečně ses načetl.',
        'Koruna Ardemooru je prázdná. Tři Krystaly Paměti z ní vypadly a zakutálely se... někam dovnitř.',
        'Najdi je. Až bude koruna zase celá, všichni se vrátí domů. Včas.',
        'První krystal je za prvními dveřmi. Ostatní dveře ještě nejsou... hotové.',
        'Vezmi si tuhle mapu. Kreslil ji někdo, kdo tu byl před tebou.',
      ], { silent: true });
      game.give('mapa', 'MAPA ARDEMOORU  [Tab]');
      await say('Je 16:47. Pořád je 16:47.', { glitch: 0.08 });
      F.talkedKing = true;
      back();
      sound.silence(false, 1);
      await game.wait(1.2);
      await game.roomRestart('start', 'Některé věci se načítají dvakrát.');
      F.guardsStare = game.time;
      ui.caption('Král ti dal úkol. První dveře na východní zdi jsou otevřené.', 5);
      return;
    }
    // vložení krystalů do koruny
    let deposited = false;
    for (let n = 1; n <= 3; n++) {
      if (!game.has('krystal' + n)) continue;
      game.take('krystal' + n);
      F.crown = (F.crown ?? 0) + 1; deposited = true;
      sound.play('crystal', { vol: 0.7, rate: 0.8 }); game.glitch.flash = 0.5;
      for (const l of CROWN_LINES[F.crown]) await say(l);
    }
    if (deposited && F.crown >= 3) {
      back();
      sound.silence(true, 0.2);
      await game.wait(1.0);
      sound.play('thud'); game.tear(0.8, 1.5); game.glitch.noise = 0.6;
      door4.visible = true; door4wall.visible = false; door4col.off = true;
      ui.caption('Ve východní zdi jsou najednou čtvrté dveře. Na mapě byly vždycky.', 6);
      sound.silence(false, 2);
      return;
    }
    if (!deposited) await say(kingRepeat(S, F), { glitch: Math.random() < 0.3 ? 0.15 : 0 });
    else await say(F.crown === 1 ? 'Druhé dveře se načetly.' : 'Třetí dveře se načetly.');
    back();
  }, { radius: 1.8 });

  // pekař Bořek
  const oven = props.oven(); R.add(oven, -10.7, 0, -1, Math.PI / 2); R.solid(oven);
  const ctr = props.counter(3, 0.8); R.add(ctr, -8.0, 0, -1, Math.PI / 2); R.solid(ctr);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.3, 2, 5), M('bread')); b.rotation.z = Math.PI / 2; R.add(b, -8.0, 1.12, -1.8 + i * 0.7); }
  addNPC(R, makeBaker(), -9.3, -0.4, Math.PI / 2, {
    name: 'Pekař Bořek', at: [-7.0, -0.4], radius: 1.6, solid: false,
    line: () => bakerLine(S), faceless: () => faceless.baker(S), forceT: ep,
    work: () => S.saves < 1, headTrack: true, face: () => S.saves >= 1, closeup: 1.45, headY: 1.68,
  });
  for (const [x, z] of [[-9.5, -4], [-10.5, -4.6], [-9.8, 2.6]]) { const b = props.barrel(); R.add(b, x, 0, z); R.solid(b); }

  // strážní
  [[-3.2, 9.2, Math.PI], [3.2, 9.2, Math.PI], [9.6, -5.6, -Math.PI / 2]].forEach(([x, z, a], i) => {
    addNPC(R, makeGuard(i), x, z, a, {
      name: 'Strážný', line: () => guardLine(i, S, F), tpose: true, headTrack: true,
      faceless: () => i === 1 && faceless.guard2(S),
      forceT: () => ep() || (F.guardsStare && i < 2 && game.time - F.guardsStare < 6),
    });
  });

  // studna, stromy, save krystal
  const well = props.well(); R.add(well, 0, 0, -2); R.collider(-1.1, -3.1, 1.1, -0.9);
  for (const [x, z] of [[-9.5, -11.5], [6, -11.6], [-6, 12.2]]) { const t = props.tree(); R.add(t, x, 0, z); R.collider(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  addSaveCrystal(R, 5.5, -1.0, 'hub', { face: [0, -1] });

  // dveře ve východní zdi: I kuchyně, II kostel, III škola, IV ten, kdo čeká
  const doors = [
    { z: -8, n: 'I', room: 'kitchen', open: () => F.talkedKing, why: 'Dveře se nehnou. Nejdřív bys měl mluvit s králem.' },
    { z: -3, n: 'II', room: 'church', open: () => (F.crown ?? 0) >= 1, sys: 'Oblast „KOSTEL“ se ještě nenačetla.' },
    { z: 2, n: 'III', room: 'school', open: () => (F.crown ?? 0) >= 2, sys: 'Oblast „ŠKOLA“ se ještě nenačetla.' },
    { z: 7, n: 'IV', room: 'boss', open: () => (F.crown ?? 0) >= 3 },
  ];
  let door4, door4wall, door4col;
  doors.forEach(({ z, n, room, open, why, sys }, i) => {
    const d = R.add(worldBox(0.2, 2.8, 1.8, M('door', { tint: i === 3 ? 0x806070 : 0xffffff }), 1.8), 11.8, 1.4, z);
    const lintel = R.add(worldBox(0.3, 0.3, 2.2, stone, 1), 11.75, 2.95, z);
    const s = card(1.2, 0.5, ps1Mat(signTex(n, { w: 64, h: 24, font: 'bold 18px serif' })));
    R.add(s, 11.6, 3.5, z, -Math.PI / 2);
    if (i === 3) { // čtvrté dveře existují jen na mapě, dokud není koruna celá
      door4 = new THREE.Group(); [d, lintel, s].forEach(o => { R.scene.remove(o); door4.add(o); }); R.scene.add(door4);
      door4wall = R.add(worldBox(0.25, 3.2, 2.0, stone, 2), 11.85, 1.6, z);
      door4col = R.collider(11.4, z - 1, 12, z + 1);
      const on = open(); door4.visible = on; door4wall.visible = !on; door4col.off = on;
    }
    R.interact([11.0, z], () => (open() ? `Otevřít dveře ${n}` : `Dveře ${n}`), async () => {
      if (!open()) {
        sound.play('locked');
        if (why) await ui.say(null, why);
        else await ui.system(['NENAČTENO', '', sys, 'Vložte disk 2.'], { title: 'CHYBA ČTENÍ' });
        return;
      }
      sound.play('door');
      await game.loadRoom(room, 'start');
    }, { radius: 1.6, cond: () => i < 3 || open() });
  });

  // epilog konce 2: nikdo se nehýbe
  if (ep()) { game.player.visible = false; R.env.sound = null; }
  R.onEnter = () => {
    if (ep()) return;
    ui.title('NÁDVOŘÍ ARDEMOORU', 3, '16:47');
    if ([1, 2, 3].some(n => game.has('krystal' + n))) ui.caption('Krystal v kapse pálí. Král čeká na trůnu.', 5);
  };
  // kamery (poloviční – pevná pozice, sledují hráče)
  R.cam([6, -14, 12, 6], [3, 3.6, -12.8]);           // u dveří
  R.cam([-12, -6, -5, 5], [-4.5, 3.4, -7.5]);        // pekař
  R.cam([-12, 6, 12, 14], [5.5, 4.5, 2.5]);          // trůn
  R.cam([-12, -2, 12, 6], [-6, 5, -11]);             // střed
  R.cam([-12, -14, 12, -2], [-4, 4.6, -13.4]);     // jih

  R.intro = () => { ui.toast(game.firstPerson ? 'W/S chůze · A/D úkrok · šipky/myš otáčení · V pohled' : 'Šipky: tank ovládání · V pohled', 6); ui.caption('Ardemoor. Slunce tu nikdy nezapadne. Král čeká na trůnu na severu.', 6); };
  return R;
}
