// Low-poly modely generované kódem. Postavy jsou hierarchie kvádrů (PS1 styl, bez skinningu).
import * as THREE from '../../lib/three.module.js';
import { ps1Mat } from '../engine/ps1.js';

let T = null;
export function setTextures(t) { T = t; }
export function tex() { return T; }

/** Materiál podle jména textury. */
export function M(name, opts = {}) { return ps1Mat(T[name], opts); }

/** Kvádr s UV podle světových rozměrů (textura se opakuje každých `tile` jednotek) a dělením kvůli afinnímu warpu. */
export function worldBox(w, h, d, mat, tile = 2, maxSeg = 2) {
  const seg = v => Math.max(1, Math.min(Math.ceil(v / maxSeg), 12));
  const geo = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + w / 2, y = p.getY(i) + h / 2, z = p.getZ(i) + d / 2;
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, x / tile, z / tile);
    else if (ax > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return new THREE.Mesh(geo, mat);
}

export function floorPlane(w, d, mat, tile = 2) {
  const geo = new THREE.PlaneGeometry(w, d, Math.ceil(w / 1.5), Math.ceil(d / 1.5));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / tile, (p.getZ(i) + d / 2) / tile);
  return new THREE.Mesh(geo, mat);
}

/** Svislý obdélník (cedule, obrázek) – textura přes celou plochu. */
export function card(w, h, mat) {
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

// ------------------------------------------------------------------ postavy
/**
 * Humanoid: kořen u nohou, dívá se do +Z.
 * parts: { face, hair, skin, body, arms, legs, height, width, headShape, hat }
 */
export function humanoid(o) {
  const root = new THREE.Group();
  const H = o.height ?? 1.7, W = o.width ?? 1;
  const legLen = H * 0.45, torsoLen = H * 0.33, headS = H * 0.14;
  const skin = o.skin ?? M('faceWren');
  const hips = new THREE.Group(); hips.position.y = legLen; root.add(hips);
  const torso = box(0.46 * W, torsoLen, 0.26 * W, o.body, 0, torsoLen / 2, 0);
  hips.add(torso);
  if (o.belly) hips.add(box(0.5 * W, torsoLen * 0.5, 0.36 * W, o.body, 0, torsoLen * 0.3, 0.04));
  const headPivot = new THREE.Group(); headPivot.position.y = torsoLen; hips.add(headPivot);
  let head;
  if (o.headShape === 'sphere') {
    head = new THREE.Mesh(new THREE.SphereGeometry(headS * 1.15, 6, 4), o.face);
    head.position.y = headS * 1.1;
  } else {
    const side = o.hair ?? skin;
    const mats = [side, side, o.hair ?? skin, skin, o.face, o.hair ?? skin];
    head = new THREE.Mesh(new THREE.BoxGeometry(headS * 1.6, headS * 2, headS * 1.6), mats);
    head.position.y = headS * 1.05;
  }
  headPivot.add(head);
  const arm = (side) => {
    const p = new THREE.Group();
    p.position.set(side * (0.25 * W + 0.06), torsoLen - 0.05, 0);
    const a = box(0.12, torsoLen * 1.05, 0.12, o.arms ?? o.body, 0, -torsoLen * 0.5, 0);
    p.add(a);
    p.add(box(0.1, 0.1, 0.1, skin, 0, -torsoLen * 1.05, 0));
    hips.add(p);
    return p;
  };
  const leg = (side) => {
    const p = new THREE.Group();
    p.position.set(side * 0.12 * W, legLen, 0);
    p.add(box(0.15 * W, legLen, 0.16, o.legs ?? o.body, 0, -legLen / 2, 0));
    p.add(box(0.16 * W, 0.08, 0.24, o.feet ?? M('black', { tint: 0x553322 }), 0, -legLen + 0.04, 0.04));
    root.add(p);
    return p;
  };
  const parts = { hips, torso, headPivot, head, armL: arm(1), armR: arm(-1), legL: leg(1), legR: leg(-1) };
  if (o.robe) { // dlouhý plášť přes nohy
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * W, 0.42 * W, legLen + 0.1, 6), o.robe);
    r.position.y = legLen / 2; root.add(r);
  }
  if (o.hat) headPivot.add(o.hat(headS, head));
  // stín pod postavou
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * W, 0.9 * W), M('blob', { opacity: 0.9 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
  root.add(shadow);
  root.userData = { parts, phase: 0, tpose: 0, H, kind: o.kind };
  // každá postava může přijít o obličej (save systém)
  const orig = Array.isArray(head.material) ? head.material[4] : head.material;
  root.userData.setFaceless = (on) => {
    const f = on ? M('faceless', o.headShape === 'sphere' ? { uv: [2, 1.15] } : {}) : orig;
    if (Array.isArray(head.material)) head.material[4] = f; else head.material = f;
    root.userData.faceless = on;
  };
  return root;
}

/** Procedurální animace: chůze, idle dýchání, T-pose. */
export function animate(ch, dt, speed = 0, t = 0) {
  const u = ch.userData, p = u.parts;
  if (!p) return;
  u.phase += dt * speed * 5.5;
  const sw = Math.sin(u.phase) * Math.min(1, speed) * 0.7;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  const breathe = Math.sin(t * 1.7 + (u.seed ?? 0)) * 0.02;
  p.hips.position.y = p.legL.position.y + Math.abs(Math.cos(u.phase)) * 0.04 * Math.min(1, speed) + breathe * 0.3;
  const tp = u.tpose;
  p.armL.rotation.x = -sw * (1 - tp); p.armR.rotation.x = sw * (1 - tp);
  p.armL.rotation.z = THREE.MathUtils.lerp(0.06, Math.PI / 2, tp);
  p.armR.rotation.z = THREE.MathUtils.lerp(-0.06, -Math.PI / 2, tp);
  if (u.work) { // hnětení / pečení
    p.armL.rotation.x = -0.9 + Math.sin(t * 5) * 0.25;
    p.armR.rotation.x = -0.9 + Math.sin(t * 5 + 1.5) * 0.25;
  }
}

export function makeWren() {
  return humanoid({
    kind: 'wren', height: 1.65,
    face: M('faceWren'), skin: M('faceWren'), hair: M('hairBrown'),
    body: M('cloth', { tint: 0x6a7a3a }), arms: M('cloth', { tint: 0x5a4a30 }), legs: M('cloth', { tint: 0x4a3a2a }),
    hat: (s) => box(s * 1.7, s * 0.5, s * 1.7, M('hairBrown'), 0, s * 2.1, -0.02),
  });
}

export function makeKing() {
  const k = humanoid({
    kind: 'king', height: 1.95, width: 1.25, headShape: 'sphere', belly: true,
    // špatně namapovaná textura: obličej opakovaný 2× kolem hlavy a posunutý
    face: M('faceKing', { uv: [2, 1.15] }),
    skin: M('faceKing', { uv: [0.2, 0.2] }),
    body: M('cloth', { tint: 0x7a1020 }), arms: M('cloth', { tint: 0x6a0c18 }),
    robe: M('cloth', { tint: 0x5a0a14 }), legs: M('cloth', { tint: 0x3a0a10 }),
    hat: (s) => {
      const g = new THREE.Group();
      const gold = M('gold');
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.05, s * 1.15, s * 0.5, 7, 1, true), gold);
      ring.material.side = THREE.DoubleSide;
      ring.position.y = s * 2.1; g.add(ring);
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.18, s * 0.6, 4), gold);
        c.position.set(Math.sin(a) * s * 1.05, s * 2.6, Math.cos(a) * s * 1.05); g.add(c);
      }
      return g;
    },
  });
  k.userData.parts.head.rotation.y = 0.9; // obličej "ujel" do strany
  return k;
}

