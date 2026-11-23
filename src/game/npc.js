// NPC: opakují jednu větu, občas se zaseknou v T-pose a sledují hráče.
import { animate } from '../assets/models.js';
import { sound } from '../engine/audio.js';

const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));

/** Detailní záběr na obličej NPC během rozhovoru. Vrací funkci pro návrat kamery. */
export function closeup(R, obj, dist = 1.2, headY = 1.55) {
  const game = R.game, prev = R.cameraOverride;
  game.player.visible = false;
  R.cameraOverride = (cam) => {
    const a = obj.rotation.y, p = obj.position;
    cam.position.set(p.x + Math.sin(a) * dist + Math.cos(a) * 0.25, p.y + headY + 0.05, p.z + Math.cos(a) * dist - Math.sin(a) * 0.25);
    cam.lookAt(p.x, p.y + headY - 0.05, p.z);
    if (cam.fov !== 42) { cam.fov = 42; cam.updateProjectionMatrix(); }
  };
  return () => { R.cameraOverride = prev; game.camCurrent = null; game.player.visible = true; };
}

export function addNPC(R, obj, x, z, ang, o) {
  const game = R.game;
  R.add(obj, x, o.y ?? 0, z, ang);
  obj.userData.seed = Math.random() * 10;
  const st = { tposeT: 0, next: o.tpose ? 6 + Math.random() * 18 : Infinity, base: ang, obj, opts: o, hum: null };
  if (o.solid !== false) R.collider(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  R.interact(o.at ?? [x, z], o.label ?? 'Mluvit', async () => {
    if (st.tposeT > 0) { await game.ui.say(o.name, '. . .', { silent: true }); return; }
    const line = typeof o.line === 'function' ? o.line() : o.line;
    const back = o.closeup ? closeup(R, obj, o.closeup, o.headY) : null;
    await game.ui.say(o.name, line, { silent: o.silent, glitch: o.glitch });
    back?.();
  }, { radius: o.radius ?? 1.7, cond: o.cond });
  R.npcs.push(st);
  let first = true;
  R.every((dt, t) => {
    // obličej podle stavu save systému (změna uprostřed hry = záblesk)
    const want = !!o.faceless?.();
    if (obj.userData.setFaceless && !!obj.userData.faceless !== want) {
      obj.userData.setFaceless(want);
      if (!first) { game.tear(0.4, 1); game.glitch.flash = 0.4; }
    }
    first = false;
    if (o.active && !o.active()) return;
    const p = game.player.pos;
    const toP = Math.atan2(p.x - x, p.z - z);
    if (o.tpose && !game.ui.modal) {
      st.next -= dt;
      if (st.next < 0 && st.tposeT <= 0) { st.tposeT = 3 + Math.random() * 5; sound.play('glitch', { vol: 0.12, rate: 0.5 }); }
      if (st.tposeT > 0) { st.tposeT -= dt; if (st.tposeT <= 0) st.next = 14 + Math.random() * 26; }
    }
    if (o.forceT?.()) st.tposeT = Math.max(st.tposeT, 0.1);
    const tp = st.tposeT > 0;
    obj.userData.tpose = tp ? 1 : 0;
    obj.userData.work = !tp && !!(typeof o.work === 'function' ? o.work() : o.work);
    obj.rotation.y = tp || o.face?.() ? toP : st.base;
    const parts = obj.userData.parts;
    if (parts) {
      if (o.headTrack && !tp && !o.face?.()) parts.headPivot.rotation.y = Math.max(-1.1, Math.min(1.1, wrapA(toP - st.base)));
      else parts.headPivot.rotation.y = 0;
      if (tp) { animate(obj, 0, 0, 0); parts.hips.position.y = parts.legL.position.y; }
      else animate(obj, dt, 0, t);
    }
  });
  return st;
}
