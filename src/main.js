// PRÁZDNÁ KORUNA – demo. Hlavní smyčka, hráč (tank controls), kamery, glitche, přechody místností.
import * as THREE from '../lib/three.module.js';
import { PS1Renderer, shared, setLights } from './engine/ps1.js';
import { input } from './engine/input.js';
import { sound } from './engine/audio.js';
import { buildTextures } from './assets/textures.js';
import { setTextures, makeWren, animate, M } from './assets/models.js';
import { UI } from './game/ui.js';
import { collide, inZone } from './game/room.js';
import { buildHub } from './game/rooms/hub.js';
import { buildKitchen } from './game/rooms/kitchen.js';
import { buildArmory } from './game/rooms/armory.js';
import { buildMemory } from './game/rooms/memory.js';
import { buildChurch } from './game/rooms/church.js';
import { buildSchool } from './game/rooms/school.js';
import { buildBoss } from './game/rooms/boss.js';
import { Pause } from './game/flow.js';
import { buildMenuScene, runBoot } from './game/menu.js';
import { Inventory } from './game/inventory.js';
import { Bot } from './game/bot.js';

const loading = document.getElementById('loading');
const T = await buildTextures();
setTextures(T);

class Game {
  constructor() {
    this.r = new PS1Renderer(document.getElementById('view'));
    this.ui = new UI(document.getElementById('ui'));
    this.camera = new THREE.PerspectiveCamera(55, 4 / 3, 0.1, 80);
    this.state = { flags: { crown: 0 }, inv: [], kitchenLoop: 0, saves: 0, erased: [], captures: 0 };
    this.player = { obj: makeWren(), pos: new THREE.Vector3(), angle: 0, pitch: 0, speed: 0, strafe: 0, bob: 0, hidden: false, turnLeft: 0, stepAcc: 0, visible: true };
    this.lock = 0; this.paused = false; this.mode = 'boot';
    this.firstPerson = localStorage.getItem('pk-view') !== 'fixed';
    document.getElementById('ui').addEventListener('click', () => { if (this.firstPerson && this.mode === 'play') document.getElementById('ui').requestPointerLock?.(); });
    this.time = 0; this.timers = [];
    this.fadeV = 1; this.fadeTarget = 1; this.fadeSpeed = 2; this.fadeRes = null;
    this.glitch = { tear: 0, shift: 0, noise: 0, wobble: 0, flash: 0 };
    this.nextGlitch = 50;
    this.camCurrent = null; this.lookAt = new THREE.Vector3();
    this.rooms = { hub: buildHub, kitchen: buildKitchen, armory: buildArmory, memory: buildMemory, menu: buildMenuScene, church: buildChurch, school: buildSchool, boss: buildBoss };
    this.pause = new Pause(this);
    // jméno hráče pro secret konec: z lokálního serveru (OS uživatel), jinak záloha
    this.playerName = 'HRÁČ';
    fetch('/api/player').then(r => r.json()).then(j => { if (j && j.name) this.playerName = j.name; }).catch(() => {});
    this.inventory = new Inventory(this);
    this.bot = new Bot(this);
    this.last = performance.now();
    requestAnimationFrame(t => this.frame(t));
  }

  // ---------------------------------------------------------------- pomocné async
  nextFrame() { return this.wait(0); }
  wait(sec) { return new Promise(res => this.timers.push({ t: sec, res })); }
  fade(to, sec = 0.5) { this.fadeTarget = to; this.fadeSpeed = 1 / Math.max(0.01, sec); return new Promise(res => { this.fadeRes = res; }); }
  has(item) { return this.state.inv.includes(item); }
  give(item, label) { if (!this.has(item)) this.state.inv.push(item); sound.play('pickup'); this.ui.toast(`Získáno: ${label}`); }
  take(item) { this.state.inv = this.state.inv.filter(i => i !== item); }
  async locked(fn) { this.lock++; try { return await fn(); } finally { this.lock--; } }

