// LEVEL 3: Školní chodba, která končí trůnním sálem. Učitelka bez obličeje hlídá chodbu.
// Hádanka: Tomášova skříňka má zámek na 4 číslice (16:47) → propustka → dveře do trůnního sálu.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeTeacher, makeCoat, tex } from '../../assets/models.js';
import { signTex } from '../../assets/textures.js';
import { ps1Mat } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addStalker, addHideSpots } from '../stalker.js';
import { addMemoryCrystal, addSaveCrystal, returnToHub } from '../flow.js';
import { W, H } from '../ui.js';

const CODE = '1647';

export function buildSchool(game) {
  const R = new Room(game, 'school');
  const S = game.state, F = S.flags, ui = game.ui;
  const escape = !!F.escape3;
  R.env = {
    fog: escape ? 0x1a0606 : 0x14120c, near: 3, far: 17, ambient: escape ? [0.35, 0.12, 0.1] : [0.32, 0.31, 0.27], sun: [0, 0, 0],
    lights: [
      { pos: [0, 3, -10], color: 0xf0f8e0, range: 10, intensity: 0.7 },
      { pos: [0, 3, 5], color: 0xf0f8e0, range: 10, intensity: 0.7 },
      { pos: [6.5, 3, -2], color: 0xffe8c0, range: 8, intensity: 0.8 },
      { pos: [0, 4, 21], color: 0xffb050, range: 10, intensity: 1.0 },
    ],
    sound: 'ambSchool', soundVol: 0.55,
  };
  R.spawns = { start: [0, -18.8, 0], pedestal: [0, 21.9, Math.PI] };

  // ---- chodba (x -2.5..2.5, z -20..14)
  const wall = M('schoolWall');
  R.floor(-2.5, -20, 2.5, 14, M('linoleum'), 1.6);
  R.ceiling(-2.5, -20, 2.5, 14, 3.2, M('tilesWall', { tint: 0xb0b0a0 }), 1.2);
  R.wall(-2.5, -20, -2.5, 14, 3.2, wall, { tile: 3.2 });
  R.wall(2.5, -20, 2.5, -3.2, 3.2, wall, { tile: 3.2 }); R.wall(2.5, -0.8, 2.5, 14, 3.2, wall, { tile: 3.2 });
  R.add(worldBox(0.4, 0.8, 2.4, wall, 3.2), 2.5, 2.8, -2);
  R.wall(-2.5, -20, 2.5, -20, 3.2, wall, { tile: 3.2 });
  R.add(worldBox(1.6, 2.4, 0.15, M('door'), 1.6), 0, 1.2, -19.9);
  // zářivky
  const lamps = [];
  for (let z = -17; z <= 12; z += 5) { const l = card(0.6, 1.6, M('white', { emissive: 1, tint: 0xe8f0e0 })); l.rotation.x = Math.PI / 2; R.add(l, 0, 3.18, z).rotation.x = Math.PI / 2; lamps.push(l); }
  R.every((dt, t) => { lamps.forEach((l, i) => { l.visible = !(i === 3 && Math.sin(t * 13) * Math.sin(t * 3.1) > 0.6); }); });

  // skříňky v řadách (dlouhé kvádry, mezery pro otevřené skříňky)
  const lockerMat = M('locker', { uv: [1 / 0.6, 0.5] });
  const row = (x, segs) => segs.forEach(([z0, z1]) => { const b = worldBox(0.55, 2.0, z1 - z0, lockerMat, 1); R.add(b, x, 1.0, (z0 + z1) / 2); R.solid(b); });
  row(-2.2, [[-16, -14.3], [-13.7, -0.3], [0.3, 8.7], [9.3, 12]]);
  row(2.2, [[-16, -10.3], [-9.7, -3.3], [-0.7, 6.7], [7.3, 12]]);
  addHideSpots(R, [[-2.2, -14, Math.PI / 2], [-2.2, 0, Math.PI / 2], [-2.2, 9, Math.PI / 2], [2.2, -10, -Math.PI / 2], [2.2, 7, -Math.PI / 2]],
    { kind: 'locker', label: 'Schovat se do skříňky', caption: 'Ve skříňce je těsno. Kovové dveře studí.', model: () => props.locker(true), front: 0.9 });

  // Tomášova skříňka
  const tag = card(0.5, 0.18, ps1Mat(signTex('TOMÁŠ 2.B', { w: 64, h: 20, font: 'bold 11px sans-serif', bg: '#e8e0c8', fg: '#203080' })));
  R.add(tag, -1.91, 1.75, 4, Math.PI / 2);
  R.interact([-1.3, 4], () => (F.lockerOpen ? 'Tomášova skříňka (prázdná)' : 'Tomášova skříňka (zámek)'), async () => {
    if (F.lockerOpen) { await ui.say(null, 'Uvnitř zůstala jen vůně pastelek.'); return; }
    const code = await ui.code('ZÁMEK NA ČTYŘI ČÍSLA');
    if (code === null) return;
    if (code !== CODE) { sound.play('locked'); await ui.say(null, `Zámek necvakl. ${code.slice(0, 2)}:${code.slice(2)} není ten správný čas.`); return; }
    F.lockerOpen = true; sound.play('click'); sound.play('door', { rate: 1.5, vol: 0.6 });
    await ui.say(null, 'Cvak. Ve skříňce je přeložený papír a pod ním lísteček.');
    game.give('propustka', 'PROPUSTKA');
    await ui.say(null, 'Propustka: „Tomáš smí odejít domů. Podpis rodiče: ____________“. Podpis chybí.');
    await ui.say(null, 'Lísteček: „Když nevíš, co dál, zůstaň v menu. Tam tě nikdo nehledá. Tam se nečeká.  —T.“');
  }, { radius: 1.1 });

  // věšák s posledním kabátem a kresba
  R.add(props.coatHooks(3), 2.45, 0, -18, -Math.PI / 2);
  const coat = makeCoat(); coat.scale.setScalar(0.55); R.add(coat, 2.3, 0.55, -17.5, -Math.PI / 2);
  R.add(card(0.8, 0.8, M('drawing2')), -2.28, 2.55, -6, Math.PI / 2);
  R.interact([-1.3, -6], 'Prohlédnout kresbu', async () => {
    await showPaper(game, tex().drawing2.userData.canvas, 'Kresba: „JÁ“. Vedle dvě postavy, máma a táta. Obě jsou vygumované.');
  }, { radius: 1.2 });

  // ---- třída (x 2.5..10.5, z -7..3)
  R.floor(2.5, -7, 10.5, 3, M('linoleum', { tint: 0xc0b0a0 }), 1.6);
  R.ceiling(2.5, -7, 10.5, 3, 3.2, M('tilesWall', { tint: 0xa0a090 }), 1.2);
  R.wall(2.5, 3, 10.5, 3, 3.2, wall, { tile: 3.2 }); R.wall(2.5, -7, 10.5, -7, 3.2, wall, { tile: 3.2 });
  R.wall(10.5, -7, 10.5, 3, 3.2, wall, { tile: 3.2 });
  R.add(card(3.2, 1.6, M('blackboard')), 10.28, 1.7, -2, -Math.PI / 2);
  R.interact([9.4, -2], 'Přečíst tabuli', async () => {
    await ui.say(null, 'Na tabuli: „Domácí úkol: Kolik je hodin, když se čeká nejdéle?  __ : __“');
  }, { radius: 1.4 });
  for (const x of [4.4, 6.2, 8.0]) for (const z of [-5, -2.6, -0.2]) { const d = props.desk(); R.add(d, x, 0, z, Math.PI / 2); R.solid(d, -0.1); }
  const tdesk = props.table(1.4, 0.8); R.add(tdesk, 9.4, 0, 1.2); R.solid(tdesk);
  R.interact([9.4, 0.2], 'Třídní kniha', async () => {
    await ui.say(null, 'Třídní kniha. U jména TOMÁŠ je kolonka „Vyzvedne v 17:00:“. Je prázdná. Někdo do ní tužkou napsal 16:47 a zase to vygumoval.');
  }, { radius: 1.2 });
  R.add(props.clock(0.35), 6.5, 2.4, 2.95, Math.PI);
  for (const x of [4.5, 8]) R.add(card(1.4, 1.2, M('window', { tint: 0x403040 })), x, 1.8, -6.95);
  addSaveCrystal(R, 3.4, 2.1, 'school', { face: [0.6, -0.8] });

  // ---- dveře na konci chodby a trůnní sál (z 14..26)
  const door = R.add(worldBox(1.8, 2.6, 0.15, M('door', { tint: 0xc0a080 }), 1.8), 0, 1.3, 14);
  const doorCol = R.collider(-0.9, 13.85, 0.9, 14.15);
  const openDoor = () => { door.visible = false; doorCol.off = true; };
  if (F.throneOpen) openDoor();
  R.add(worldBox(1.8, 0.6, 0.4, wall, 3.2), 0, 2.9, 14);
  R.wall(-2.5, 14, -0.9, 14, 3.2, wall, { tile: 3.2 }); R.wall(0.9, 14, 2.5, 14, 3.2, wall, { tile: 3.2 });
  R.add(card(1.4, 0.4, ps1Mat(signTex('TRŮNNÍ SÁL', { w: 96, h: 24, font: 'bold 13px serif' }))), 0, 2.45, 13.75, Math.PI);
  R.interact([0, 13.0], () => (F.throneOpen ? 'Do trůnního sálu' : game.has('propustka') ? 'Ukázat propustku' : 'Dveře na konci chodby'), async () => {
    if (F.throneOpen) return;
    if (!game.has('propustka')) { sound.play('locked'); await ui.say(null, 'Zamčeno. Na dveřích visí cedulka: „Bez propustky se neodchází.“'); return; }
    F.throneOpen = true; sound.play('door'); openDoor();
    ui.caption('Dveře ze školy vedou do trůnního sálu. Samozřejmě.', 4);
  }, { radius: 1.2, cond: () => !F.throneOpen });

  const stone = M('stone', { tint: 0xc0b0a0 });
  R.floor(-7, 14, 7, 26, M('carpet'), 3);
  R.ceiling(-7, 14, 7, 26, 5, M('wood', { tint: 0x504038 }), 2);
  R.wall(-7, 14, -2.5, 14, 5, stone); R.wall(2.5, 14, 7, 14, 5, stone);
  R.add(worldBox(5, 1.8, 0.4, stone, 2), 0, 4.1, 14);
  R.wall(-7, 26, 7, 26, 5, stone); R.wall(-7, 14, -7, 26, 5, stone); R.wall(7, 14, 7, 26, 5, stone);
  for (const x of [-4.5, 4.5]) for (const z of [17, 21]) { const p = R.add(worldBox(0.6, 5, 0.6, stone, 1.5), x, 2.5, z); R.solid(p); }
  for (const x of [-5.5, 5.5]) R.add(card(1.2, 2.6, M('banner')), x, 3, 25.75, Math.PI);
  // dětský trůn: učitelská židle na lavici, papírová koruna
  R.add(worldBox(2.4, 0.5, 1.6, M('wood', { tint: 0xa08060 }), 1), 0, 0.25, 24.6);
  const ch = props.chair(M('wood', { tint: 0xd0b040 })); ch.scale.setScalar(1.6); R.add(ch, 0, 0.5, 24.8);
  for (const [x, z] of [[-3, 18.5], [3, 18.5], [-3, 20.5], [3, 20.5]]) { const d = props.desk(); R.add(d, x, 0, z, Math.PI); R.solid(d, -0.1); }
  addMemoryCrystal(R, 3, 0, 23.0, 1.45, { face: [0, -1] });

  // ---- UČITELKA
  addStalker(R, {
    obj: makeTeacher(), ring: [[0, 12], [0, -15.5]], start: escape ? [4, 18] : [0, 12], startWp: 1, escape,
    sight: 0.9, range: 10, speeds: { patrol: 1.0, chase: 2.4, search: 1.0, escape: 2.45 },
    alarmSound: 'handbell', alarmEvery: 3.5,
    seenText: 'Paní učitelka tě vidí. „Kdo tě vyzvedne?“ říká bez úst.',
    captureSpawn: escape ? 'pedestal' : 'start',
    captureText: escape ? 'Musíš počkat, až si pro tebe někdo přijde.' : 'Zpátky na začátek chodby. Tam se čeká.',
    initialMode: () => (F.schoolIntro ? 'patrol' : 'off'),
  });

  // únik
  R.interact([0, -19.1], () => (escape ? 'UTÉCT' : 'Dveře ven'), async () => {
    if (escape) return returnToHub(game, 3);
    sound.play('locked'); await ui.say(null, 'Zamčeno. Ven se smí, jen když si pro tebe někdo přijde.');
  }, { radius: 1.1 });
  if (escape) R.trigger([-1.2, -20, 1.2, -19.3], () => { if (!game.lock) returnToHub(game, 3); });

  // kamery (fixní režim)
  for (let z = -20; z < 14; z += 8) R.cam([-2.5, z, 2.5, z + 8], [1.8, 2.8, z - 1.5]);
  R.cam([2.5, -7, 10.5, 3], [9.8, 2.9, -6.4]);
  R.cam([-7, 14, 7, 26], [5.5, 4, 15]);

  R.onEnter = async () => {
    if (escape) {
      ui.title('UTEČ', 2);
      R.worstMoment = true;
      await game.wait(0.9);
      await ui.system(['OVLADAČ 1 BYL ODPOJEN.', '', 'Připojte ovladač a stiskněte tlačítko.'], { title: 'SYSTÉM', minT: 0.8 });
      R.worstMoment = false;
      ui.caption('Dlouhá chodba na jih. Utíkej.', 4);
      return;
    }
    ui.title('ŠKOLNÍ CHODBA', 3, 'kdo tě vyzvedne?');
    if (F.schoolIntro) return;
    F.schoolIntro = true;
    await game.locked(async () => {
      await game.wait(2.0);
      const prev = R.cameraOverride;
      R.cameraOverride = (cam) => { cam.position.set(0, 1.6, -12); cam.lookAt(0, 1.8, 12); if (cam.fov !== 35) { cam.fov = 35; cam.updateProjectionMatrix(); } };
      R.stalker.mode = 'patrol'; R.stalker.mode = 'off';
      await game.wait(0.1);
      R.stalker.mode = 'emerge'; R.stalker.t = 99;
      sound.play('handbell');
      await game.wait(2.6);
      R.cameraOverride = prev; game.camCurrent = null;
      R.stalker.mode = 'patrol'; R.stalker.wp = 1;
      await ui.say(null, 'Na konci chodby stojí paní učitelka. Dívá se na hodinky. Pak se otočí sem.');
      ui.caption('Když zvoní zvonek, schovej se do skříňky. Učitelka vidí daleko.', 6);
    });
  };
  return R;
}

async function showPaper(game, canvas, caption) {
  const ui = game.ui, prev = ui.overlay;
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
