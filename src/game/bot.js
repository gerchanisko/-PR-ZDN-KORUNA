// Autopilot pro automatický playtest: řídí hru přes virtuální vstup (stejná cesta jako klávesnice).
import { input } from '../engine/input.js';
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
export class Bot {
  constructor(game) { this.game = game; this.task = null; }
  goto(x, z, { run = false, tol = 0.4, timeout = 25, back = false } = {}) { this.cancel(); return new Promise(res => { this.task = { type: 'goto', x, z, run, tol, t: timeout, res, back }; }); }
  face(x, z, { timeout = 6 } = {}) { this.cancel(); return new Promise(res => { this.task = { type: 'face', x, z, t: timeout, res }; }); }
  cancel() { if (this.task) { this.task.res(false); this.task = null; } }
  update(dt) {
    const v = input.virtual;
    v.up = v.down = v.left = v.right = v.run = false;
    const k = this.task; if (!k) return;
    if (this.game.mode !== 'play') { this.cancel(); return; }
    if (!this.game.canMove()) return;
    k.t -= dt;
    const p = this.game.player;
    const dx = k.x - p.pos.x, dz = k.z - p.pos.z, dist = Math.hypot(dx, dz);
    const diff = wrapA(Math.atan2(dx, dz) + (k.back ? Math.PI : 0) - p.angle);
    if ((k.type === 'goto' && dist < k.tol) || (k.type === 'face' && Math.abs(diff) < 0.06)) { this.task = null; k.res(true); return; }
    if (k.t < 0) { this.task = null; k.res(false); return; }
    if (diff > 0.05) v.left = true; else if (diff < -0.05) v.right = true;
    if (k.type === 'goto' && Math.abs(diff) < (dist < 1.5 ? 0.25 : 0.6)) { if (k.back) v.down = true; else { v.up = true; v.run = k.run; } }
  }
}
