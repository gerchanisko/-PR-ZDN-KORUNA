import puppeteer from 'puppeteer-core';
import { startServer } from '../serve.js';
const srv = await startServer(8051);
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 720 });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://127.0.0.1:8051/#skip=' + (process.argv[2] || 'armory'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < Number(process.argv[3] || 30); i++) {
  await sleep(1000);
  const s = await p.evaluate(() => { const g = window.__game, c = g.room?.coat; if (g.ui.dialog) window.__input.press('act'); return c ? `${c.mode} wp=${c.wp} pos=${c.pos.x.toFixed(1)},${c.pos.z.toFixed(1)} lock=${g.lock} t=${g.time.toFixed(1)}` : 'no coat'; });
  console.log(i, s);
}
await p.screenshot({ path: process.env.SHOT || 'dbg.png' });
await b.close(); srv.close();
