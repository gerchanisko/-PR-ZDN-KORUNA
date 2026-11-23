// Procedurální textury 64–256 px. Každá prochází "poškozením" (škrábance, mrtvé bloky),
// skutečnou JPEG kompresí prohlížeče a kvantizací na 15bit barvu – jako vypálené na starý disk.
import * as THREE from '../../lib/three.module.js';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = false;
  return [c, g];
}

const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

function noise(g, w, h, amount, r, mono = true) {
  const d = g.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d.data[i] += n; d.data[i + 1] += mono ? n : (r() - 0.5) * amount; d.data[i + 2] += mono ? n : (r() - 0.5) * amount;
  }
  g.putImageData(d, 0, 0);
}

function damage(g, w, h, r, amount = 1) {
  // škrábance
  for (let i = 0; i < 3 * amount; i++) {
    g.strokeStyle = r() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.3)';
    g.lineWidth = 1;
    g.beginPath();
    const x = r() * w, y = r() * h;
    g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * w * 0.6, y + (r() - 0.5) * h * 0.6);
    g.stroke();
  }
  // skvrny špíny
  for (let i = 0; i < 4 * amount; i++) {
    g.fillStyle = `rgba(20,12,5,${0.08 + r() * 0.15})`;
    g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * w * 0.12, 0, 7); g.fill();
  }
  // "vadné sektory" – posunuté bloky 8x8 jako chyba čtení disku
  for (let i = 0; i < amount * 1.5; i++) {
    if (r() < 0.5) continue;
    const bx = Math.floor(r() * w / 8) * 8, by = Math.floor(r() * h / 8) * 8;
    const blk = g.getImageData(bx, by, 8, 8);
    g.putImageData(blk, (bx + 8 * (1 + Math.floor(r() * 3))) % w, by);
  }
}

function quantize(g, w, h, bits = 5) {
  const d = g.getImageData(0, 0, w, h);
  const s = 255 / ((1 << bits) - 1);
  for (let i = 0; i < d.data.length; i += 4) {
    for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(Math.round(d.data[i + k] / s) * s);
    d.data[i + 3] = Math.round(d.data[i + 3] / 85) * 85;
  }
  g.putImageData(d, 0, 0);
}

async function jpeg(c, g, q) {
  const img = new Image();
  img.src = c.toDataURL('image/jpeg', q);
  await img.decode();
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0);
}

function toTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.userData.canvas = c;
  return t;
}

async function make(size, draw, { seed = 1, jpg = 0.4, dmg = 1, h } = {}) {
  const [c, g] = cv(size, h ?? size);
  const r = rng(seed);
  draw(g, c.width, c.height, r);
  if (dmg) damage(g, c.width, c.height, r, dmg);
  if (jpg) await jpeg(c, g, jpg);
  quantize(g, c.width, c.height);
  return toTex(c);
}

function px(g, x, y, col, s = 1) { g.fillStyle = col; g.fillRect(x, y, s, s); }

