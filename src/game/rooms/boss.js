// BOSS: „Ten, kdo čeká“ – obří loading bar zaseknutý na 99 %, který ohýbá prostor.
// Nezabíjí se. Hádanka: když se na něj díváš, vzdaluje se; dojít k němu jde jen zády. Pak rozhodnutí.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeKing, makeBaker, makeGuard, makeCoat, makeTeacher, makeBellRinger, makeLoadingBar, makeCrystal } from '../../assets/models.js';
import { signTex } from '../../assets/textures.js';
import { ps1Mat, shared } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { addNPC } from '../npc.js';
import { faceless } from '../lore.js';
import { finishEnding, consoleOffEnding } from '../flow.js';

const BAR = new THREE.Vector3(0, 3.4, 12);

export function buildBoss(game) {
  const R = new Room(game, 'boss');
  const S = game.state, F = S.flags, ui = game.ui;
  R.env = {
    fog: 0x0c0614, near: 6, far: 32, ambient: [0.3, 0.22, 0.36], sun: [0.2, 0.1, 0.3],
    lights: [{ pos: [0, 3, 10.5], color: 0xffc040, range: 14, intensity: 1.3 }, { pos: [0, 6, -6], color: 0x6040a0, range: 18, intensity: 0.6 }],
    sound: 'ambBoss', soundVol: 0.6, bend: 0.6, bendPos: [BAR.x, BAR.y, BAR.z],
  };
  R.spawns = { start: [0, -13, 0] };

  // podlaha poskládaná z kusů všech levelů
  const texs = ['tilesFloor', 'cobble', 'linoleum', 'carpet', 'stone', 'water', 'placeholder', 'wood'];
  let k = 0;
  for (let x = -16; x < 16; x += 4) for (let z = -16; z < 16; z += 4) {
    const t = texs[(k++ * 7 + (x * z) % 5 + 8) % texs.length];
    R.floor(x, z, x + 4, z + 4, M(t, t === 'water' ? { emissive: 0.5, scroll: [0.02, 0.01] } : {}), t === 'placeholder' ? 4 : 2, (Math.abs(x + z) % 3) * 0.01);
  }
  for (const [x0, z0, x1, z1] of [[-16, -16, 16, -15.6], [-16, 15.6, 16, 16], [-16, -16, -15.6, 16], [15.6, -16, 16, 16]]) R.collider(x0, z0, x1, z1);
  // nebe z oblohy Ardemooru, ale tmavé
  const sky = new THREE.Mesh(new THREE.SphereGeometry(45, 10, 6), M('sky', { noFog: true, emissive: 0.35, side: THREE.BackSide, uv: [3, 1] }));
  R.add(sky, 0, -12, 0);

  // poletující úlomky světa
  const debris = [];
  const add = (o, x, y, z, ry = 0) => { R.add(o, x, y, z, ry); debris.push({ o, y, s: Math.random() * 6 }); };
  add(props.counter(2, 0.8), -9, 1.5, 3, 0.6);
  add(props.stove(), 8.5, 2.2, -2, -0.8);
  add(props.pew(3), 7, 0.8, 8, 0.3);
  add(props.bell(), -7, 5.5, 9);
  add(props.wardrobe(), -11, 0.5, -6, 1.2);
  add(props.locker(true), 11, 0.6, -9, -1.0);
  add(worldBox(4, 3, 0.3, M('placeholder'), 3), 12, 2.5, 6, -0.4);
  add(worldBox(1.6, 2.6, 0.15, M('door'), 1.6), -5, 1.4, -7, 0.2);
  add(props.clock(1.0), 0, 8.5, 14);
  add(props.bed(), 10, 3, 12, 2.2);
  add(props.throne(), -10, 2, 11, 0.9);
  R.every((dt, t) => debris.forEach(d => { d.o.position.y = d.y + Math.sin(t * 0.6 + d.s) * 0.4; d.o.rotation.y += dt * 0.05 * Math.sin(d.s); }));

  // všichni, kdo čekají – v T-pose, sledují hráče
  const watchers = [
    [makeBaker(), -7, -2, () => faceless.baker(S)], [makeKing(), 7, -1, () => faceless.king(S)],
    [makeGuard(1), -4.5, 5, () => faceless.guard2(S)], [makeGuard(2), 4.5, 5, () => false],
  ];
  watchers.forEach(([o, x, z, fl]) => addNPC(R, o, x, z, 0, { name: '...', line: '. . .', silent: true, forceT: () => true, faceless: fl }));
  for (const [mk, x, z] of [[makeCoat, -12, 2], [makeBellRinger, 12, 1], [makeTeacher, 0, 15]]) { const o = mk(); R.add(o, x, 0.1, z, Math.atan2(-x, -z - 13)); }

  // TEN, KDO ČEKÁ
  const bar = makeLoadingBar((t) => signTex(t, { w: 128, h: 24, font: 'bold 15px monospace', bg: '#000', fg: '#e8d8a0' }));
  bar.rotation.y = Math.PI;
  R.add(bar, BAR.x, BAR.y, BAR.z, Math.PI);
  const crystals = [0, 1, 2].map(i => { const c = makeCrystal(); c.visible = false; R.scene.add(c); return c; });
  R.every((dt, t) => {
    bar.position.y = BAR.y + Math.sin(t * 0.5) * 0.15;
    bar.userData.label.material.uniforms.uOpacity.value = Math.sin(t * 3) > -0.8 ? 1 : 0.3;
    crystals.forEach((c, i) => { if (!c.visible) return; c.userData.spin.rotation.y = t * 2; });
  });

  // vzkaz u startu
  const note = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.55), M('note')); note.rotation.x = -Math.PI / 2; R.add(note, 0.8, 0.03, -11.8).rotation.set(-Math.PI / 2, 0, 0.4);
  R.interact([0.8, -11.8], 'Přečíst vzkaz na zemi', async () => {
    await ui.say(null, '„Na to, co čeká, se nedívej. Jdi k tomu zády.  —T.“');
  }, { radius: 1.2 });

  // hádanka: prostor se natahuje, když jdeš k baru čelem
  let prevD = null, capT = 0, triggered = false;
  const CAPS = ['Čím víc se díváš, tím je to dál.', 'Ten, kdo čeká, se vzdaluje.', 'Prostor se natáhl jako guma.', 'Pořád stejně daleko.'];
  let capI = 0;
  R.every((dt) => {
    const P = game.player;
    const dx = BAR.x - P.pos.x, dz = BAR.z - P.pos.z, d = Math.hypot(dx, dz);
    const want = R.calm ? 0.12 : 0.5 + Math.max(0, 1 - d / 26) * 0.9;
    shared.uBendAmt.value += (want - shared.uBendAmt.value) * Math.min(1, dt * 2);
    capT -= dt;
    if (prevD !== null && game.canMove() && d < prevD && d < 18) {
      const facing = (Math.sin(P.angle) * dx + Math.cos(P.angle) * dz) / d;
      if (facing > -0.35) { // díváš se na něj → odstrčí tě zpátky
        const push = (prevD - d) * 2.2;
        P.pos.x -= dx / d * push; P.pos.z -= dz / d * push;
        if (Math.random() < 0.05) game.tear(0.15, 0.4);
        if (capT <= 0) { ui.caption(CAPS[capI++ % CAPS.length], 3); capT = 5; }
      }
    }
    prevD = Math.hypot(BAR.x - P.pos.x, BAR.z - P.pos.z);
    if (!triggered && prevD < 3.6 && game.canMove()) { triggered = true; game.locked(() => confrontation()); }
  });
  R.collider(-6.5, 11.6, 6.5, 12.4);

  async function confrontation() {
    const P = game.player;
    sound.silence(true, 0.5);
    R.calm = true;
    R.cameraOverride = (cam) => { cam.position.set(2.0, 2.4, 3.5); cam.lookAt(BAR.x, BAR.y + 0.3, BAR.z); if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); } };
    await game.wait(1.2);
    // krystaly z koruny vletí do baru
    for (let i = 0; i < 3; i++) {
      const c = crystals[i]; c.visible = true;
      const from = new THREE.Vector3(P.pos.x, 1.5, P.pos.z), to = new THREE.Vector3(-3 + i * 3, BAR.y, BAR.z - 0.4);
      sound.play('crystal', { vol: 0.5, rate: 0.7 + i * 0.15 });
      for (let f = 0; f <= 30; f++) { c.position.lerpVectors(from, to, f / 30); c.position.y += Math.sin(f / 30 * Math.PI) * 1.5; await game.nextFrame(); }
    }
    await game.wait(0.8);
    const say = (t, o = {}) => ui.say('Ten, kdo čeká', t, { silent: true, color: '#d8c890', ...o });
    if (!F.bossTalked) {
      await say('Čekám tady od roku 1999.');
      await say('Načetl jsem všechno. Hrad, kuchyni, kostel, školu. Krále, pekaře, kabát. Tebe.');
      await say('Chybí poslední procento.');
      await say('To procento je kluk, který každý den ve 16:47 sedí u okna a poslouchá, jestli cvaknou dveře.');
      await say('Když ho vymažu, hra se dohraje. Dohraješ se ty. Dohrají se všichni.');
      await say('...nebo ho nech v menu. V menu se nečeká.', { glitch: 0.12 });
      F.bossTalked = true;
    } else await say('Pořád 99 %.');
    const c = await ui.choice('Co uděláš?', [{ label: 'DOKONČIT NAČÍTÁNÍ' }, { label: 'VYPNOUT KONZOLI' }, { label: 'NIC' }]);
    if (c === 0) {
      ui.log.push('[rozhodnutí] dokončit');
      sound.play('fill');
      const fill = bar.userData.fill;
      for (let f = 0; f <= 40; f++) { fill.scale.x = 0.99 + 0.01 * f / 40; fill.position.x = -bar.userData.W * (1 - fill.scale.x) / 2; await game.nextFrame(); }
      bar.userData.label.material.uniforms.map.value = signTex('NAČTENO   100 %', { w: 128, h: 24, font: 'bold 15px monospace', bg: '#000', fg: '#ffffff' });
      game.glitch.flash = 2; shared.uBendAmt.value = 0; R.env.bend = 0;
      await game.wait(1.5);
      return finishEnding(game);
    }
    if (c === 1) { ui.log.push('[rozhodnutí] vypnout'); return consoleOffEnding(game); }
    // NIC: čeká dál
    ui.log.push('[rozhodnutí] nic');
    await say('Dobře. Já počkám. To umím.');
    R.calm = false;
    R.cameraOverride = null; game.camCurrent = null;
    sound.silence(false, 1);
    triggered = true;
    ui.caption('Ten, kdo čeká, čeká. Ty můžeš taky.', 5);
  }
  R.interact([0, 9.6], 'Rozhodnout se', async () => { await confrontation(); }, { radius: 2.2, cond: () => F.bossTalked && game.mode === 'play' });

  // kamery (fixní režim)
  R.cam([-16, -16, 16, 16], [6, 5, -15]);
  R.onEnter = async () => {
    ui.title('TEN, KDO ČEKÁ', 3.5, 'NAČÍTÁNÍ 99 %');
    if (!F.bossIntro) {
      F.bossIntro = true;
      await game.wait(3.5);
      ui.caption('Daleko vpředu visí obrovský loading bar. Všechno kolem se k němu ohýbá.', 6);
    }
  };
  R.leaves.push(() => { shared.uBendAmt.value = 0; });
  return R;
}
