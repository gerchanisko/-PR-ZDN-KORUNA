// PS1 render pipeline: nízké rozlišení, vertex snapping, afinní mapování textur,
// Gouraud osvětlení po vrcholech, mlha jako draw distance, dithering + 15bit barvy.
import * as THREE from '../../lib/three.module.js';

export const RES = { w: 320, h: 240 };

// Sdílené uniformy – všechny PS1 materiály odkazují na stejné objekty.
export const shared = {
  uRes: { value: new THREE.Vector2(RES.w, RES.h) },
  uSnap: { value: 1.0 },
  uTime: { value: 0 },
  uWobble: { value: 0 },
  uFogColor: { value: new THREE.Color(0.05, 0.04, 0.05) },
  uFogNear: { value: 4 },
  uFogFar: { value: 20 },
  uAmbient: { value: new THREE.Color(0.25, 0.22, 0.22) },
  uSunDir: { value: new THREE.Vector3(0.4, -0.6, 0.5).normalize() },
  uSunColor: { value: new THREE.Color(0, 0, 0) },
  uLightPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
  uLightColor: { value: [0, 1, 2, 3].map(() => new THREE.Color(0, 0, 0)) },
  uLightRange: { value: [1, 1, 1, 1] },
  uWave: { value: 0 },                                  // podvodní vlnění
  uBendPos: { value: new THREE.Vector3() },             // boss ohýbá prostor
  uBendAmt: { value: 0 },
};

const VERT = /* glsl */`
uniform vec2 uRes; uniform float uSnap; uniform float uTime; uniform float uWobble;
uniform float uFogNear; uniform float uFogFar;
uniform vec3 uAmbient; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform vec3 uLightPos[4]; uniform vec3 uLightColor[4]; uniform float uLightRange[4];
uniform float uEmissive; uniform float uNoFog; uniform vec2 uUvScale; uniform vec2 uUvScroll;
uniform float uWave; uniform vec3 uBendPos; uniform float uBendAmt;
varying vec2 vUvW; varying float vW; varying vec3 vLight; varying float vFog;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  if (uWave > 0.0) {
    wp.x += sin(wp.y * 1.7 + wp.z * 0.6 + uTime * 1.3) * uWave * 0.12;
    wp.z += cos(wp.y * 1.3 + wp.x * 0.5 + uTime * 1.1) * uWave * 0.10;
  }
  if (uBendAmt > 0.0) {
    // prostor se kroutí kolem loading baru: rotace v XZ úměrná blízkosti + "nasávání"
    vec2 d = wp.xz - uBendPos.xz;
    float r = length(d);
    float a = uBendAmt * 2.4 / (1.0 + r * 0.35) * sin(uTime * 0.4 + r * 0.25);
    float cs = cos(a), sn = sin(a);
    d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs);
    wp.xz = uBendPos.xz + d * (1.0 + uBendAmt * 0.12 * sin(uTime * 0.7 - r * 0.4));
    wp.y += uBendAmt * 0.6 * sin(r * 0.6 - uTime) / (1.0 + r * 0.2);
  }
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vec3 lit = uAmbient + uSunColor * max(dot(n, -uSunDir), 0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = uLightPos[i] - wp.xyz;
    float dist = length(d);
    float att = clamp(1.0 - dist / uLightRange[i], 0.0, 1.0);
    float lam = max(dot(n, d / max(dist, 0.001)), 0.0) * 0.7 + 0.3;
    lit += uLightColor[i] * att * att * lam;
  }
  vLight = mix(lit, vec3(1.0), uEmissive);
  vec4 vp = viewMatrix * wp;
  vec4 cp = projectionMatrix * vp;
  // vertex snapping na mřížku nízkého rozlišení (PS1 neměla subpixel přesnost)
  if (cp.w > 0.0) {
    vec2 grid = uRes * 0.5 * uSnap;
    cp.xy = floor(cp.xy / cp.w * grid + 0.5) / grid * cp.w;
  }
  if (uWobble > 0.0) {
    float h = fract(sin(dot(position.xy + position.z, vec2(12.9898, 78.233)) + floor(uTime * 12.0)) * 43758.5453);
    cp.xy += (h - 0.5) * uWobble * cp.w * 0.08;
  }
  gl_Position = cp;
  // afinní mapování: interpolace uv*w i w, dělení ve fragmentu => lineární v prostoru obrazovky
  vUvW = (uv * uUvScale + uUvScroll * uTime) * cp.w;
  vW = cp.w;
  float depth = -vp.z;
  vFog = uNoFog > 0.5 ? 0.0 : clamp((depth - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
}`;