// ---------------------------------------------------------------- jednotlivé textury
const D = {
  stone(g, w, h, r) {
    g.fillStyle = '#3a3633'; g.fillRect(0, 0, w, h);
    const rows = 4;
    for (let y = 0; y < rows; y++) {
      const off = (y % 2) * 16;
      for (let x = -1; x < 3; x++) {
        const l = 34 + r() * 16;
        g.fillStyle = hsl(30 + r() * 20, 6 + r() * 8, l);
        g.fillRect(x * 32 + off + 1, y * 16 + 1, 30, 14);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x * 32 + off + 1, y * 16 + 1, 30, 2);
      }
    }
    noise(g, w, h, 30, r);
    g.fillStyle = 'rgba(40,70,30,0.25)';
    for (let i = 0; i < 6; i++) g.fillRect(r() * w, h - r() * 12, 3 + r() * 6, 12);
  },
  cobble(g, w, h, r) {
    g.fillStyle = '#2b2622'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = hsl(28, 8, 26 + r() * 18);
      const x = r() * w, y = r() * h, s = 5 + r() * 7;
      g.beginPath(); g.ellipse(x, y, s, s * 0.8, r() * 3, 0, 7); g.fill();
    }
    noise(g, w, h, 34, r);
  },
  wood(g, w, h, r) {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = hsl(24 + r() * 8, 35, 18 + r() * 10); g.fillRect(x, 0, 16, h);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x, 0, 1, h);
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x + 2 + r() * 12, 0, 1, h);
      }
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(x + 8, r() * h, 2, 3, 0, 0, 7); g.fill();
    }
    noise(g, w, h, 26, r);
  },
  tilesFloor(g, w, h, r) {
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      g.fillStyle = (x + y) % 2 ? hsl(170, 20, 42 + r() * 6) : hsl(50, 18, 74 + r() * 6);
      g.fillRect(x * s, y * s, s, s);
    }
    g.fillStyle = '#2a2622';
    for (let i = 0; i <= n; i++) { g.fillRect(i * s - 1, 0, 2, h); g.fillRect(0, i * s - 1, w, 2); }
    noise(g, w, h, 22, r);
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.beginPath(); g.moveTo(r() * w, r() * h); for (let i = 0; i < 5; i++) g.lineTo(r() * w, r() * h); g.stroke();
  },
  tilesWall(g, w, h, r) {
    const s = w / 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = hsl(60, 10, 78 + r() * 8);
      if (y === 5) g.fillStyle = hsl(205, 40, 40 + r() * 6);
      g.fillRect(x * s, y * s, s, s);
    }
    g.fillStyle = '#7a756a';
    for (let i = 0; i <= 8; i++) { g.fillRect(i * s, 0, 1, h); g.fillRect(0, i * s, w, 1); }
    noise(g, w, h, 18, r);
    g.fillStyle = 'rgba(80,60,20,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(r() * w, r() * h * 0.5, 2, 10 + r() * 30);
  },
  placeholder(g, w, h, r) {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#7a7a7a' : '#8c8c8c'; g.fillRect(x * 16, y * 16, 16, 16);
    }
    g.fillStyle = '#ff00ff'; g.fillRect(0, 0, 16, 16); g.fillRect(w - 16, h - 16, 16, 16);
    g.font = 'bold 15px monospace'; g.textAlign = 'center';
    g.fillStyle = '#111';
    g.fillText('PLACEHOLDER', w / 2, h / 2 - 8);
    g.fillText('PLACEHOLDER', w / 2, h / 2 + 30);
    g.font = '9px monospace'; g.fillStyle = '#333';
    g.fillText('tex_wall_07.tim', w / 2, h / 2 + 10);
  },
  sky(g, w, h, r) {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2b1d48'); grd.addColorStop(0.45, '#a8476a'); grd.addColorStop(0.7, '#f39a4c'); grd.addColorStop(1, '#ffd78a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(${90 + r() * 60},${40 + r() * 30},${80 + r() * 40},0.55)`;
      g.fillRect(r() * w, h * (0.2 + r() * 0.45), 20 + r() * 50, 3 + r() * 5);
    }
  },
  sun(g, w, h, r) {
    // záměrně čtverec s pozadím – JPEG nemá průhlednost
    g.fillStyle = '#f6c27a'; g.fillRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#fffbe6'); grd.addColorStop(0.35, '#ffe08a'); grd.addColorStop(0.6, '#ff9a3c'); grd.addColorStop(1, '#f6c27a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#000'; g.font = '6px monospace'; g.fillText('sun_final2.jpg', 2, h - 3);
  },
  face(kind) {
    return (g, w, h, r) => {
      const skin = kind === 'king' ? '#c99a7a' : kind === 'baker' ? '#e0a98a' : kind === 'wren' ? '#d8b090' : kind === 'granny' ? '#cfb7a5' : '#d9b8a0';
      g.fillStyle = skin; g.fillRect(0, 0, w, h);
      noise(g, w, h, 14, r);
      if (kind === 'faceless') {
        // místo obličeje jen rozmazaná, příliš hladká kůže a šev
        g.fillStyle = 'rgba(255,230,210,0.35)'; g.beginPath(); g.ellipse(w / 2, h / 2, 18, 22, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(120,70,60,0.35)'; g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2 + 1, h - 8); g.stroke();
        return;
      }
      const eyeY = kind === 'king' ? 26 : 24;
      g.fillStyle = '#f2eee6'; g.fillRect(16, eyeY, 10, 6); g.fillRect(38, eyeY, 10, 6);
      g.fillStyle = kind === 'king' ? '#101010' : '#3a2a1a';
      g.fillRect(20, eyeY + 1, 4, 5); g.fillRect(42, eyeY + 1, 4, 5);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(15, eyeY - 4, 12, 2); g.fillRect(37, eyeY - 4, 12, 2);
      g.fillStyle = 'rgba(120,60,40,0.6)'; g.fillRect(30, eyeY + 6, 4, 10);
      if (kind === 'king') {
        g.fillStyle = '#d9d4c8';
        g.beginPath(); g.moveTo(10, 40); g.lineTo(54, 40); g.lineTo(44, 64); g.lineTo(20, 64); g.fill();
        g.fillStyle = '#5a1010'; g.fillRect(24, 46, 16, 3);
        // nedokreslené oko vpravo – jen obrys
        g.fillStyle = skin; g.fillRect(38, eyeY, 10, 6);
        g.strokeStyle = '#000'; g.strokeRect(38.5, eyeY + 0.5, 9, 5);
      } else if (kind === 'baker') {
        g.fillStyle = 'rgba(220,80,80,0.5)'; g.fillRect(12, 36, 8, 5); g.fillRect(44, 36, 8, 5);
        g.fillStyle = '#4a2a14'; g.fillRect(20, 40, 24, 5);
        g.fillStyle = '#7a2a2a'; g.fillRect(26, 47, 12, 3);
      } else if (kind === 'granny') {
        g.strokeStyle = 'rgba(80,40,30,0.4)';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(12, 34 + i * 4); g.lineTo(20, 33 + i * 4); g.stroke(); }
        g.fillStyle = '#6a3a3a'; g.fillRect(26, 46, 12, 2);
        g.fillStyle = skin; g.fillRect(16, eyeY + 2, 32, 4); // zavřené oči
        g.fillStyle = '#000'; g.fillRect(16, eyeY + 4, 10, 1); g.fillRect(38, eyeY + 4, 10, 1);
      } else {
        g.fillStyle = '#7a3a30'; g.fillRect(26, 46, 12, 2);
      }
    };
  },
  cloth(g, w, h, r) {
    g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, 0, 1, h); }
    noise(g, w, h, 30, r);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 6, w, 6);
  },
  apron(g, w, h, r) {
    D.cloth(g, w, h, r);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(255,250,230,0.8)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(120,60,30,0.4)'; g.fillRect(r() * 40, 30 + r() * 20, 12, 8);
  },
  metal(g, w, h, r) {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#8d9196'); grd.addColorStop(0.5, '#5d6066'); grd.addColorStop(1, '#9ea2a6');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    noise(g, w, h, 26, r);
    g.fillStyle = '#2a2a2a';
    for (let i = 0; i < 4; i++) { g.fillRect(4, 4 + i * 16, 3, 3); g.fillRect(w - 7, 4 + i * 16, 3, 3); }
    g.fillStyle = 'rgba(110,60,20,0.4)'; g.fillRect(r() * w, r() * h, 10, 6);
  },
  gold(g, w, h, r) {
    g.fillStyle = '#b8902a'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 50, r);
    g.fillStyle = 'rgba(255,240,150,0.5)'; g.fillRect(0, 6, w, 4);
    g.fillStyle = '#a01020'; g.fillRect(w / 2 - 5, h / 2 - 5, 10, 10);
  },
  bread(g, w, h, r) {
    g.fillStyle = '#8a4e1c'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 40, r);
    g.strokeStyle = '#d8a060'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(8 + i * 14, 10); g.lineTo(16 + i * 14, 54); g.stroke(); }
  },
  drawing(g, w, h, r) {
    // dětská kresba: jak se zhasíná sporák
    g.fillStyle = '#f2ead2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#333'; g.lineWidth = 2; g.lineJoin = 'round';
    const wob = (x, y) => [x + (r() - 0.5) * 3, y + (r() - 0.5) * 3];
    g.beginPath(); g.moveTo(...wob(14, 70)); g.lineTo(...wob(114, 72)); g.lineTo(...wob(112, 112)); g.lineTo(...wob(16, 110)); g.closePath(); g.stroke();
    const xs = [32, 64, 96], num = ['3', '1', '2'];
    xs.forEach((x, i) => {
      g.fillStyle = '#e06010'; g.beginPath(); g.moveTo(x - 9, 68); g.quadraticCurveTo(x - 6, 50, x, 40); g.quadraticCurveTo(x + 6, 50, x + 9, 68); g.fill();
      g.fillStyle = '#ffd000'; g.beginPath(); g.moveTo(x - 4, 68); g.quadraticCurveTo(x, 55, x, 52); g.quadraticCurveTo(x, 55, x + 4, 68); g.fill();
      g.fillStyle = '#1030c0'; g.font = 'bold 20px serif'; g.fillText(num[i], x - 6, 34);
      g.beginPath(); g.arc(x, 96, 6, 0, 7); g.stroke();
    });
    g.fillStyle = '#c01010'; g.font = 'bold 11px sans-serif'; g.fillText('JAK SE ZHASÍNÁ', 18, 14);
    g.fillStyle = '#555'; g.font = '9px sans-serif'; g.fillText('tomáš 8 let', 70, 124);
  },
  note(g, w, h, r) {
    g.fillStyle = '#ece4cc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9ab'; for (let y = 10; y < h; y += 8) g.fillRect(0, y, w, 1);
    g.fillStyle = '#223'; g.font = '8px serif';
    ['Přijdeme v pět.', 'Nezapínej', 'sporák!!', '   máma'].forEach((t, i) => g.fillText(t, 4, 17 + i * 8 * 1.6));
  },
  clock(g, w, h, r) {
    g.fillStyle = '#20180f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, 7); g.fill();
    g.fillStyle = '#222';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * (w / 2 - 8) - 1, h / 2 - Math.cos(a) * (h / 2 - 8) - 1, 3, 3); }
    const hand = (a, l, wd) => { g.lineWidth = wd; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * l, h / 2 - Math.cos(a) * l); g.stroke(); };
    hand((4 + 47 / 60) / 12 * Math.PI * 2, w * 0.24, 3); // 16:47
    hand(47 / 60 * Math.PI * 2, w * 0.38, 2);
  },
  door(g, w, h, r) {
    D.wood(g, w, h, r);
    g.fillStyle = '#222'; g.fillRect(0, h * 0.18, w, 5); g.fillRect(0, h * 0.75, w, 5);
    g.fillStyle = '#555'; g.fillRect(w * 0.8, h * 0.5, 5, 5);
  },
  flame(g, w, h, r) {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = w / 2 + (r() - 0.5) * 10, s = w * (0.4 - i * 0.08);
      g.fillStyle = ['#e04000', '#ff8000', '#ffc000', '#fff3a0'][i];
      g.beginPath(); g.moveTo(x - s, h); g.quadraticCurveTo(x - s * 0.6, h * (0.4 + i * 0.1), x, h * (0.05 + i * 0.15)); g.quadraticCurveTo(x + s * 0.6, h * (0.4 + i * 0.1), x + s, h); g.fill();
    }
  },
  crystal(hue) {
    return (g, w, h, r) => {
      for (let i = 0; i < 12; i++) {
        g.fillStyle = hsl(hue + r() * 30, 70, 35 + r() * 40);
        g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(w * 0.3, 0, 3, h);
    };
  },
  banner(g, w, h, r) {
    g.fillStyle = '#6a0f18'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8a030';
    g.beginPath(); g.moveTo(16, 40); g.lineTo(20, 24); g.lineTo(26, 34); g.lineTo(32, 20); g.lineTo(38, 34); g.lineTo(44, 24); g.lineTo(48, 40); g.fill();
    g.fillStyle = '#6a0f18'; g.fillRect(24, 32, 16, 6); // prázdná koruna – díra uprostřed
    g.fillStyle = '#c8a030'; g.fillRect(0, h - 6, w, 3);
    noise(g, w, h, 20, r);
  },
  coat(g, w, h, r) {
    g.fillStyle = '#1d1a1c'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 18, r);
    g.fillStyle = '#5a4a3a'; for (let i = 0; i < 4; i++) g.fillRect(w / 2 + 6, 10 + i * 13, 3, 3);
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(w / 2, 0, 2, h);
  },
  wallpaper(g, w, h, r) {
    g.fillStyle = '#6b5a33'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 16 + (y % 2) * 8 + 4, cy = y * 16 + 8;
      g.fillStyle = '#8a3b1d'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
      g.fillStyle = '#c99a3a'; g.beginPath(); g.arc(cx, cy, 2, 0, 7); g.fill();
    }
    noise(g, w, h, 20, r);
  },
  carpet(g, w, h, r) {
    g.fillStyle = '#5a1f1f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#b08040'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
    g.strokeRect(20, 20, w - 40, h - 40);
    noise(g, w, h, 30, r);
  },
  hair(col) {
    return (g, w, h, r) => {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(r() * w, 0, 1, h); }
      noise(g, w, h, 20, r);
    };
  },
  static(g, w, h, r) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(g, x, y, r() > 0.5 ? '#ddd' : '#222');
  },
  blob(g, w, h) {
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  },
  white(g, w, h) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); },
  black(g, w, h) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); },
  oven(g, w, h, r) {
    D.stone(g, w, h, r);
    g.fillStyle = '#120804'; g.beginPath(); g.arc(w / 2, h * 0.62, w * 0.3, Math.PI, 0); g.fillRect(w * 0.2, h * 0.62, w * 0.6, h * 0.3); g.fill();
  },
  window(g, w, h, r) {
    g.fillStyle = '#c86a2a'; g.fillRect(0, 0, w, h);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#30183a'); grd.addColorStop(1, '#e08040');
    g.fillStyle = grd; g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#2a1a10'; g.fillRect(w / 2 - 2, 0, 4, h); g.fillRect(0, h / 2 - 2, w, 4);
    g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  },

  brick(g, w, h, r) {
    // rozmazaná cihla: kreslená ve 1/2 rozlišení a roztažená
    const [c2, g2] = cv(w / 2, h / 2);
    g2.fillStyle = '#4a2a20'; g2.fillRect(0, 0, w / 2, h / 2);
    for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
      g2.fillStyle = hsl(10 + r() * 15, 35 + r() * 15, 28 + r() * 12);
      g2.fillRect(x * 8 + (y % 2) * 4 + 0.5, y * 4 + 0.5, 7, 3);
    }
    g.imageSmoothingEnabled = true; g.filter = 'blur(1px)';
    g.drawImage(c2, 0, 0, w, h); g.filter = 'none'; g.imageSmoothingEnabled = false;
    noise(g, w, h, 24, r);
  },
  water(g, w, h, r) {
    g.fillStyle = '#123e52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${120 + r() * 80},${200 + r() * 55},255,${0.15 + r() * 0.35})`; g.lineWidth = 1 + r() * 2;
      g.beginPath(); const y = r() * h; g.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + i) * 3);
      g.stroke();
    }
    noise(g, w, h, 18, r, false);
  },
  stained(g, w, h, r) {
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
    const cols = ['#a01818', '#1838a0', '#d0a018', '#187a38', '#6a1890'];
    for (let y = 0; y < h; y += 10) for (let x = 0; x < w; x += 10) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x + 1, y + 1, 8 + r() * 2, 8 + r() * 2); }
    g.fillStyle = '#e8d8a8'; g.beginPath(); g.arc(w / 2, h * 0.35, 10, 0, 7); g.fill(); // svatozář bez obličeje
    g.fillStyle = '#111'; g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h / 2, w, 2);
  },
  locker(g, w, h, r) {
    g.fillStyle = '#4a6a7a'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 20, r);
    g.fillStyle = '#2a3a44'; g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
    for (let i = 0; i < 5; i++) g.fillRect(w * 0.25, 6 + i * 4, w * 0.5, 2);
    g.fillStyle = '#c8c8c8'; g.fillRect(w * 0.75, h * 0.5, 4, 8);
    g.fillStyle = 'rgba(110,60,20,0.5)'; g.fillRect(r() * w, h * 0.7 + r() * 10, 6, 10);
  },
  blackboard(g, w, h, r) {
    g.fillStyle = '#1e3a2a'; g.fillRect(0, 0, w, h);
    noise(g, w, h, 16, r);
    g.fillStyle = 'rgba(230,230,220,0.85)'; g.font = '11px serif';
    ['Domácí úkol:', 'Kolik je hodin,', 'když se čeká', 'nejdéle?', '', '  __ : __'].forEach((t, i) => g.fillText(t, 8, 16 + i * 13));
    g.fillStyle = 'rgba(230,230,220,0.3)'; g.fillRect(70, 70, 40, 14);
  },
  linoleum(g, w, h, r) {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? hsl(40, 12, 52 + r() * 6) : hsl(30, 15, 40 + r() * 6); g.fillRect(x * w / 4, y * h / 4, w / 4, h / 4); }
    noise(g, w, h, 20, r);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
  },
  schoolWall(g, w, h, r) {
    g.fillStyle = '#d8ccb0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4e7a5a'; g.fillRect(0, h * 0.55, w, h * 0.45);
    g.fillStyle = '#2e4a36'; g.fillRect(0, h * 0.55, w, 2);
    noise(g, w, h, 16, r);
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(r() * w, h * 0.55 - 10, 2 + r() * 3, 30); }
  },
  childDrawing2(g, w, h, r) { // rodina, které chybí dva lidé
    g.fillStyle = '#f2ead2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#333'; g.lineWidth = 2;
    const fig = (x, col) => { g.strokeStyle = col; g.beginPath(); g.arc(x, 40, 9, 0, 7); g.moveTo(x, 49); g.lineTo(x, 80); g.moveTo(x - 12, 60); g.lineTo(x + 12, 60); g.moveTo(x, 80); g.lineTo(x - 9, 100); g.moveTo(x, 80); g.lineTo(x + 9, 100); g.stroke(); };
    fig(30, '#1030c0');
    g.fillStyle = '#ccc'; g.fillRect(56, 26, 30, 80); g.fillRect(92, 26, 30, 80); // vygumované postavy
    g.fillStyle = '#555'; g.font = '9px sans-serif'; g.fillText('JÁ', 24, 116); g.fillText('máma', 58, 116); g.fillText('táta', 96, 116);
    g.fillStyle = '#e0a010'; g.beginPath(); g.arc(112, 14, 8, 0, 7); g.fill();
  },
  bars(g, w, h, r) {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#5a5a60';
    for (let x = 2; x < w; x += 8) g.fillRect(x, 0, 3, h);
    g.fillRect(0, 2, w, 3); g.fillRect(0, h - 5, w, 3);
  },
};

