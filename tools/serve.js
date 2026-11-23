// Minimální statický server bez závislostí. `node tools/serve.js [--open] [--port N]`
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || 8047;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

export function startServer(p = port) {
  const srv = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/api/player') { // jméno uživatele OS pro secret konec (prohlížeč ho sám nezjistí)
      let name = 'HRÁČ';
      try { name = os.userInfo().username || name; } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ name }));
    }
    if (url === '/') url = '/index.html';
    const file = path.join(root, path.normalize(url));
    if (!file.startsWith(root) || url.includes('node_modules')) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(data);
    });
  });
  return new Promise((res, rej) => { srv.once('error', rej); srv.listen(p, '127.0.0.1', () => res(srv)); });
}

/** Běží už na portu tahle hra? */
async function isOurGame(p) {
  try { const r = await fetch(`http://127.0.0.1:${p}/`); return (await r.text()).includes('PRÁZDNÁ KORUNA'); } catch { return false; }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  let p = port, reused = false;
  for (;;) {
    try { await startServer(p); break; } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
      if (await isOurGame(p)) { reused = true; break; }
      if (++p > port + 20) throw e;
    }
  }
  const url = `http://127.0.0.1:${p}/`;
  console.log(reused ? `Hra už běží na ${url} – jen otevírám okno.` : `PRÁZDNÁ KORUNA běží na ${url}  (Ctrl+C ukončí)`);
  if (args.includes('--open')) {
    const browsers = ['chromium', 'google-chrome-stable', 'google-chrome', 'brave', 'firefox'];
    const which = b => { try { return fs.statSync(`/usr/bin/${b}`).isFile(); } catch { return false; } };
    const b = browsers.find(which);
    if (b && b !== 'firefox') spawn(b, [`--app=${url}`, '--window-size=1280,960', '--autoplay-policy=no-user-gesture-required'], { stdio: 'ignore', detached: true }).unref();
    else if (b) spawn(b, ['--new-window', url], { stdio: 'ignore', detached: true }).unref();
    else spawn('xdg-open', [url], { stdio: 'ignore', detached: true }).unref();
  }
}
