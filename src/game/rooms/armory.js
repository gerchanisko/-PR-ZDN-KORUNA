// LEVEL 1b: Zbrojnice-kuchyně. Prázdný kabát hlídkuje, hráč se schovává ve skříních.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeCoat } from '../../assets/models.js';
import { setLights } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addStalker, addHideSpots } from '../stalker.js';
import { addMemoryCrystal, returnToHub } from '../flow.js';

const RING = [[0, 7.2], [-4.7, 7.2], [-4.7, -4.6], [4.7, -4.6], [4.7, 7.2]];

export function buildArmory(game) {
  const R = new Room(game, 'armory');
  const S = game.state, F = S.flags, ui = game.ui;
  const escape = !!F.escape1;
  const baseLights = escape
    ? [{ pos: [0, 3.5, -5], color: 0xff2010, range: 9, intensity: 1.0 }, { pos: [0, 3.5, 4], color: 0xff2010, range: 9, intensity: 1.0 }, { pos: [0, 2, 8.3], color: 0xc040ff, range: 4 }]
    : [{ pos: [0, 3.6, -5.5], color: 0xffe0a0, range: 8, intensity: 0.8 }, { pos: [0, 3.6, 3], color: 0xffe0a0, range: 8, intensity: 0.7 }, { pos: [0, 2, 8.3], color: 0xc040ff, range: 5, intensity: 1.2 }];
  R.env = {
    fog: escape ? 0x180404 : 0x0a0809, near: 3, far: 15, ambient: escape ? [0.34, 0.1, 0.1] : [0.27, 0.24, 0.27], sun: [0, 0, 0],
    lights: baseLights, sound: 'ambArmory', soundVol: 0.55,
  };
  R.spawns = { start: [0, -8.8, 0], pedestal: [0, 7.3, Math.PI] };

  // stavba
  R.floor(-7, -10, 7, 10, M('tilesFloor', { tint: 0x9a8a7a }), 2);
  R.ceiling(-7, -10, 7, 10, 4, M('stone', { tint: 0x605858 }), 2.5);
  const stone = M('stone', { tint: 0xb0a8a0 });
  R.wall(-7, 10, 7, 10, 4, stone);
  R.wall(-7, -10, -0.9, -10, 4, stone); R.wall(0.9, -10, 7, -10, 4, stone);
  R.add(worldBox(1.8, 1.4, 0.4, stone, 2), 0, 3.3, -10);
  R.wall(-7, -10, -7, 10, 4, stone); R.wall(7, -10, 7, 10, 4, stone);
  // pás kachliček – kuchyně prorůstá zbrojnicí
  for (const x of [-6.78, 6.78]) R.add(worldBox(0.05, 1.2, 20, M('tilesWall'), 1.2), x, 0.9, 0);
  R.add(worldBox(1.8, 2.4, 0.15, M('door'), 1.8), 0, 1.2, -9.95);

  // regály ve dvou řadách (mezera uprostřed)
  for (const x of [-2.5, 2.5]) for (const z of [-2.5, -0.5, 3.0, 5.0]) {
    const r = props.rack(2); R.add(r, x, 0, z, Math.PI / 2); R.solid(r, 0.05);
  }
  // předsíň u vchodu – regály stíní dveře před pohledem z haly
  for (const x of [-2, 0, 2]) { const r = props.rack(2); R.add(r, x, 0, -7.0, Math.PI); R.solid(r, 0.05); }
  // stoly s hrnci a helmami
  const t1 = props.table(1.6, 0.9); R.add(t1, -6.2, 0, 2.0, Math.PI / 2); R.solid(t1);
  const t2 = props.counter(1.6, 0.8); R.add(t2, 6.25, 0, 0.6, Math.PI / 2); R.solid(t2);
  for (const [x, z] of [[-6.2, 1.6], [6.25, 0.2]]) { const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.3, 6), M('metal')); R.add(pot, x, 1.05, z); }
  for (const [x, z, a] of [[-6.2, -7.5, Math.PI / 2], [6.2, -8.5, -Math.PI / 2], [-3.8, 9.2, Math.PI]]) { const s = props.armorStand(); R.add(s, x, 0, z, a); R.solid(s); }

  // skříně na schování
  addHideSpots(R, [[-6.3, -1.5, Math.PI / 2], [6.3, 3.6, -Math.PI / 2], [-6.3, 5.6, Math.PI / 2], [6.3, -6.2, -Math.PI / 2]],
    { kind: 'wardrobe', label: 'Schovat se do skříně', caption: 'Schováváš se. Ve skříni voní naftalín a kabáty.', model: props.wardrobe });

  // vzkaz u vchodu
  const note = card(0.5, 0.6, M('note')); R.add(note, -1.6, 1.5, -9.78);
  R.interact([-1.6, -9.0], 'Přečíst vzkaz na zdi', async () => {
    await ui.say(null, '„Když přijde kabát, schovej se do skříně a buď potichu. Kabát nikoho nenajde, když je ticho.  —T.“');
  }, { radius: 1.1 });

  // podstavec s Krystalem paměti
  addMemoryCrystal(R, 1, 0, 8.4, 1.45, { face: [0, -1] });

  R.interact([0, -9.0], () => (escape ? 'UTÉCT' : 'Dveře zpět'), async () => {
    if (escape) return returnToHub(game, 1);
    sound.play('locked'); await ui.say(null, 'Zamčeno. Za dveřmi už asi není kuchyně.');
  }, { radius: 1.2 });
  if (escape) R.trigger([-1.2, -10, 1.2, -9.2], () => { if (!game.lock) returnToHub(game, 1); });

  // KABÁT
  const coat = addStalker(R, {
    obj: makeCoat(), ring: RING, start: escape ? [3.8, 7.2] : [0, 7.2], startWp: 1, escape, float: true,
    initialMode: () => (F.armoryIntro ? 'patrol' : 'off'),
    seenText: 'Kabát se otočil k tobě.',
    captureSpawn: escape ? 'pedestal' : 'start',
    captureText: escape ? 'Kabát tě nenašel. Ještě ne.' : 'Kabát odešel. Místnost se načetla znovu.',
  });
  R.coat = coat;

  // kamery
  R.cam([-7, -10, 7, -6], [5.5, 3.6, -9.5]);
  R.cam([-7, -6, -2.5, 1.25], [-6.2, 3.6, -5.8]);
  R.cam([2.5, -6, 7, 1.25], [6.2, 3.6, -5.8]);
  R.cam([-2.5, -6, 2.5, 1.25], [0, 3.7, -6.5]);
  R.cam([-7, 1.25, -2.5, 10], [-6.2, 3.6, 0.6]);
  R.cam([2.5, 1.25, 7, 10], [6.2, 3.6, 0.6]);
  R.cam([-2.5, 1.25, 2.5, 10], [0, 3.7, 0.5]);

  R.onEnter = async () => {
    if (escape) {
      ui.title('UTEČ', 2);
      R.worstMoment = true;
      await game.wait(1.0);
      // falešná hláška v nejhorší možné chvíli – hra se nezastaví
      await ui.system(['PAMĚŤOVÁ KARTA (SLOT 1) JE PLNÁ.', '', 'Vzpomínku nelze uložit.', 'Pokračovat bez uložení?'], { title: 'PAMĚŤOVÁ KARTA', buttons: ['ANO', 'ANO'], minT: 0.8 });
      R.worstMoment = false;
      ui.caption('Dveře na jihu. Utíkej.', 4);
      return;
    }
    ui.title('ZBROJNICE', 2.5, 'nebo kuchyně');
    if (F.armoryIntro) return;
    F.armoryIntro = true;
    await game.locked(async () => {
      sound.silence(true, 0.3);
      await game.wait(2.0);
      // světla zablikají
      for (let i = 0; i < 6; i++) { setLights(i % 2 ? baseLights : []); sound.play('click', { vol: 0.3 }); await game.wait(0.08 + Math.random() * 0.15); }
      setLights(baseLights);
      coat.mode = 'emerge'; coat.t = 1.8;
      sound.play('sting');
      const prev = game.room.cameraOverride;
      R.cameraOverride = (cam) => { cam.position.set(0, 1.9, 2.4); cam.lookAt(0, 1.5, 7.2); if (cam.fov !== 45) { cam.fov = 45; cam.updateProjectionMatrix(); } };
      await game.wait(2.4);
      coat.mode = 'patrol'; coat.wp = 1;
      R.cameraOverride = prev; game.camCurrent = null;
      sound.silence(false, 1.5);
      await ui.say(null, 'Na ramínku visí kabát. Nikdo v něm není. A přesto se otočil.');
      ui.caption('Kabát hlídkuje. Krystal je na severu. Schovej se do skříně, když se přiblíží.', 6);
    });
  };
  return R;
}