export function makeBaker() {
  const faceMat = M('faceBaker');
  const b = humanoid({
    kind: 'baker', height: 1.75, width: 1.3, belly: true,
    face: faceMat, skin: M('faceBaker', { uv: [0.15, 0.15] }), hair: M('cloth', { tint: 0xf0f0f0 }),
    body: M('apron'), arms: M('cloth', { tint: 0xe8e0d0 }), legs: M('cloth', { tint: 0x504030 }),
    hat: (s) => {
      const g = new THREE.Group();
      const m = M('apron');
      const c = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.95, s * 0.8, s * 1.4, 6), m);
      c.position.y = s * 2.6; g.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.2, s * 1.1, s * 0.5, 6), m);
      t.position.y = s * 3.4; g.add(t);
      return g;
    },
  });
  void faceMat;
  return b;
}

export function makeGuard(seed = 0) {
  const metal = M('metal');
  const g = humanoid({
    kind: 'guard', height: 1.85,
    face: M('faceGuard'), skin: M('faceGuard', { uv: [0.2, 0.2] }), hair: metal,
    body: metal, arms: M('metal', { tint: 0xb0b0b8 }), legs: M('cloth', { tint: 0x3a3a50 }),
    hat: (s) => {
      const h = new THREE.Group();
      h.add(box(s * 1.8, s * 0.6, s * 1.8, metal, 0, s * 2.15, 0));
      const plume = box(s * 0.25, s * 0.8, s * 1.2, M('cloth', { tint: 0x902020 }), 0, s * 2.7, 0);
      h.add(plume);
      return h;
    },
  });
  // kopí v pravé ruce
  const spear = new THREE.Group();
  spear.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), M('wood')));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), metal); tip.position.y = 1.3; spear.add(tip);
  spear.position.set(0, -0.55, 0.08);
  g.userData.parts.armR.add(spear);
  g.userData.seed = seed;
  return g;
}