  async loadRoom(name, spawn = 'start', { fade = true, fadeTime = 0.45 } = {}) {
    this.lock++;
    if (fade) await this.fade(0, fadeTime);
    this.room?.onLeave?.();
    this.ui.overlay = null;
    this.room = this.rooms[name](this);
    this.roomName = name;
    const e = this.room.env;
    shared.uFogColor.value.set(e.fog); shared.uFogNear.value = e.near; shared.uFogFar.value = e.far;
    shared.uAmbient.value.setRGB(...e.ambient); shared.uSunColor.value.setRGB(...(e.sun ?? [0, 0, 0]));
    shared.uSunDir.value.set(...(e.sunDir ?? [0.4, -0.6, 0.5])).normalize();
    setLights(e.lights);
    shared.uWave.value = e.wave ?? 0;
    shared.uBendAmt.value = e.bend ?? 0;
    if (e.bendPos) shared.uBendPos.value.set(...e.bendPos);
    sound.ambient(e.sound, e.soundVol, 1.2);
    if (!this.room.noPlayer) {
      this.room.scene.add(this.player.obj);
      this.spawn(spawn);
    }
    this.camCurrent = null;
    this.room.onEnter?.();
    this.lock--;
    if (fade) await this.fade(1, fadeTime);
  }
  spawn(name) {
    const s = this.room.spawns[name] ?? this.room.spawns.start;
    this.player.pos.set(s[0], 0, s[1]); this.player.angle = s[2] ?? 0;
    this.player.hidden = false; this.player.obj.visible = true; this.player.speed = 0;
    this.camCurrent = null;
  }

  // ---------------------------------------------------------------- glitche
  async freeze(sec = 0.6) {
    this.r.frozen = true; this.paused = true; sound.stutter(sec);
    await new Promise(r => setTimeout(r, sec * 1000));
    this.r.frozen = false; this.paused = false;
  }
  tear(sec = 0.4, amount = 1) { this.glitch.tear = Math.max(this.glitch.tear, amount); this.glitch.shift = 0.01 * amount; this.glitch.until = this.time + sec; }
  async roomRestart(spawn = 'start', silentText) {
    await this.locked(async () => {
      sound.play('glitch');
      await this.freeze(0.8);
      this.tear(0.6, 1.5);
      this.glitch.noise = 0.5;
      this.fadeV = 0;
      this.room.onRestart?.();
      this.spawn(spawn);
      await this.wait(0.35);
      this.ui.title('NAČÍTÁNÍ...', 1.2, silentText ?? '');
      await this.fade(1, 0.6);
    });
  }
  randomGlitch() {
    const r = Math.random();
    sound.play('glitch', { vol: 0.25, rate: 0.8 + Math.random() * 0.6 });
    if (r < 0.3) this.tear(0.25, 0.8);
    else if (r < 0.55) this.freeze(0.35 + Math.random() * 0.4);
    else if (r < 0.8) { // textura se na chvíli rozpadne na PLACEHOLDER
      const meshes = []; this.room.scene.traverse(o => { if (o.isMesh && o.material?.uniforms?.map && o !== this.player.obj) meshes.push(o); });
      const m = meshes[Math.floor(Math.random() * meshes.length)];
      if (m) { const old = m.material; m.material = M('placeholder', { uv: [2, 2] }); setTimeout(() => { m.material = old; }, 700); }
    } else { this.glitch.wobble = 1; }
  }