/** Cedule s textem (sync, bez JPEG – kvůli dynamickým změnám). */
export function signTex(lines, { w = 128, h = 32, bg = '#2a1d12', fg = '#d8c8a0', font = 'bold 14px serif', seed = 7 } = {}) {
  const [c, g] = cv(w, h);
  const r = rng(seed);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  noise(g, w, h, 20, r);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = Array.isArray(lines) ? lines : [lines];
  L.forEach((t, i) => g.fillText(t, w / 2, h / 2 + (i - (L.length - 1) / 2) * (h / L.length)));
  damage(g, w, h, r, 0.5);
  quantize(g, w, h);
  return toTex(c);
}

export async function buildTextures() {
  const T = {};
  const jobs = {
    stone: [64, D.stone, { seed: 1 }],
    cobble: [64, D.cobble, { seed: 2 }],
    wood: [64, D.wood, { seed: 3 }],
    tilesFloor: [128, D.tilesFloor, { seed: 4, jpg: 0.3 }],
    tilesWall: [64, D.tilesWall, { seed: 5 }],
    placeholder: [128, D.placeholder, { seed: 6, jpg: 0.6, dmg: 0.5 }],
    sky: [128, D.sky, { seed: 7, jpg: 0.04, dmg: 0, h: 64 }],
    sun: [32, D.sun, { seed: 8, jpg: 0.02, dmg: 0 }],
    faceKing: [64, D.face('king'), { seed: 9, jpg: 0.25 }],
    faceBaker: [64, D.face('baker'), { seed: 10 }],
    faceless: [64, D.face('faceless'), { seed: 11, jpg: 0.5, dmg: 0 }],
    faceWren: [64, D.face('wren'), { seed: 12 }],
    faceGranny: [64, D.face('granny'), { seed: 13, jpg: 0.2 }],
    faceGuard: [64, D.face('guard'), { seed: 14 }],
    cloth: [64, D.cloth, { seed: 15 }],
    apron: [64, D.apron, { seed: 16 }],
    metal: [64, D.metal, { seed: 17 }],
    gold: [32, D.gold, { seed: 18, dmg: 0 }],
    bread: [64, D.bread, { seed: 19 }],
    drawing: [128, D.drawing, { seed: 20, jpg: 0.5, dmg: 0.6 }],
    note: [64, D.note, { seed: 21, jpg: 0.6, dmg: 0.3 }],
    clock: [64, D.clock, { seed: 22, jpg: 0.5, dmg: 0.4 }],
    door: [64, D.door, { seed: 23 }],
    flame: [32, D.flame, { seed: 24, jpg: 0, dmg: 0 }],
    crystal: [32, D.crystal(290), { seed: 25, dmg: 0 }],
    crystalBlue: [32, D.crystal(195), { seed: 26, dmg: 0 }],
    banner: [64, D.banner, { seed: 27 }],
    coat: [64, D.coat, { seed: 28 }],
    wallpaper: [64, D.wallpaper, { seed: 29 }],
    carpet: [64, D.carpet, { seed: 30 }],
    hairBrown: [32, D.hair('#4a2e18'), { seed: 31, dmg: 0 }],
    hairGrey: [32, D.hair('#a8a49c'), { seed: 32, dmg: 0 }],
    static: [32, D.static, { seed: 33, jpg: 0, dmg: 0 }],
    blob: [32, D.blob, { seed: 34, jpg: 0, dmg: 0 }],
    white: [8, D.white, { jpg: 0, dmg: 0 }],
    black: [8, D.black, { jpg: 0, dmg: 0 }],
    oven: [64, D.oven, { seed: 35 }],
    window: [32, D.window, { seed: 36, jpg: 0.3, dmg: 0 }],
    brick: [64, D.brick, { seed: 37, jpg: 0.25 }],
    water: [64, D.water, { seed: 38, jpg: 0.35, dmg: 0 }],
    stained: [64, D.stained, { seed: 39, jpg: 0.4 }],
    locker: [32, D.locker, { seed: 40, dmg: 0.3 }],
    blackboard: [128, D.blackboard, { seed: 41, jpg: 0.5, dmg: 0.5 }],
    linoleum: [64, D.linoleum, { seed: 42 }],
    schoolWall: [64, D.schoolWall, { seed: 43 }],
    drawing2: [128, D.childDrawing2, { seed: 44, jpg: 0.5, dmg: 0.6 }],
    bars: [32, D.bars, { seed: 45, jpg: 0, dmg: 0 }],
  };
  await Promise.all(Object.entries(jobs).map(async ([k, [s, fn, o]]) => { T[k] = await make(s, fn, o); }));
  T.sky.wrapT = THREE.ClampToEdgeWrapping;
  T.sun.wrapS = T.sun.wrapT = THREE.ClampToEdgeWrapping;
  return T;
}