export function makeGranny() {
  const g = humanoid({
    kind: 'granny', height: 1.5, width: 1.1,
    face: M('faceGranny'), skin: M('faceGranny', { uv: [0.2, 0.2] }), hair: M('hairGrey'),
    body: M('cloth', { tint: 0x5a6a8a }), legs: M('cloth', { tint: 0x40404a }),
    hat: (s) => box(s * 0.9, s * 0.9, s * 0.9, M('hairGrey'), 0, s * 2.1, -s * 0.6),
  });
  const p = g.userData.parts;
  // sedí v křesle
  p.legL.rotation.x = p.legR.rotation.x = -Math.PI / 2;
  p.legL.position.y = p.legR.position.y = 0.45;
  p.hips.position.y = 0.45;
  p.headPivot.rotation.x = 0.35; p.headPivot.rotation.z = 0.15; // spí s hlavou na stranu
  g.userData.parts = null; // statická
  return g;
}

/** Kabát: dlouhý prázdný kabát na ramínku, bez hlavy. Pronásledovatel ve zbrojnici. */
export function makeCoat() {
  const root = new THREE.Group();
  const m = M('coat', { tint: 0x8a8098 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 1.6, 6), m);
  body.position.y = 1.0; root.add(body);
  const shoulders = box(0.95, 0.18, 0.4, m, 0, 1.82, 0); root.add(shoulders);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 6, 1, true), M('black'));
  collar.material.side = THREE.DoubleSide;
  collar.position.y = 1.98; root.add(collar);
  const sl = (s) => { const g = new THREE.Group(); g.position.set(s * 0.46, 1.8, 0); g.add(box(0.18, 1.0, 0.2, m, 0, -0.5, 0)); root.add(g); return g; };
  const armL = sl(1), armR = sl(-1);
  // ramínko
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 3, 6, Math.PI * 1.4), M('metal'));
  hook.position.y = 2.18; root.add(hook);
  const bar = box(0.8, 0.03, 0.03, M('wood'), 0, 2.0, 0); root.add(bar);
  root.userData = { armL, armR, kind: 'coat' };
  return root;
}

export function makeCrystal(blue = false) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), M(blue ? 'crystalBlue' : 'crystal', { emissive: 0.85 }));
  c.scale.y = 1.7; g.add(c);
  g.userData.spin = c;
  return g;
}

export function makeCrown() {
  const g = new THREE.Group();
  const gold = M('gold', { emissive: 0.3 });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.6, 9, 1, true), gold);
  ring.material.side = THREE.DoubleSide; g.add(ring);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 4), gold);
    c.position.set(Math.sin(a), 0.6, Math.cos(a)); g.add(c);
    if (i % 3 === 0) { // tři prázdná lůžka po krystalech
      const s = box(0.22, 0.22, 0.05, M('black'), Math.sin(a) * 1.07, 0, Math.cos(a) * 1.07);
      s.rotation.y = a; g.add(s);
    }
  }
  return g;
}

