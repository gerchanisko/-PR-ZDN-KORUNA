// Ověří syntetizované zvuky a uloží je jako WAV do docs/audio/ (pro poslech).
import fs from 'node:fs';
globalThis.document = undefined;
const { GEN } = await import('../../src/engine/audio.js');
fs.mkdirSync('docs/audio', { recursive: true });
const SR = 22050;
for (const [k, fn] of Object.entries(GEN)) {
  const a = fn();
  let peak = 0, sum = 0, nan = 0;
  for (const v of a) { if (Number.isNaN(v)) nan++; peak = Math.max(peak, Math.abs(v)); sum += v * v; }
  const rms = Math.sqrt(sum / a.length);
  console.log(`${k.padEnd(11)} ${(a.length / SR).toFixed(2).padStart(6)}s  peak ${peak.toFixed(2)}  rms ${rms.toFixed(3)}${nan ? '  NaN!' : ''}${peak > 1.5 ? '  CLIP' : ''}${rms < 0.005 ? '  TICHO?' : ''}`);
  const buf = Buffer.alloc(44 + a.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + a.length * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(a.length * 2, 40);
  a.forEach((v, i) => buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  fs.writeFileSync(`docs/audio/${k}.wav`, buf);
}
