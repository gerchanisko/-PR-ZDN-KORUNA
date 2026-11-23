// node tools/dev/shot.js <skip> <sekundy> <výstup.png> – načte místnost přes #skip, vypíše chyby a stav, udělá screenshot
import puppeteer from 'puppeteer-core';
import { startServer } from '../serve.js';
const [skip = 'church', secs = '6', out = 'shot.png'] = process.argv.slice(2);
const srv = await startServer(8053 + Math.floor(Math.random() * 100));
const port = srv.address().port;
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage(); await p.setViewport({ width: 960, height: 720 });
const errs = []; p.on('pageerror', e => errs.push(e.stack || e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${port}/#skip=${skip}`);
for (let i = 0; i < Number(secs); i++) {
  await new Promise(r => setTimeout(r, 1000));
  await p.evaluate(() => { const g = window.__game; if (g.ui.dialog) window.__input.press('act'); });
}
console.log(await p.evaluate(() => { const g = window.__game, st = g.room?.stalker; return JSON.stringify({ room: g.roomName, lock: g.lock, pos: [g.player.pos.x.toFixed(1), g.player.pos.z.toFixed(1)], stalker: st ? [st.mode, st.pos.x.toFixed(1), st.pos.z.toFixed(1)] : null, prompt: g.ui.prompt, log: g.ui.log.slice(-3) }); }));
await p.screenshot({ path: out });
console.log(errs.length ? 'CHYBY:\n' + errs.join('\n') : 'bez chyb');
await b.close(); srv.close();