// ------------------------------------------------------------------ rekvizity
export const props = {
  table(w = 2, d = 1, h = 0.85, mat = M('wood')) {
    const g = new THREE.Group();
    const top = worldBox(w, 0.1, d, mat, 1); top.position.y = h; g.add(top);
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(box(0.1, h, 0.1, mat, x * (w / 2 - 0.1), h / 2, z * (d / 2 - 0.1)));
    return g;
  },
  counter(w = 2, d = 0.8, h = 0.95) {
    const g = new THREE.Group();
    const b = worldBox(w, h, d, M('wood', { tint: 0x9a8a70 }), 1); b.position.y = h / 2; g.add(b);
    const top = worldBox(w + 0.05, 0.06, d + 0.05, M('tilesWall'), 0.6); top.position.y = h + 0.03; g.add(top);
    return g;
  },
  stove() {
    const g = new THREE.Group();
    const b = worldBox(2.8, 0.9, 0.9, M('metal', { tint: 0x707070 }), 1); b.position.y = 0.45; g.add(b);
    const top = box(2.8, 0.05, 0.9, M('black'), 0, 0.92, 0); g.add(top);
    g.userData.burners = [-0.9, 0, 0.9].map((x) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 6), M('metal', { tint: 0x404040 }));
      ring.position.set(x, 0.96, 0); g.add(ring);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.5), M('flame', { emissive: 1, side: THREE.DoubleSide, scroll: [0, 0] }));
      f.position.set(x, 1.2, 0); g.add(f);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 6), M('metal', { tint: 0xd0c8b0 }));
      knob.rotation.x = Math.PI / 2; knob.position.set(x, 0.7, 0.48); g.add(knob);
      return { flame: f, knob, x };
    });
    return g;
  },
  oven() {
    const g = new THREE.Group();
    const b = worldBox(2.4, 2.2, 1.6, M('stone', { tint: 0xc0a090 }), 1.2); b.position.y = 1.1; g.add(b);
    const mouth = card(1.3, 1.0, M('oven', { uv: [0.6, 0.45] })); mouth.position.set(0, 0.85, 0.81); g.add(mouth);
    const glow = card(0.9, 0.55, M('white', { emissive: 1, tint: 0xff6020 })); glow.position.set(0, 0.7, 0.805); g.add(glow);
    const chimney = worldBox(0.6, 2.0, 0.6, M('stone'), 1); chimney.position.set(0, 3.2, -0.3); g.add(chimney);
    g.userData.glow = glow;
    return g;
  },
  rack(w = 2) {
    const g = new THREE.Group();
    const wood = M('wood');
    g.add(box(w, 0.1, 0.4, wood, 0, 0.1, 0)); g.add(box(w, 0.1, 0.4, wood, 0, 1.9, 0));
    g.add(box(0.1, 2, 0.4, wood, -w / 2, 1, 0)); g.add(box(0.1, 2, 0.4, wood, w / 2, 1, 0));
    const metal = M('metal');
    for (let i = 0; i < Math.floor(w / 0.35); i++) {
      const x = -w / 2 + 0.3 + i * 0.35;
      if (i % 3 === 1) { // naběračka místo meče
        g.add(box(0.04, 1.3, 0.04, metal, x, 1.1, 0.1));
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 4, 3), metal); s.position.set(x, 0.42, 0.1); g.add(s);
      } else {
        g.add(box(0.08, 1.4, 0.02, metal, x, 1.05, 0.1));
        g.add(box(0.25, 0.05, 0.05, M('gold'), x, 1.65, 0.1));
      }
    }
    return g;
  },
  armorStand() {
    const g = new THREE.Group();
    const m = M('metal', { tint: 0x9098a0 });
    g.add(box(0.5, 0.7, 0.3, m, 0, 1.35, 0));
    g.add(box(0.3, 0.3, 0.3, m, 0, 1.9, 0));
    // místo helmy hrnec
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.25, 6), M('metal', { tint: 0x6a5a4a }));
    pot.position.y = 2.15; g.add(pot);
    g.add(box(0.06, 1.0, 0.06, M('wood'), 0, 0.5, 0));
    g.add(box(0.5, 0.06, 0.5, M('wood'), 0, 0.03, 0));
    return g;
  },
  wardrobe() {
    const g = new THREE.Group();
    const b = worldBox(1.3, 2.3, 0.8, M('wood', { tint: 0x8a6a50 }), 1); b.position.y = 1.15; g.add(b);
    g.add(box(0.03, 2.1, 0.02, M('black'), 0, 1.15, 0.41));
    g.add(box(0.06, 0.1, 0.06, M('gold'), -0.1, 1.2, 0.43)); g.add(box(0.06, 0.1, 0.06, M('gold'), 0.1, 1.2, 0.43));
    // škvíry
    for (let i = 0; i < 4; i++) g.add(box(0.5, 0.03, 0.02, M('black'), -0.35, 1.7 + i * 0.1, 0.41));
    return g;
  },
  barrel() {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 7), M('wood', { uv: [2, 1] }));
    m.position.y = 0.45;
    const g = new THREE.Group(); g.add(m); return g;
  },
  chair(mat = M('wood')) {
    const g = new THREE.Group();
    g.add(box(0.5, 0.06, 0.5, mat, 0, 0.48, 0));
    g.add(box(0.5, 0.6, 0.06, mat, 0, 0.8, -0.22));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(box(0.05, 0.48, 0.05, mat, x * 0.2, 0.24, z * 0.2));
    return g;
  },
  throne() {
    const g = new THREE.Group();
    const red = M('cloth', { tint: 0x801828 }), gold = M('gold');
    g.add(box(1.6, 0.6, 1.2, gold, 0, 0.3, 0));
    g.add(box(1.4, 0.2, 1.0, red, 0, 0.7, 0.05));
    g.add(box(1.6, 2.4, 0.2, gold, 0, 1.6, -0.55));
    g.add(box(1.2, 1.9, 0.05, red, 0, 1.6, -0.43));
    g.add(box(0.2, 0.6, 1.0, gold, 0.75, 1.0, 0.05)); g.add(box(0.2, 0.6, 1.0, gold, -0.75, 1.0, 0.05));
    return g;
  },
  clock(r = 0.4) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 10), [M('wood'), M('clock'), M('wood')]);
    c.rotation.x = Math.PI / 2; g.add(c);
    // čelo válce má UV kruhu – víko je index 1
    return g;
  },
  pedestal(blue = false) {
    const g = new THREE.Group();
    const base = worldBox(0.7, 1.0, 0.7, M('stone', { tint: blue ? 0x8090b0 : 0xb090a0 }), 1); base.position.y = 0.5; g.add(base);
    const c = makeCrystal(blue); c.position.y = 1.45; g.add(c);
    g.userData.crystal = c;
    return g;
  },
  tree() {
    const g = new THREE.Group();
    g.add(box(0.3, 1.6, 0.3, M('wood'), 0, 0.8, 0));
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.1 - i * 0.3, 1.6, 5), M('cloth', { tint: 0x2a5a2a }));
      c.position.y = 2.0 + i * 0.9; g.add(c);
    }
    return g;
  },
  well() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.05, 0.8, 8, 1, true), M('stone', { uv: [3, 0.5] }));
    s.material.side = THREE.DoubleSide; s.position.y = 0.4; g.add(s);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.95, 8), M('black'));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.3; g.add(water);
    g.add(box(0.1, 1.8, 0.1, M('wood'), 0.9, 0.9, 0)); g.add(box(0.1, 1.8, 0.1, M('wood'), -0.9, 0.9, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.8, 4), M('wood')); roof.position.y = 2.1; roof.rotation.y = Math.PI / 4; g.add(roof);
    return g;
  },
  armchair() {
    const g = new THREE.Group(); const m = M('carpet', { tint: 0x9a7a5a });
    g.add(box(1.0, 0.45, 0.9, m, 0, 0.22, 0)); g.add(box(1.0, 1.0, 0.2, m, 0, 0.7, -0.4));
    g.add(box(0.18, 0.7, 0.9, m, 0.5, 0.45, 0)); g.add(box(0.18, 0.7, 0.9, m, -0.5, 0.45, 0));
    return g;
  },
  tv() {
    const g = new THREE.Group();
    g.add(box(0.9, 0.7, 0.6, M('wood', { tint: 0x604030 }), 0, 0.35 + 0.6, 0));
    const scr = card(0.65, 0.48, M('static', { emissive: 0.9, scroll: [3.1, 7.3] })); scr.position.set(0, 0.97, 0.31); g.add(scr);
    g.add(box(0.8, 0.6, 0.5, M('wood'), 0, 0.3, 0));
    g.userData.screen = scr;
    return g;
  },
};

