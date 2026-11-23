// Vzpomínky uvnitř Krystalů paměti. 1: babička a ticho v domě. 2: hloubka a tma. 3: nikdo nepřišel.
import * as THREE from '../../../lib/three.module.js';
import { Room } from '../room.js';
import { M, worldBox, card, props, makeGranny, makeTeacher, makeCoat, makeWren } from '../../assets/models.js';
import { setLights } from '../../engine/ps1.js';
import { sound } from '../../engine/audio.js';
import { LEVEL_ROOM } from '../flow.js';

export function buildMemory(game) {
  const n = game.state.memory ?? 1;
  const R = new Room(game, 'memory');
  R.noPlayer = true;
  const ui = game.ui;
  const S = { 1: memoryGranny, 2: memoryBedroom, 3: memorySchool }[n](R, game);
  let camPos = S.cam, camLook = S.look;
  R.cameraOverride = (cam) => {
    const t = game.time - (R.t0 ?? game.time);
    cam.position.set(camPos[0] - t * 0.02, camPos[1], camPos[2] + t * 0.04);
    cam.lookAt(...camLook);
    if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); }
  };
  R.onEnter = async () => {
    R.t0 = game.time;
    game.lock++;
    await game.fade(1, 1.5);
    for (const step of S.script) {
      if (typeof step === 'function') { await step(); continue; }
      const [t, s] = step;
      ui.caption(t, s - 0.3); await game.wait(s);
    }
    await game.fade(0, 2.0);
    ui.title(`KRYSTAL PAMĚTI  ${n} / 3`, 3, S.name);
    sound.play('crystal', { vol: 0.6, rate: 0.5 });
    await game.wait(3.2);
    game.state.flags['escape' + n] = true;
    game.lock--;
    game.fadeV = 0;
    await game.loadRoom(LEVEL_ROOM[n], 'pedestal', { fade: false });
    await game.fade(1, 0.3);
  };
  return R;
}

function silence(game, extra) {
  return async () => { sound.ambient(null, 0, 0.05); extra?.(); await game.wait(3.0); };
}

function memoryGranny(R, game) {
  R.env = {
    fog: 0x1a120a, near: 3, far: 9, ambient: [0.42, 0.32, 0.24], sun: [0.5, 0.3, 0.15], sunDir: [-0.6, -0.4, 0.3],
    lights: [{ pos: [1.6, 1.0, 1.7], color: 0x8090ff, range: 3.5, intensity: 0.8 }, { pos: [-2.8, 2.0, 0], color: 0xff9040, range: 5 }],
    sound: 'ambMemory', soundVol: 0.6,
  };
  room(R, 'wallpaper', 'carpet');
  R.add(card(1.2, 1.0, M('window', { emissive: 0.9 })), -2.78, 1.5, 0.2, Math.PI / 2);
  R.add(props.armchair(), -0.8, 0, 1.2, Math.PI * 0.85);
  R.add(makeGranny(), -0.8, 0.05, 1.05, Math.PI * 0.85);
  const tv = props.tv(); R.add(tv, 1.7, 0, 1.7, -Math.PI * 0.62);
  R.add(props.clock(0.3), 0.6, 1.9, 2.95, Math.PI);
  R.add(props.table(0.8, 0.6, 0.5), 0.4, 0, 1.6);
  R.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 6), M('white', { tint: 0xd0c8b8 })), 0.3, 0.6, 1.6);
  return {
    name: 'vzpomínka: babička', cam: [1.8, 1.6, -2.2], look: [-0.6, 0.9, 1.0],
    script: [
      ['Babička usnula v křesle.', 3.5],
      ['V televizi běží jen šum.', 3.5],
      ['Venku je ještě světlo. Je 16:47.', 3.5],
      ['V domě je takové ticho, že jsou slyšet hodiny.', 4.5],
      silence(game, () => tv.userData.screen.material.uniforms.uUvScroll.value.set(0, 0)),
      ['Pak už nejsou slyšet ani hodiny.', 4.5],
    ],
  };
}