  // ---------------------------------------------------------------- hráč
  canMove() { return this.mode === 'play' && !this.lock && !this.ui.modal && !this.paused && !this.inventory.open && !this.pause.open && !this.player.hidden; }
  updatePlayer(dt) {
    const p = this.player;
    let fwd = 0, turn = 0, run = false, strafe = 0;
    const fp = this.firstPerson;
    const [mx, my] = input.mouse();
    if (this.canMove()) {
      const C = input.codes, V = input.virtual, P = input.pad;
      if (fp) {
        // první osoba: šipky/gamepad otáčí, A/D úkrok, myš rozhlíží
        if (C.ArrowLeft || V.left || P.left) turn += 1;
        if (C.ArrowRight || V.right || P.right) turn -= 1;
        if (C.KeyA) strafe += 1;
        if (C.KeyD) strafe -= 1;
        p.angle -= mx * 0.0028;
        p.pitch = Math.max(-1.0, Math.min(1.0, p.pitch - my * 0.0022));
      } else {
        if (input.down('left')) turn += 1;
        if (input.down('right')) turn -= 1;
      }
      if (input.down('up')) fwd = 1; else if (input.down('down')) fwd = -0.55;
      run = input.down('run') && fwd > 0;
      if (input.hit('turn') && p.turnLeft <= 0) p.turnLeft = Math.PI;
    }
    if (input.hit('view') && this.mode === 'play') {
      this.firstPerson = !this.firstPerson; this.camCurrent = null;
      localStorage.setItem('pk-view', this.firstPerson ? 'fp' : 'fixed');
      this.ui.toast(this.firstPerson ? 'POHLED: PRVNÍ OSOBA' : 'POHLED: FIXNÍ KAMERY', 1.5);
      if (!this.firstPerson) document.exitPointerLock?.();
    }
    if (!fp || !this.canMove()) p.pitch *= Math.max(0, 1 - dt * 3);
    if (p.turnLeft > 0) { const s = Math.min(p.turnLeft, dt * Math.PI * 3.5); p.angle += s; p.turnLeft -= s; turn = 0; }
    p.angle += turn * (fp ? 2.2 : 2.6) * dt;
    const mm = this.room.moveMul ?? 1;
    const target = fwd * (run ? 3.7 : 1.9) * mm;
    const k = Math.min(1, dt * 10);
    p.speed += (target - p.speed) * k;
    p.strafe += (strafe * 1.6 * mm - p.strafe) * k;
    const ox = p.pos.x, oz = p.pos.z;
    const sa = Math.sin(p.angle), ca = Math.cos(p.angle);
    p.pos.x += (sa * p.speed + ca * p.strafe) * dt;
    p.pos.z += (ca * p.speed - sa * p.strafe) * dt;
    collide(this.room.colliders, p.pos, 0.32);
    const moved = Math.hypot(p.pos.x - ox, p.pos.z - oz);
    p.stepAcc += moved; p.bob += moved * 5.2;
    if (p.stepAcc > (run ? 0.9 : 0.65)) { p.stepAcc = 0; sound.play('step', { vol: 0.35, rate: 0.8 + Math.random() * 0.3 }); }
    p.obj.position.copy(p.pos); p.obj.rotation.y = p.angle;
    animate(p.obj, dt, Math.abs(p.speed) / 1.9 * (p.speed < 0 ? 0.7 : 1), this.time);
    p.obj.visible = !p.hidden && p.visible && !(fp && !this.room.cameraOverride);

    // interakce
    this.ui.prompt = null; this.focus = null;
    if (this.canMove()) {
      let best = null, bd = 1e9;
      const fx = Math.sin(p.angle), fz = Math.cos(p.angle);
      for (const it of this.room.interactables) {
        if (it.cond && !it.cond()) continue;
        const dx = it.pos[0] - p.pos.x, dz = it.pos[1] - p.pos.z, d = Math.hypot(dx, dz);
        if (d > it.radius) continue;
        const facing = (dx * fx + dz * fz) / (d || 1);
        if (facing < 0.1 && d > 0.7) continue;
        const score = d - facing * 0.5;
        if (score < bd) { bd = score; best = it; }
      }
      if (best) {
        this.focus = best;
        this.ui.prompt = typeof best.label === 'function' ? best.label() : best.label;
        if (input.hit('act')) { input.consume('act'); this.locked(() => best.fn()); }
      }
      for (const t of this.room.triggers) {
        if (t.done || !inZone(t.zone, p.pos.x, p.pos.z)) continue;
        if (t.once) t.done = true;
        t.fn();
      }
    }
  }

  updateCamera(dt) {
    if (!this.room) return;
    if (this.room.cameraOverride) { this.room.cameraOverride(this.camera, dt); return; }
    if (this.firstPerson && !this.room.noPlayer) {
      const P = this.player, c = this.camera;
      if (c.fov !== 70) { c.fov = 70; c.updateProjectionMatrix(); }
      c.position.set(P.pos.x, 1.55 + Math.sin(P.bob) * 0.035, P.pos.z);
      const cp = Math.cos(P.pitch);
      c.lookAt(P.pos.x + Math.sin(P.angle) * cp, c.position.y + Math.sin(P.pitch), P.pos.z + Math.cos(P.angle) * cp);
      c.rotation.z += Math.sin(P.bob * 0.5) * 0.004;
      return;
    }
    const p = this.player.pos;
    const cam = this.room.cameras.find(c => inZone(c.zone, p.x, p.z)) ?? this.room.cameras[0];
    if (!cam) return;
    const head = new THREE.Vector3(p.x, 1.1, p.z);
    const cut = cam !== this.camCurrent;
    this.camCurrent = cam;
    this.camera.position.copy(cam.pos);
    if (cam.fov !== this.camera.fov) { this.camera.fov = cam.fov; this.camera.updateProjectionMatrix(); }
    const want = cam.look === 'track' ? head : cam.look;
    if (cut) this.lookAt.copy(want); else this.lookAt.lerp(want, Math.min(1, dt * 4));
    this.camera.lookAt(this.lookAt);
  }