const FRAG = /* glsl */`
uniform sampler2D map; uniform vec3 uTint; uniform vec3 uFogColor; uniform float uOpacity;
varying vec2 vUvW; varying float vW; varying vec3 vLight; varying float vFog;
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  for (int k = 0; k < 16; k++) if (k == i) return (m[k] + 0.5) / 16.0;
  return 0.5;
}
void main(){
  vec2 uv = vUvW / vW;
  vec4 t = texture2D(map, uv);
  // "stipple" průhlednost – screen-door jako na starých konzolích
  if (t.a * uOpacity < bayer4(gl_FragCoord.xy)) discard;
  vec3 c = t.rgb * uTint * vLight;
  c = mix(c, uFogColor, vFog);
  gl_FragColor = vec4(c, 1.0);
}`;

const cache = new Map();
/** PS1 materiál. opts: tint, emissive, noFog, uv:[sx,sy], scroll:[x,y], opacity, side */
export function ps1Mat(tex, opts = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      map: { value: tex },
      uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) },
      uEmissive: { value: opts.emissive ?? 0 },
      uNoFog: { value: opts.noFog ? 1 : 0 },
      uUvScale: { value: new THREE.Vector2(...(opts.uv ?? [1, 1])) },
      uUvScroll: { value: new THREE.Vector2(...(opts.scroll ?? [0, 0])) },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite ?? true,
  });
  m.userData.ps1 = true;
  return m;
}

const POST_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAG = /* glsl */`
uniform sampler2D tScene; uniform vec2 uRes; uniform float uTime;
uniform float uTear; uniform float uShift; uniform float uNoise; uniform float uFade; uniform float uInvert;
uniform float uVignette; uniform vec3 uFlash;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bayer4(vec2 p){
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  for (int k = 0; k < 16; k++) if (k == i) return (m[k] + 0.5) / 16.0;
  return 0.5;
}
void main(){
  vec2 uv = vUv;
  vec2 px = floor(uv * uRes);
  if (uTear > 0.0) {
    float band = floor(px.y / 6.0);
    float r = h(vec2(band, floor(uTime * 15.0)));
    if (r > 0.6) uv.x += (h(vec2(band * 3.1, floor(uTime * 30.0))) - 0.5) * uTear * 0.25;
    if (r > 0.97) uv.y += 0.03 * uTear;
  }
  vec3 c;
  c.r = texture2D(tScene, uv + vec2(uShift, 0.0)).r;
  c.g = texture2D(tScene, uv).g;
  c.b = texture2D(tScene, uv - vec2(uShift, 0.0)).b;
  if (uNoise > 0.0) c = mix(c, vec3(h(px + floor(uTime * 24.0))), uNoise * step(0.5, h(px.yx + uTime)));
  vec2 q = vUv - 0.5;
  c *= 1.0 - dot(q, q) * uVignette;
  c = mix(c, 1.0 - c, uInvert);
  c = c * uFade + uFlash;
  // dithering + kvantizace na 5 bitů na kanál (15bit barva)
  c += (bayer4(px) - 0.5) / 31.0;
  c = floor(clamp(c, 0.0, 1.0) * 31.0 + 0.5) / 31.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export class PS1Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RES.w, RES.h, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.target = new THREE.WebGLRenderTarget(RES.w, RES.h, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true,
    });
    this.post = {
      tScene: { value: this.target.texture }, uRes: shared.uRes, uTime: shared.uTime,
      uTear: { value: 0 }, uShift: { value: 0 }, uNoise: { value: 0 }, uFade: { value: 1 },
      uInvert: { value: 0 }, uVignette: { value: 0.9 }, uFlash: { value: new THREE.Color(0, 0, 0) },
    };
    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: this.post, vertexShader: POST_VERT, fragmentShader: POST_FRAG, depthTest: false }));
    this.postScene.add(quad);
    this.frozen = false;
  }
  render(scene, camera) {
    if (!this.frozen && scene && camera) {
      this.renderer.setRenderTarget(this.target);
      this.renderer.setClearColor(shared.uFogColor.value, 1);
      this.renderer.clear();
      this.renderer.render(scene, camera);
    }
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}

/** Nastaví světla místnosti. lights: [{pos:[x,y,z], color, range}] */
export function setLights(list) {
  for (let i = 0; i < 4; i++) {
    const l = list[i];
    if (l) {
      shared.uLightPos.value[i].set(...l.pos);
      shared.uLightColor.value[i].set(l.color);
      shared.uLightColor.value[i].multiplyScalar(l.intensity ?? 1);
      shared.uLightRange.value[i] = l.range ?? 8;
    } else {
      shared.uLightColor.value[i].setRGB(0, 0, 0);
      shared.uLightRange.value[i] = 1;
    }
  }
}