/** Zvoník: utopený, v kápi, bez obličeje, se zvonkem. Kostel pod vodou. */
export function makeBellRinger() {
  const root = new THREE.Group();
  const robe = M('cloth', { tint: 0x2a3a40 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 1.9, 7), robe); body.position.y = 1.05; root.add(body);
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 6), robe); hood.position.y = 2.2; root.add(hood);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.17, 6), M('black')); face.position.set(0, 2.05, 0.2); root.add(face);
  const sl = (s) => { const g = new THREE.Group(); g.position.set(s * 0.32, 1.85, 0); g.add(box(0.16, 1.1, 0.18, robe, 0, -0.55, 0)); root.add(g); return g; };
  const armL = sl(1), armR = sl(-1);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 6, 1, true), M('gold')); bell.material.side = THREE.DoubleSide; bell.position.set(0, -1.15, 0.05); armR.add(bell);
  root.userData = { armL, armR, kind: 'ringer' };
  return root;
}

/** Učitelka: příliš vysoká, bez obličeje, s ručním zvonkem. Školní chodba. */
export function makeTeacher() {
  const t = humanoid({
    kind: 'teacher', height: 2.35, width: 0.85,
    face: M('faceless'), skin: M('faceless', { uv: [0.2, 0.2] }), hair: M('hairBrown'),
    body: M('cloth', { tint: 0x5a4a6a }), arms: M('cloth', { tint: 0x4a3a5a }), legs: M('cloth', { tint: 0x2a2a30 }),
    robe: M('cloth', { tint: 0x4a3a5a }),
    hat: (s) => box(s * 1.2, s * 0.8, s * 0.9, M('hairBrown'), 0, s * 2.0, -s * 0.5),
  });
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6, 1, true), M('gold')); bell.material.side = THREE.DoubleSide;
  bell.position.set(0, -0.85, 0.05); t.userData.parts.armR.add(bell);
  return t;
}

