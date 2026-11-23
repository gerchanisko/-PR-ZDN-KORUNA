// Pronásledovatel (Kabát, Zvoník, Učitelka) a místa na schování. Společné pro všechny levely.
import * as THREE from '../../lib/three.module.js';
import { collide, lineOfSight } from './room.js';
import { animate } from '../assets/models.js';
import { sound } from '../engine/audio.js';
import { input } from '../engine/input.js';
import { W, H } from './ui.js';

const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * o: { obj, ring, start:[x,z], escape, sight (rad, 0 = slepý), range, speeds:{patrol,chase,search},
 *      captureSpawn, captureText, seenText, float, alarmSound, alarmEvery }
 */
export function addStalker(R, o) {
  const game = R.game, ui = game.ui;
  R.add(o.obj, ...o.start.slice(0, 1), 0, o.start[1]);
  const breath = sound.loop(o.breath ?? 'stalker', 0);
  const heart = sound.loop('heartbeat', 0);
  R.leaves.push(() => { breath.stop(); heart.stop(); });
  const sp = { patrol: 1.3, chase: 2.35, search: 1.1, ...o.speeds };
  const st = { mode: 'off', pos: new THREE.Vector3(), wp: 0, t: 0, lastSeen: null, lostT: 0, stuck: 0, alarmT: 2 };
  st.reset = () => {
    st.pos.set(o.start[0], 0, o.start[1]); st.wp = o.startWp ?? 1;
    st.mode = o.escape ? 'emerge' : (o.initialMode?.() ?? 'patrol'); st.t = o.escape ? (o.emergeTime ?? 2.6) : 0;
    st.lastSeen = null; st.lostT = 0; st.stuck = 0;
  };
  st.reset();
  /** Něco ho přilákalo (zvon, rána). */
  st.alert = (x, z) => { if (st.mode === 'off' || st.mode === 'emerge') return; st.mode = 'search'; st.lastSeen = new THREE.Vector3(x, 0, z); st.t = 4; };
  R.restarts.push(() => st.reset());
  R.stalker = st;

  R.every((dt, t) => {
    const P = game.player, obj = o.obj;
    obj.position.copy(st.pos);
    if (o.float) { obj.position.y = 0.15 + Math.sin(t * 1.3) * 0.06; obj.rotation.z = Math.sin(t * 2.1) * 0.05; }
    if (obj.userData.armL && !obj.userData.parts) { obj.userData.armL.rotation.x = Math.sin(t * 1.7) * 0.15; obj.userData.armR.rotation.x = Math.sin(t * 1.9 + 1) * 0.15; }
    obj.visible = st.mode !== 'off' && (st.mode !== 'emerge' || Math.random() < 0.5);
    if (st.mode === 'off') { breath.set(0); heart.set(0); return; }
    const dx = P.pos.x - st.pos.x, dz = P.pos.z - st.pos.z, dist = Math.hypot(dx, dz);
    breath.set(Math.max(0, 1 - dist / 11) * 0.9, 0.2);
    heart.set(st.mode === 'chase' ? 0.8 : dist < 4 ? 0.4 : 0, 0.3);
    heart.rate(st.mode === 'chase' ? 1.4 : 1);
    if (o.alarmSound && (st.alarmT -= dt) <= 0) { st.alarmT = o.alarmEvery ?? 4; sound.play(o.alarmSound, { vol: Math.max(0.05, 1 - dist / 18) * 0.7 }); }
    if ((game.ui.modal || game.lock) && !R.worstMoment) { if (obj.userData.parts) animate(obj, dt, 0, t); return; }
    if (st.mode === 'emerge') { st.t -= dt; if (st.t <= 0) { st.mode = 'chase'; sound.play('sting'); st.lastSeen = P.pos.clone(); } return; }

    const ang = Math.abs(wrapA(Math.atan2(dx, dz) - obj.rotation.y));
    const los = lineOfSight(R.colliders, st.pos.x, st.pos.z, P.pos.x, P.pos.z);
    const moving = Math.abs(P.speed) + Math.abs(P.strafe ?? 0);
    const hm = o.hearing ?? 1;
    const hearing = (moving > 2.5 ? 4.5 : moving > 0.3 ? 2.6 : o.sight === 0 ? 0 : 1.6) * hm;
    const sight = o.sight ?? 1.1, range = o.range ?? 7.5;
    const sees = !P.hidden && (dist < hearing && (los || o.sight === 0 && dist < hearing * 0.7) || (los && sight > 0 && dist < range && ang < sight) || (o.escape && los && dist < 14));

    let target = null, speed = sp.patrol;
    if (st.mode === 'patrol') {
      target = o.ring[st.wp];
      if (Math.hypot(target[0] - st.pos.x, target[1] - st.pos.z) < 0.3) st.wp = (st.wp + 1) % o.ring.length;
      if (sees) { st.mode = 'chase'; sound.play('sting', { vol: 0.8 }); if (o.seenText) ui.caption(o.seenText, 2); }
    }
    if (st.mode === 'chase') {
      if (sees) { st.lastSeen = P.pos.clone(); st.lostT = 0; } else st.lostT += dt;
      if (!st.lastSeen) st.lastSeen = P.pos.clone();
      target = [st.lastSeen.x, st.lastSeen.z]; speed = o.escape ? (sp.escape ?? 2.5) : sp.chase;
      if (P.hidden || st.lostT > 2.5) { st.mode = 'search'; st.t = 3.5; }
    }
    if (st.mode === 'search') {
      target = st.lastSeen ? [st.lastSeen.x, st.lastSeen.z] : o.ring[st.wp];
      speed = sp.search;
      if (Math.hypot(target[0] - st.pos.x, target[1] - st.pos.z) < 1.2) { target = null; st.t -= dt; }
      if (sees) st.mode = 'chase';
      else if (st.t <= 0) {
        st.mode = o.escape ? 'chase' : 'patrol';
        let bi = 0, bd = 1e9; o.ring.forEach(([x, z], i) => { const d2 = Math.hypot(x - st.pos.x, z - st.pos.z); if (d2 < bd) { bd = d2; bi = i; } }); st.wp = bi;
        if (o.escape) st.lastSeen = P.pos.clone();
      }
    }
    let moved = 0;
    if (target) {
      const tx = target[0] - st.pos.x, tz = target[1] - st.pos.z, td = Math.hypot(tx, tz);
      if (td > 0.05) {
        const bx = st.pos.x, bz = st.pos.z;
        st.pos.x += tx / td * speed * dt; st.pos.z += tz / td * speed * dt;
        collide(R.colliders, st.pos, 0.42);
        moved = Math.hypot(st.pos.x - bx, st.pos.z - bz);
        st.stuck = moved / Math.max(1e-4, speed * dt) < 0.3 ? st.stuck + dt : 0;
        if (st.stuck > 0.6) { st.pos.x += -tz / td * speed * dt; st.pos.z += tx / td * speed * dt; collide(R.colliders, st.pos, 0.42); }
        if (st.stuck > 2.5 && st.mode === 'patrol') { st.wp = (st.wp + 1) % o.ring.length; st.stuck = 0; }
        obj.rotation.y += wrapA(Math.atan2(tx, tz) - obj.rotation.y) * Math.min(1, dt * 5);
      }
    }
    if (obj.userData.parts) animate(obj, dt, moved / Math.max(dt, 1e-4) / 1.9, t);
    if (!P.hidden && dist < 0.8 && !game.lock) capture();
  });

  async function capture() {
    game.state.captures++;
    breath.set(0); heart.set(0);
    sound.play('sting');
    game.glitch.noise = 1;
    await game.roomRestart(typeof o.captureSpawn === 'function' ? o.captureSpawn() : o.captureSpawn ?? 'start', o.captureText);
  }
  return st;
}

