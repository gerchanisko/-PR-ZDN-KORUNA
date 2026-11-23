// Automatický playtest celé hry v headless Chromiu.
//   node tools/playtest.js [all|full|e2|e3]
//   full = menu → hub → 3 levely → boss → KONEC 1 (dohraješ hru)
//   e2   = boss (přes #skip=boss) → KONEC 2 (vypneš konzoli)
//   e3   = boss → pauza a nic nedělat → KONEC 3 (secret, jméno hráče z OS)
// Hra se ovládá virtuálními stisky (stejná cesta jako klávesnice) + autopilot pro chůzi.
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.js';
import fs from 'node:fs';
import os from 'node:os';

const MODE = process.argv[2] ?? 'all';
const ROOT = 'docs/playtest';
const PORT = Number(process.env.PORT) || 8049;
const srv = await startServer(PORT);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/usr/bin/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
const t0 = Date.now();
let failed = false;

async function session(name, hash, fn) {
  const OUT = `${ROOT}/${name}`;
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/` + hash);
  await page.waitForFunction('window.__game', { timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s ${name}] ${m}`);
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  let shot = 0;
  const snap = async (n) => { await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, '0')}-${n}.png` }); };
  const press = (a) => ev(a => window.__input.press(a), a);
  const state = () => ev(() => { const g = window.__game; return { room: g.roomName, lock: g.lock, mode: g.mode, flags: g.state.flags, inv: g.state.inv, saves: g.state.saves, pos: [g.player.pos.x, g.player.pos.z], ending: g.state.ending, captures: g.state.captures }; });
  const until = async (fn, ms = 30000, what = '', arg) => { const e = Date.now() + ms; while (Date.now() < e) { if (await ev(fn, arg)) return true; await sleep(100); } throw new Error('timeout: ' + what); };
  const goto = async (x, z, o = {}) => { const ok = await ev((x, z, o) => window.__game.bot.goto(x, z, o), x, z, o); if (!ok) { const s = await state(); throw new Error(`goto(${x},${z}) selhalo, hráč na ${s.pos.map(v => v.toFixed(2))} v ${s.room}`); } };
  const face = (x, z) => ev((x, z) => window.__game.bot.face(x, z), x, z);
  const prompt = () => ev(() => window.__game.ui.prompt);
  const captures = async () => (await state()).captures;
  const drain = async (maxMs = 60000, choose = 0) => {
    const e = Date.now() + maxMs;
    while (Date.now() < e) {
      const s = await ev(() => { const g = window.__game; return { d: !!g.ui.dialog, c: g.ui.choiceBox ? g.ui.choiceBox.sel : null, sys: !!g.ui.sys, can: g.canMove() }; });
      if (s.can) return;
      if (s.c !== null) { for (let i = s.c; i < choose; i++) { await press('down'); await sleep(120); } await press('act'); }
      else if (s.d || s.sys) await press('act');
      await sleep(350);
    }
    throw new Error('drain timeout');
  };
  const use = async (x, z, fx, fz, expect) => {
    await goto(x, z, { tol: 0.25 }); await face(fx, fz); await sleep(150);
    const p = await prompt();
    if (expect && !(p || '').includes(expect)) throw new Error(`čekal jsem prompt "${expect}", je "${p}"`);
    log(`  [E] ${p}`); await press('act'); await sleep(250);
  };
  const stalker = () => ev(() => { const s = window.__game.room?.stalker; return s ? { mode: s.mode, wp: s.wp, x: s.pos.x, z: s.pos.z } : null; });
  const waitStalker = (fnSrc, ms = 90000, what) => until(new Function('const s = window.__game.room && window.__game.room.stalker; if (!s) return false; return (' + fnSrc + ')({ mode: s.mode, wp: s.wp, x: s.pos.x, z: s.pos.z })'), ms, what);
  /** Zkus kroky; když hráče chytí (restart místnosti), zkus to znovu. */
  const retry = async (label, n, steps) => {
    for (let i = 1; i <= n; i++) {
      const c0 = await captures();
      try { await steps(i); if ((await captures()) > c0) log(`  ${label}: cestou chycen, ale kroky doběhly`); return; } catch (e) { log(`  ${label}: ${e.message}`); }
      log(`  ${label}: pokus ${i} nevyšel (chycen=${(await captures()) > c0}), znovu`);
      await until(() => window.__game.canMove(), 20000, 'po restartu'); await sleep(500);
    }
    throw new Error(`${label}: nepodařilo se ani na ${n}. pokus`);
  };
  const ctx = { page, log, ev, snap, press, state, until, goto, face, prompt, drain, use, stalker, waitStalker, retry, sleep };
  try {
    await fn(ctx);
  } catch (e) {
    failed = true;
    console.error(`[${name}] SELHAL:`, e.message);
    await snap('chyba');
    console.log(JSON.stringify(await state()));
  }
  fs.writeFileSync(`${OUT}/dialogy.txt`, (await ev(() => window.__game.ui.log)).join('\n'));
  if (errors.length) { failed = true; console.error(`[${name}] CHYBY V KONZOLI:\n` + errors.join('\n')); }
  await page.close();
}

// ------------------------------------------------------------------------- společné kroky
async function bossApproach(c) {
  c.log('BOSS: jdu k baru čelem (má mě odstrčit)');
  await c.ev(() => window.__game.bot.goto(0, 6, { timeout: 6 }));
  const d1 = (await c.state()).pos[1];
  if (d1 > -6) throw new Error(`hádanka nefunguje: čelem jsem došel na z=${d1.toFixed(1)}`);
  c.log(`  čelem jsem se dostal jen na z=${d1.toFixed(1)}; teď zády`);
  await c.snap('boss-ohnuty-prostor');
  await c.ev(() => { window.__game.bot.goto(0, 9.0, { back: true, timeout: 90, tol: 0.5 }); });
  await c.until(() => !!window.__game.ui.dialog, 120000, 'konfrontace');
  await c.sleep(600); await c.snap('ten-kdo-ceka');
  // projdi repliky až k volbě
  for (let i = 0; i < 20; i++) {
    const s = await c.ev(() => ({ d: !!window.__game.ui.dialog, ch: !!window.__game.ui.choiceBox }));
    if (s.ch) break;
    if (s.d) await c.press('act');
    await c.sleep(400);
  }
  await c.snap('rozhodnuti');
}
const choose = async (c, idx) => { for (let i = 0; i < idx; i++) { await c.press('down'); await c.sleep(150); } await c.press('act'); };

// ------------------------------------------------------------------------- PLNÁ HRA → KONEC 1
async function full(c) {
  const { log, snap, press, until, goto, use, drain, state, sleep, ev } = c;
  await sleep(1500); await snap('boot');
  await c.page.keyboard.press('Enter');
  await until(() => window.__game.mode === 'menu', 20000, 'menu');
  await sleep(1500); await snap('menu');
  await press('up'); await sleep(200); await press('act'); await sleep(400); await snap('menu-nova-hra-chyba');
  await press('down'); await sleep(200); await press('act'); await sleep(800); await snap('pametova-karta');
  await press('act'); await sleep(500); await press('act');
  await until(() => window.__game.mode === 'play' && window.__game.roomName === 'hub', 20000, 'hub');
  log('HUB'); await sleep(2500); await snap('hub');

  // král
  await goto(3, -3.5); await goto(1.5, 6); await use(0, 9.3, 0, 12, 'králem');
  await sleep(1500); await snap('kral'); await drain();
  if (!(await state()).flags.talkedKing) throw new Error('rozhovor s králem neproběhl');
  await press('inv'); await sleep(500); await press('act'); await sleep(500); await snap('mapa'); await press('act'); await sleep(200); await press('back'); await sleep(300);
  await goto(-3, -2); await use(-6.9, -0.4, -9.3, -0.4, 'Mluvit'); await sleep(1200); await snap('pekar-1'); await drain();
  await goto(-3, -4.5); await goto(3, -4.5); await use(10.9, -3, 12, -3, 'Dveře II'); await sleep(600); await snap('dvere-II-nenacteno'); await drain();
  await goto(9.5, -8); await use(10.9, -8, 12, -8, 'Otevřít');

  // ---------- LEVEL 1
  await until(() => window.__game.roomName === 'kitchen' && window.__game.canMove(), 15000, 'kuchyň');
  log('LEVEL 1: kuchyně'); await snap('kuchyne');
  for (let i = 1; i <= 2; i++) { await goto(0, 6.6); await use(0, 6.85, 0, 8, 'Projít'); await until((n) => window.__game.state.kitchenLoop === n && window.__game.canMove(), 15000, 'smyčka', i); await sleep(600); }
  await snap('kuchyne-smycka');
  await goto(1.2, -3); await goto(-1, -0.5); await use(-3.9, 0.2, -5, 0.2, 'kresbu'); await sleep(600); await snap('kresba'); await drain();
  await goto(2.6, -0.9); await use(3.1, -0.9, 4.4, -0.9, 'levý'); await sleep(1500);
  await use(3.1, 0, 4.4, 0, 'prostřední'); await sleep(400);
  await use(3.1, 0.9, 4.4, 0.9, 'pravý'); await sleep(400);
  await use(3.1, -0.9, 4.4, -0.9, 'levý');
  await until(() => window.__game.state.flags.stoveSolved && window.__game.canMove(), 15000, 'sporák');
  log('  sporák vyřešen');
  await goto(0.5, 4.6); await use(-2.8, 5.45, -2.8, 7, 'trouby'); await drain();
  await goto(2.6, 4.4); await use(3.38, 5.25, 3.6, 6.4, 'Uložit'); await sleep(500); await press('act');
  await until(() => window.__game.state.saves === 1 && window.__game.canMove(), 20000, 'save 1'); await sleep(1200);
  await goto(-1.2, 3.2); await use(-2.3, 3.2, -3.4, 3.2, 'Mluvit'); await sleep(1800); await snap('pekar-zapomnel'); await drain();
  await goto(0, 5.8); await use(0, 6.85, 0, 8, 'Odemknout');
  await until(() => window.__game.roomName === 'armory', 15000, 'zbrojnice');
  log('  zbrojnice'); await sleep(3500); await snap('zbrojnice-kabat'); await drain(30000);
  await goto(3.8, -8.2); await goto(4.6, -6.2, { tol: 0.3 }); await use(5.3, -6.2, 6.3, -6.2, 'Schovat'); await sleep(1000);
  if (!(await state()).pos) throw new Error(); await snap('skrin'); await press('act'); await sleep(500);
  await c.retry('krystal 1', 6, async () => {
    await goto(3.8, -8.2);
    await c.waitStalker('s => s.mode === "patrol" && s.wp === 2 && s.z < 3 && s.z > 0', 90000, 'kabát na západě');
    const R = { run: true };
    await goto(3.7, -8.2, R); await goto(3.7, -5.4, R); await goto(0, -4.2, R); await goto(0, 6.2, R); await use(0, 7.25, 0, 8.4, 'Krystal');
  });
  await until(() => window.__game.roomName === 'memory', 15000, 'vzpomínka 1'); await sleep(4000); await snap('vzpominka-1');
  await until(() => window.__game.roomName === 'armory' && window.__game.state.flags.escape1, 40000, 'útěk 1');
  await sleep(1200); await snap('memory-card-full');
  await until(() => !!window.__game.ui.sys, 5000, 'hláška'); await sleep(900); await press('act');
  await c.retry('útěk 1', 5, async () => { const R = { run: true }; await goto(-4.6, 7.0, R); await goto(-4.6, -7.6, R); await goto(-3.6, -8.5, R); await goto(0, -9.6, { ...R, timeout: 5 }).catch(() => {}); await until(() => window.__game.state.flags.done1, 4000, 'done1'); });
  await until(() => window.__game.state.ending !== 'x' && (window.__game.ui.overlay && true), 5000, 'loading').catch(() => {});
  await sleep(1500); await snap('loading-99');
  await until(() => window.__game.roomName === 'hub' && window.__game.canMove(), 20000, 'zpět v hubu');
  log('zpět v hubu s krystalem 1');

  // vložit krystal 1
  const deposit = async (n) => {
    await goto(6, 0); await goto(1.5, 6); await use(0, 9.3, 0, 12, 'králem'); await sleep(800); await snap(`koruna-${n}`); await drain();
    const s = await state(); if (s.flags.crown !== n) throw new Error(`koruna má ${s.flags.crown}, čekal jsem ${n}`);
    log(`  krystal ${n} v koruně`);
  };
  await deposit(1);
  await goto(6, 0); await goto(9.5, -3); await use(10.9, -3, 12, -3, 'Otevřít dveře II');

  // ---------- LEVEL 2: kostel
  await until(() => window.__game.roomName === 'church' && window.__game.canMove(), 15000, 'kostel');
  log('LEVEL 2: kostel pod vodou'); await sleep(1500); await snap('kostel');
  await c.retry('zvony', 6, async () => {
    const F = () => ev(() => window.__game.state.flags.gateOpen);
    await c.waitStalker('s => s.mode === "patrol" && s.wp === 2 && s.z > 3', 90000, 'zvoník na západě (sever)');
    await goto(2.5, -9.4); await goto(4.9, -8.0); await use(4.89, -2.5, 6, -2.5, 'zvon 16');
    await goto(4.9, 5.0); await goto(0, 5.3); await goto(-4.9, 5.0); await use(-4.89, 1.5, -6, 1.5, 'zvon 4');
    await goto(-4.9, 5.0); await goto(0, 5.3); await goto(4.9, 5.4); await use(4.89, 4.6, 6, 4.6, 'zvon 7');
    await sleep(1800);
    if (!(await F())) throw new Error('mříž se neotevřela');
    log('  mříž otevřena (16, 4, 7)');
    await snap('mriz-otevrena');
    await goto(1.5, 6.6); await goto(-1.2, 7.9);
    // uložit hru podruhé (pekař přijde o obličej)
    await use(-2.4, 8.7, -2.4, 9.8, 'Uložit'); await sleep(500); await press('act');
    await until(() => window.__game.state.saves === 2 && window.__game.canMove(), 25000, 'save 2');
    await goto(0, 7.8); await use(0, 8.5, 0, 9.6, 'Krystal');
  });
  await until(() => window.__game.roomName === 'memory', 15000, 'vzpomínka 2'); await sleep(5000); await snap('vzpominka-2');
  await until(() => window.__game.roomName === 'church' && window.__game.state.flags.escape2, 45000, 'útěk 2');
  await sleep(1500); await snap('kostel-tma');
  await until(() => window.__game.canMove(), 10000, 'po tmě');
  await c.retry('útěk 2', 6, async () => { const R = { run: true }; await goto(-1.5, 7.0, R); await goto(-5.0, 6.0, R); await goto(-5.0, -9.0, R); await goto(0, -10.6, R); await goto(0, -11.6, { ...R, timeout: 4 }).catch(() => {}); await until(() => window.__game.state.flags.done2, 4000, 'done2'); });
  await until(() => window.__game.roomName === 'hub' && window.__game.canMove(), 25000, 'hub po kostele');
  await goto(-3, -4.5); await goto(-5.5, -0.4); await use(-6.9, -0.4, -9.3, -0.4, 'Mluvit'); await sleep(1800); await snap('pekar-bez-obliceje'); await drain();
  await deposit(2);
  await goto(6, 0); await goto(9.5, 2); await use(10.9, 2, 12, 2, 'Otevřít dveře III');

  // ---------- LEVEL 3: škola
  await until(() => window.__game.roomName === 'school', 15000, 'škola');
  log('LEVEL 3: školní chodba'); await sleep(3000); await snap('skola-ucitelka'); await drain(30000);
  await c.retry('skříňka', 6, async () => {
    // schovej se a nech učitelku projít
    await goto(-0.6, -14.0); await use(-1.3, -14, -2.2, -14, 'Schovat');
    await c.waitStalker('s => s.mode === "patrol" && s.wp === 0 && s.z > 1', 90000, 'učitelka odešla na sever');
    await press('act'); await sleep(400);
    await goto(0, -2.0); await goto(3.2, -2.0); await goto(5.2, -1.4);
    await snap('trida');
    await use(9.3, -1.6, 10.4, -2, 'tabuli'); await drain();
    await c.waitStalker('s => s.mode === "patrol" && s.wp === 1 && s.z < -6', 90000, 'učitelka na jihu');
    await goto(5.2, -1.4); await goto(3.0, -2.0); await goto(0, -1.5); await goto(-0.6, 4.0);
    await use(-1.3, 4, -2.2, 4, 'Tomášova');
    await until(() => !!window.__game.ui.codeBox, 5000, 'zámek');
    for (const [i, d] of [1, 6, 4, 7].entries()) { for (let k = 0; k < d; k++) { await press('up'); await sleep(70); } if (i < 3) { await press('right'); await sleep(70); } }
    await snap('zamek-1647'); await press('act'); await sleep(400); await drain();
    if (!(await state()).inv.includes('propustka')) throw new Error('propustka chybí');
    log('  propustka ze skříňky (1647)');
    await goto(0, 12.3); await use(0, 13.0, 0, 14, 'propustku'); await sleep(600);
    await goto(0, 16); await goto(0, 21.2); await snap('trunni-sal'); await use(0, 21.9, 0, 23, 'Krystal');
  });
  await until(() => window.__game.roomName === 'memory', 15000, 'vzpomínka 3'); await sleep(5000); await snap('vzpominka-3');
  await until(() => window.__game.roomName === 'school' && window.__game.state.flags.escape3, 45000, 'útěk 3');
  await until(() => !!window.__game.ui.sys, 6000, 'ovladač odpojen'); await sleep(300); await snap('ovladac-odpojen'); await sleep(600); await press('act');
  await c.retry('útěk 3', 6, async () => { const R = { run: true }; await goto(0, 15.5, R); await goto(0, -18.6, { ...R, timeout: 30 }); await goto(0, -19.7, { ...R, timeout: 4 }).catch(() => {}); await until(() => window.__game.state.flags.done3, 4000, 'done3'); });
  await until(() => window.__game.roomName === 'hub' && window.__game.canMove(), 25000, 'hub po škole');
  // třetí uložení v hubu (strážný zapomene čas)
  await goto(5.5, -3.5); await use(5.5, -2.1, 5.5, -1, 'Uložit'); await sleep(500); await press('act');
  await until(() => window.__game.state.saves === 3 && window.__game.canMove(), 25000, 'save 3');
  await deposit(3);
  await sleep(4000); await snap('dvere-IV');
  await goto(6, 3); await goto(9.5, 7); await use(10.9, 7, 12, 7, 'Otevřít dveře IV');
  await until(() => window.__game.roomName === 'boss' && window.__game.canMove(), 20000, 'boss');
  log('BOSS'); await sleep(2500); await snap('boss');
  await bossApproach(c);
  await choose(c, 0);
  log('rozhodnutí: DOKONČIT NAČÍTÁNÍ');
  await until(() => window.__game.state.ending === 'e1', 20000, 'konec 1');
  await sleep(14000); await snap('titulky');
  await until(() => window.__game.state.ending === 'e1-done', 90000, 'konec 1 hotový');
  await sleep(1500); await snap('konec-1');
  const s = await state();
  const save = await ev(() => localStorage.getItem('pk-save-name'));
  log(`KONEC 1 OK. uloženo ${s.saves}×, chycen ${s.captures}×, save přejmenován na „${save}“`);
}

// ------------------------------------------------------------------------- KONEC 2
async function e2(c) {
  await c.until(() => window.__game.roomName === 'boss' && window.__game.canMove(), 20000, 'boss');
  await c.sleep(1000);
  await bossApproach(c);
  await choose(c, 1);
  c.log('rozhodnutí: VYPNOUT KONZOLI');
  await c.sleep(300); await c.snap('crt-vypnuti');
  await c.until(() => window.__game.state.flags.epilogue, 15000, 'epilog');
  await c.sleep(6000); await c.snap('epilog-cekani');
  await c.until(() => window.__game.state.ending === 'e2-done', 60000, 'konec 2');
  await c.sleep(2500); await c.snap('konec-2');
  c.log('KONEC 2 OK');
}

// ------------------------------------------------------------------------- KONEC 3 (secret)
async function e3(c) {
  await c.until(() => window.__game.roomName === 'boss' && window.__game.canMove(), 20000, 'boss');
  await c.sleep(1000);
  await c.press('back'); await c.sleep(500); await c.snap('pauza');
  c.log('pauza otevřena, nechávám Wrena v menu (40 s nic nedělám)');
  await c.sleep(30000); await c.snap('pauza-glitch');
  await c.until(() => window.__game.state.ending === 'e3', 30000, 'secret');
  await c.sleep(4500); await c.snap('prejmenovani');
  await c.until(() => window.__game.state.ending === 'e3-msg', 20000, 'vzkaz');
  await c.sleep(12000); await c.snap('vzkaz-tomas');
  await c.until(() => window.__game.state.ending === 'e3-done', 60000, 'konec 3');
  await c.sleep(1000); await c.snap('konec-3');
  const save = await c.ev(() => localStorage.getItem('pk-save-name'));
  const want = os.userInfo().username.toUpperCase();
  if (save !== want) throw new Error(`save se jmenuje „${save}“, čekal jsem „${want}“`);
  c.log(`KONEC 3 OK. Save přejmenován na „${save}“ (uživatel OS)`);
}

if (MODE === 'all' || MODE === 'full') await session('full', '', full);
if (MODE === 'all' || MODE === 'e2') await session('e2', '#skip=boss', e2);
if (MODE === 'all' || MODE === 'e3') await session('e3', '#skip=boss', e3);
await browser.close(); srv.close();
console.log(failed ? 'PLAYTEST: CHYBA' : `PLAYTEST: VŠE PROŠLO (${((Date.now() - t0) / 60000).toFixed(1)} min)`);
process.exitCode = failed ? 1 : 0;