function memoryBedroom(R, game) {
  const lamp = { pos: [1.4, 0.9, 1.6], color: 0xffc080, range: 4.5, intensity: 1.3 };
  R.env = {
    fog: 0x04050c, near: 2, far: 8, ambient: [0.1, 0.12, 0.2], sun: [0, 0, 0],
    lights: [lamp, { pos: [-2.5, 2, -1], color: 0x2040a0, range: 4, intensity: 0.6 }],
    sound: 'ambMemory', soundVol: 0.4,
  };
  room(R, 'wallpaper', 'carpet', 0x5a6a9a);
  R.add(card(1.0, 1.0, M('window', { tint: 0x203060 })), -2.78, 1.6, -1, Math.PI / 2);
  R.add(props.bed(), -0.6, 0, 1.0);
  const lampObj = new THREE.Group();
  lampObj.add(worldBox(0.4, 0.5, 0.4, M('wood'), 1)).children[0].position.y = 0.25;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), M('white', { emissive: 1, tint: 0xffd090 })); bulb.position.y = 0.65; lampObj.add(bulb);
  R.add(lampObj, 1.4, 0, 1.6);
  const wd = props.wardrobe(); R.add(wd, 2.3, 0, -1.2, -Math.PI / 2);
  R.add(card(0.7, 0.7, M('drawing2')), 0.2, 1.5, 2.95, Math.PI);
  R.add(props.clock(0.25), -1.6, 2.0, 2.95, Math.PI);
  return {
    name: 'vzpomínka: tma', cam: [1.9, 1.7, -2.3], look: [-0.5, 0.5, 1.0],
    script: [
      ['Tomáš leží v posteli a dívá se na lampičku.', 3.8],
      ['Máma slíbila, že se vrátí, než usne.', 3.8],
      ['Lampička zabliká.', 2.5],
      async () => { for (let i = 0; i < 5; i++) { setLights(i % 2 ? R.env.lights : [R.env.lights[1]]); bulb.visible = i % 2 === 1; sound.play('click', { vol: 0.2 }); await game.wait(0.15 + Math.random() * 0.2); } },
      silence(game, () => { setLights([]); bulb.visible = false; }),
      ['Pod postelí je tma hlubší než voda v bazénu.', 4.2],
      ['Tomáš nedýchá, aby ho tma neslyšela.', 4.5],
    ],
  };
}

function memorySchool(R, game) {
  R.env = {
    fog: 0x141008, near: 3, far: 11, ambient: [0.3, 0.28, 0.22], sun: [0.6, 0.35, 0.15], sunDir: [0.5, -0.3, 0.6],
    lights: [{ pos: [0, 2.6, 0], color: 0xfff0d0, range: 6, intensity: 0.7 }],
    sound: 'ambSchool', soundVol: 0.4,
  };
  room(R, 'schoolWall', 'linoleum');
  const hooks = props.coatHooks(7); R.add(hooks, -0.5, 0, 2.95, Math.PI);
  const coat = makeCoat(); coat.scale.setScalar(0.5); R.add(coat, 0.75, 0.45, 2.7, Math.PI); // poslední kabát na věšáku
  R.add(props.pew(2.2), 0.2, 0, 0.4, Math.PI);
  // malý kluk na lavičce – vypadá skoro jako Wren
  const kid = makeWren(); const kp = kid.userData.parts;
  kp.legL.rotation.x = kp.legR.rotation.x = -Math.PI / 2; kp.legL.position.y = kp.legR.position.y = 0.45; kp.hips.position.y = 0.45;
  kp.headPivot.rotation.x = 0.4;
  kid.scale.setScalar(0.62); R.add(kid, 0.2, 0.05, 0.35, Math.PI);
  const teacher = makeTeacher(); R.add(teacher, -2.0, 0, -1.6, Math.PI * 0.3);
  teacher.userData.setFaceless(true);
  R.add(card(1.0, 2.0, M('door')), 2.95, 1.0, -1.5, -Math.PI / 2);
  R.add(card(0.6, 0.6, M('window', { emissive: 0.8 })), 2.94, 1.7, -1.5, -Math.PI / 2);
  R.add(props.clock(0.3), -1.5, 2.3, 2.95, Math.PI);
  return {
    name: 'vzpomínka: nikdo nepřišel', cam: [2.2, 1.6, -2.5], look: [-0.4, 0.9, 1.0],
    script: [
      ['Všechny děti už vyzvedli.', 3.5],
      ['Paní učitelka se dívá na hodinky. Pak na Tomáše. Pak zase na hodinky.', 4.5],
      ['Na věšáku zůstal jen jeden kabát.', 3.8],
      ['Je 16:47.', 3],
      silence(game),
      ['Nikdo nepřišel.', 4.5],
    ],
  };
}

function room(R, wallTex, floorTex, tint = 0xffffff) {
  R.floor(-3, -3, 3, 3, M(floorTex), 3);
  R.ceiling(-3, -3, 3, 3, 2.6, M(wallTex, { tint: 0x908070 }), 1.5);
  const wp = M(wallTex, { tint });
  R.wall(-3, 3, 3, 3, 2.6, wp, { tile: 1.3 }); R.wall(-3, -3, -3, 3, 2.6, wp, { tile: 1.3 });
  R.wall(3, -3, 3, 3, 2.6, wp, { tile: 1.3 }); R.wall(-3, -3, 3, -3, 2.6, wp, { tile: 1.3 });
}
