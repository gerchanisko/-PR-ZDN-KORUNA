// Místnost: scéna, kolize (AABB v rovině XZ), interakce, triggery, fixní/poloviční kamery, prostředí.
import * as THREE from '../../lib/three.module.js';
import { M, worldBox, floorPlane } from '../assets/models.js';

export class Room {
  constructor(game, name) {
    this.game = game; this.name = name;
    this.scene = new THREE.Scene();
    this.colliders = []; this.interactables = []; this.triggers = []; this.cameras = [];
    this.updaters = []; this.spawns = {}; this.billboards = []; this.npcs = [];
    this.restarts = []; this.leaves = [];
    this.onRestart = () => this.restarts.forEach(f => f());
    this.onLeave = () => this.leaves.forEach(f => f());
    this.env = { fog: 0x0c0a0e, near: 4, far: 20, ambient: [0.25, 0.22, 0.22], sun: [0, 0, 0], sunDir: [0.4, -0.6, 0.5], lights: [], sound: null, soundVol: 0.5 };
  }
  add(o, x = 0, y = 0, z = 0, ry = 0) { o.position.set(x, y, z); o.rotation.y = ry; this.scene.add(o); return o; }
  collider(x0, z0, x1, z1, tag) { const c = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), tag }; this.colliders.push(c); return c; }
  /** Pevný objekt – kolize podle jeho bounding boxu. */
  solid(o, pad = 0) {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    return this.collider(b.min.x - pad, b.min.z - pad, b.max.x + pad, b.max.z + pad);
  }
  /** Zeď z bodu do bodu (osově zarovnaná). */
  wall(x0, z0, x1, z1, h, mat, { tile = 2, thick = 0.4, collide = true } = {}) {
    const w = Math.abs(x1 - x0) || thick, d = Math.abs(z1 - z0) || thick;
    const m = worldBox(w, h, d, mat, tile);
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    this.scene.add(m);
    if (collide) this.collider((x0 + x1) / 2 - w / 2, (z0 + z1) / 2 - d / 2, (x0 + x1) / 2 + w / 2, (z0 + z1) / 2 + d / 2);
    return m;
  }
  floor(x0, z0, x1, z1, mat, tile = 2, y = 0) {
    const f = floorPlane(x1 - x0, z1 - z0, mat, tile);
    f.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    this.scene.add(f); return f;
  }
  ceiling(x0, z0, x1, z1, h, mat, tile = 2) {
    const f = this.floor(x0, z0, x1, z1, mat, tile, h);
    f.rotation.x = Math.PI; return f;
  }
  /** Interakce: pos [x,z], label, fn, opts {radius, cond, facing} */
  interact(pos, label, fn, opts = {}) {
    const it = { pos, label, fn, radius: opts.radius ?? 1.4, cond: opts.cond, id: opts.id };
    this.interactables.push(it); return it;
  }
  trigger(zone, fn, { once = true, id } = {}) { const t = { zone, fn, once, done: false, id }; this.triggers.push(t); return t; }
  /** Kamera: zone [x0,z0,x1,z1], pos [x,y,z], look: [x,y,z] | 'track' */
  cam(zone, pos, look = 'track', fov = 55) { this.cameras.push({ zone, pos: new THREE.Vector3(...pos), look: look === 'track' ? look : new THREE.Vector3(...look), fov }); }
  billboard(o) { this.billboards.push(o); return o; }
  every(fn) { this.updaters.push(fn); }
  update(dt, t) { for (const u of this.updaters) u(dt, t); }
}

export const inZone = (z, x, y) => x >= Math.min(z[0], z[2]) && x <= Math.max(z[0], z[2]) && y >= Math.min(z[1], z[3]) && y <= Math.max(z[1], z[3]);

/** Posune kruh (x,z,r) ven z kolizí. */
export function collide(colliders, p, r) {
  for (let iter = 0; iter < 3; iter++) {
    for (const c of colliders) {
      if (c.off) continue;
      const cx = Math.max(c.x0, Math.min(p.x, c.x1)), cz = Math.max(c.z0, Math.min(p.z, c.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { // střed uvnitř – vytlač nejkratší cestou
          const opts = [[c.x0 - r - p.x, 0], [c.x1 + r - p.x, 0], [0, c.z0 - r - p.z], [0, c.z1 + r - p.z]];
          opts.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
  }
}

/** Přímá viditelnost v 2D (úsečka vs AABB). */
export function lineOfSight(colliders, ax, az, bx, bz) {
  for (const c of colliders) {
    if (c.off || c.seeThrough) continue;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
    if (clip(-dx, ax - c.x0) && clip(dx, c.x1 - ax) && clip(-dz, az - c.z0) && clip(dz, c.z1 - az) && t0 < t1) return false;
  }
  return true;
}

export { M };