  // ---------------------------------------------------------------- smyčka
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
  }
  step(dt) {
    input.beginFrame();
    input.pollPad();
    if (input.hit('mute')) { sound.master && (sound.master.gain.value = sound.master.gain.value > 0 ? 0 : 0.8); }
    this.bot.update(dt);
    if (!this.paused) {
      this.time += dt;
      shared.uTime.value = this.time;
      for (const tm of this.timers) tm.t -= dt;
      const done = this.timers.filter(tm => tm.t <= 0); this.timers = this.timers.filter(tm => tm.t > 0);
      done.forEach(tm => tm.res());
      this.ui.update(dt);
      if (this.mode === 'play' && !this.ui.modal && !this.lock && !this.pause.open && input.hit('inv')) this.inventory.toggle();
      if (this.mode === 'play' && !this.ui.modal && !this.lock && !this.inventory.open && !this.pause.open && input.hit('back')) this.pause.toggle();
      else this.pause.update(dt);
      this.inventory.update(dt);
      if (this.room && !this.inventory.open && !this.pause.open) {
        if (!this.room.noPlayer) this.updatePlayer(dt);
        this.room.update(dt, this.time);
        for (const b of this.room.billboards) { b.lookAt(this.camera.position.x, b.getWorldPosition(new THREE.Vector3()).y, this.camera.position.z); }
        this.updateCamera(dt);
      }
      if (this.mode === 'play' && !this.lock && (this.nextGlitch -= dt) <= 0) { this.nextGlitch = 45 + Math.random() * 50; this.randomGlitch(); }
    }
    // fade
    if (this.fadeV !== this.fadeTarget) {
      const s = this.fadeSpeed * dt;
      this.fadeV = Math.abs(this.fadeTarget - this.fadeV) <= s ? this.fadeTarget : this.fadeV + Math.sign(this.fadeTarget - this.fadeV) * s;
      if (this.fadeV === this.fadeTarget && this.fadeRes) { const r = this.fadeRes; this.fadeRes = null; r(); }
    }
    const G = this.glitch, P = this.r.post;
    if (G.until && this.time > G.until) { G.tear = 0; G.shift = 0; G.until = 0; }
    G.noise = Math.max(0, G.noise - dt * 1.5); G.wobble = Math.max(0, G.wobble - dt * 0.8); G.flash = Math.max(0, G.flash - dt * 2);
    P.uTear.value = G.tear; P.uShift.value = G.shift; P.uNoise.value = G.noise; P.uFade.value = this.fadeV;
    P.uFlash.value.setRGB(G.flash, G.flash * 0.9, G.flash * 0.95);
    shared.uWobble.value = G.wobble;
    this.r.render(this.room?.scene, this.camera);
    this.ui.draw();
  }
}

const game = new Game();
window.__game = game;
window.__input = input;
loading.remove();
// ladění: index.html#skip=kitchen|armory|escape přeskočí menu
const skip = (location.hash.match(/skip=(\w+)/) || [])[1];
if (skip) {
  sound.init();
  const S = game.state, F = S.flags;
  F.talkedKing = true; S.inv.push('mapa');
  const at = { kitchen: 0, armory: 0, escape: 0, church: 1, school: 2, hub3: 3, boss: 3 }[skip] ?? 0;
  F.crown = at;
  if (skip === 'armory' || skip === 'escape') { F.stoveSolved = true; S.inv.push('klic'); }
  if (skip === 'escape') { F.armoryIntro = true; F.escape1 = true; S.inv.push('krystal1'); }
  game.mode = 'play';
  const room = { escape: 'armory', hub3: 'hub' }[skip] ?? skip;
  game.loadRoom(room, skip === 'escape' ? 'pedestal' : skip === 'hub3' ? 'door4' : 'start', { fade: false });
} else runBoot(game);