/** Ten, kdo čeká: obří loading bar zaseknutý na 99 %. */
export function makeLoadingBar(signTexFn) {
  const g = new THREE.Group();
  const frame = M('white', { emissive: 1, tint: 0xc8c8d8 });
  const W = 12, Hh = 1.6;
  g.add(box(W + 0.4, 0.2, 0.3, frame, 0, Hh / 2 + 0.1, 0)); g.add(box(W + 0.4, 0.2, 0.3, frame, 0, -Hh / 2 - 0.1, 0));
  g.add(box(0.2, Hh + 0.4, 0.3, frame, -W / 2 - 0.1, 0, 0)); g.add(box(0.2, Hh + 0.4, 0.3, frame, W / 2 + 0.1, 0, 0));
  const fill = box(W, Hh, 0.2, M('white', { emissive: 1, tint: 0xd0a030 }), 0, 0, 0);
  fill.scale.x = 0.99; fill.position.x = -W * 0.005; g.add(fill);
  const back = box(W, Hh, 0.1, M('black'), 0, 0, -0.1); g.add(back);
  // segmenty
  for (let i = 1; i < 20; i++) g.add(box(0.05, Hh, 0.25, M('black', { opacity: 0.6 }), -W / 2 + i * W / 20, 0, 0.02));
  const label = card(6, 1.2, ps1Mat(signTexFn('NAČÍTÁNÍ   99 %'), { emissive: 1 }));
  label.position.y = Hh + 1.1; g.add(label);
  g.userData = { fill, label, W };
  return g;
}