/** Místa na schování. list: [[x, z, angle], ...]; kind: 'wardrobe' | 'locker' | 'confessional' */
export function addHideSpots(R, list, { kind = 'wardrobe', label = 'Schovat se', caption, model, front = 1.0 } = {}) {
  const game = R.game, ui = game.ui;
  list.forEach(([x, z, a]) => {
    if (model) { const m = model(); R.add(m, x, 0, z, a); R.solid(m); }
    R.interact([x + Math.sin(a) * front, z + Math.cos(a) * front], label, () => hide(x, z, a), { radius: 1.2 });
  });
  let info = null;
  const slats = {
    wardrobe: (g) => { g.fillRect(0, 0, W, 150); g.fillRect(0, 330, W, H - 330); for (let i = 0; i < 6; i++) g.fillRect(0, 162 + i * 30, W, 18); },
    locker: (g) => { g.fillRect(0, 0, W, H); g.clearRect(150, 170, 340, 0); for (let i = 0; i < 5; i++) g.clearRect(200, 190 + i * 22, 240, 7); },
    confessional: (g) => { g.fillRect(0, 0, W, H); for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) if ((x + y) % 2 === 0) g.clearRect(170 + x * 34, 120 + y * 34, 22, 22); },
  }[kind];
  function hide(x, z, a) {
    const P = game.player;
    sound.play('door', { vol: 0.5, rate: 1.4 });
    P.hidden = true; P.pos.set(x + Math.sin(a) * front, 0, z + Math.cos(a) * front); P.angle = a;
    info = { t: 0 };
    R.cameraOverride = (cam) => {
      cam.position.set(x + Math.sin(a) * 0.25, 1.55, z + Math.cos(a) * 0.25);
      cam.lookAt(x + Math.sin(a) * 5, 1.25, z + Math.cos(a) * 5);
      if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
    };
    ui.overlay = (g) => {
      g.fillStyle = '#000'; slats(g);
      g.fillStyle = 'rgba(200,190,170,0.7)'; g.font = '13px monospace'; g.fillText('[E] vylézt', 20, H - 20);
    };
    if (caption) ui.caption(caption, 3);
  }
  const unhide = () => { if (!info) return; info = null; game.player.hidden = false; R.cameraOverride = null; ui.overlay = null; game.camCurrent = null; };
  R.restarts.push(unhide);
  R.every((dt) => {
    if (!info) return;
    info.t += dt;
    if (info.t > 0.4 && input.hit('act') && !game.ui.modal && !game.lock) { input.consume('act'); sound.play('door', { vol: 0.5, rate: 1.6 }); unhide(); }
  });
}
