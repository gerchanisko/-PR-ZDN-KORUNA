import * as THREE from '../lib/three.module.js';
import { PS1Renderer, shared, setLights } from './engine/ps1.js';
import { buildTextures } from './assets/textures.js';
import * as MD from './assets/models.js';

const T = await buildTextures();
MD.setTextures(T);
const box = document.getElementById('texs');
for (const [k, t] of Object.entries(T)) {
  const d = document.createElement('div'); const c = t.userData.canvas;
  c.style.cssText = ''; d.append(c, k); box.append(d);
}
const R = new PS1Renderer(document.getElementById('ps1'));
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(50, 4 / 3, 0.1, 60);
cam.position.set(0, 2.2, 7.5); cam.lookAt(0, 1.1, 0);
shared.uFogNear.value = 6; shared.uFogFar.value = 16;
shared.uFogColor.value.set(0x1a1018);
shared.uAmbient.value.setRGB(0.45, 0.4, 0.42);
shared.uSunColor.value.setRGB(0.6, 0.45, 0.3);
setLights([{ pos: [0, 3, 3], color: 0xffaa66, range: 10, intensity: 0.8 }]);
const floor = MD.floorPlane(20, 12, MD.M('tilesFloor'), 2); scene.add(floor);
const wall = MD.worldBox(20, 5, 0.4, MD.M('stone'), 2); wall.position.set(0, 2.5, -3); scene.add(wall);
const ph = MD.worldBox(3, 5, 0.42, MD.M('placeholder'), 3); ph.position.set(5, 2.5, -2.98); scene.add(ph);
const sky = MD.card(6, 3, MD.M('sky', { noFog: true, emissive: 1 })); sky.position.set(-6, 3.5, -2.7); scene.add(sky);
const sun = MD.card(1, 1, MD.M('sun', { noFog: true, emissive: 1 })); sun.position.set(-5.5, 4, -2.6); scene.add(sun);
const baker2 = MD.makeBaker(); baker2.userData.setFaceless(true);
const chars = [MD.makeWren(), MD.makeKing(), MD.makeBaker(), baker2, MD.makeGuard(), MD.makeCoat(), MD.makeBellRinger(), MD.makeTeacher(), MD.makeCrystal(), MD.makeCrystal(true)];
chars.forEach((c, i) => { c.position.set(-6.3 + i * 1.4, i >= 8 ? 1.2 : 0, 0); scene.add(c); });
chars[4].userData.tpose = 1;
const st = MD.props.stove(); st.position.set(-3, 0, -2); scene.add(st);
const ov = MD.props.oven(); ov.position.set(3, 0, -2); ov.scale.setScalar(0.7); scene.add(ov);
let t = 0;
function loop() {
  t += 1 / 60; shared.uTime.value = t;
  chars.forEach((c, i) => { c.rotation.y = Math.sin(t * 0.7 + i) * 0.8; MD.animate(c, 1 / 60, i === 0 ? 1 : 0, t); if (c.userData.spin) c.userData.spin.rotation.y = t * 2; });
  R.render(scene, cam);
  requestAnimationFrame(loop);
}
loop();
window.__ready = true;