Object.assign(props, {
  pew(w = 3) {
    const g = new THREE.Group(); const m = M('wood', { tint: 0x7a6a5a });
    g.add(box(w, 0.08, 0.5, m, 0, 0.45, 0)); g.add(box(w, 0.7, 0.08, m, 0, 0.8, -0.22));
    g.add(box(0.08, 0.9, 0.55, m, -w / 2, 0.45, 0)); g.add(box(0.08, 0.9, 0.55, m, w / 2, 0.45, 0));
    return g;
  },
  bell(plateTex) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, 0.8, 8, 1, true), M('gold', { tint: 0x8a7a50 }));
    b.material.side = THREE.DoubleSide; b.position.y = 0; g.add(b);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), M('gold', { tint: 0x8a7a50 })); top.position.y = 0.4; g.add(top);
    g.add(box(0.04, 3, 0.04, M('wood'), 0, 1.9, 0));
    const clap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 3), M('metal')); clap.position.y = -0.35; g.add(clap);
    const rope = box(0.03, 1.6, 0.03, M('cloth', { tint: 0xb09060 }), 0, -1.1, 0); g.add(rope);
    if (plateTex) { const pl = card(0.5, 0.35, ps1Mat(plateTex)); pl.position.set(0, -0.2, 0.56); g.add(pl); }
    g.userData.bell = b;
    return g;
  },
  confessional() {
    const g = new THREE.Group(); const m = M('wood', { tint: 0x5a4030 });
    const b = worldBox(1.4, 2.6, 1.1, m, 1); b.position.y = 1.3; g.add(b);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.6, 4), m); roof.rotation.y = Math.PI / 4; roof.position.y = 2.9; g.add(roof);
    g.add(box(0.9, 1.9, 0.02, M('cloth', { tint: 0x5a1020 }), 0, 1.1, 0.56));
    for (let i = 0; i < 5; i++) g.add(box(0.7, 0.03, 0.03, M('black'), 0, 1.6 + i * 0.08, 0.58));
    return g;
  },
  locker(open = false) {
    const g = new THREE.Group();
    const b = worldBox(0.6, 2.0, 0.55, M('locker', { uv: [1, 1] }), 2); b.position.y = 1.0; g.add(b);
    const d = card(0.56, 1.9, M('locker')); d.position.set(0, 1.0, 0.28); g.add(d);
    if (open) { d.rotation.y = -1.2; d.position.x = 0.38; d.position.z = 0.5; }
    g.userData.door = d;
    return g;
  },
  desk() {
    const g = new THREE.Group(); const m = M('wood', { tint: 0xa08060 });
    g.add(box(1.0, 0.06, 0.6, m, 0, 0.72, 0));
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.add(box(0.05, 0.72, 0.05, M('metal'), x * 0.45, 0.36, z * 0.25));
    const ch = props.chair(M('wood', { tint: 0x8a6a4a })); ch.position.z = -0.55; ch.scale.setScalar(0.85); g.add(ch);
    return g;
  },
  bed() {
    const g = new THREE.Group();
    g.add(box(1.0, 0.4, 2.0, M('wood'), 0, 0.2, 0));
    g.add(box(0.95, 0.2, 1.9, M('cloth', { tint: 0x4a5a8a }), 0, 0.5, 0.02));
    g.add(box(0.6, 0.15, 0.35, M('cloth', { tint: 0xe0e0d0 }), 0, 0.65, -0.75));
    g.add(box(1.0, 0.8, 0.08, M('wood'), 0, 0.4, -1.0));
    const under = box(0.9, 0.3, 1.8, M('black'), 0, 0.15, 0.02); g.add(under);
    return g;
  },
  coatHooks(n = 6) {
    const g = new THREE.Group();
    g.add(box(n * 0.5, 0.12, 0.06, M('wood'), 0, 1.7, 0));
    for (let i = 0; i < n; i++) g.add(box(0.04, 0.12, 0.15, M('metal'), -n * 0.25 + 0.25 + i * 0.5, 1.62, 0.08));
    return g;
  },
});
