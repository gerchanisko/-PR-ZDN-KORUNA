import puppeteer from 'puppeteer-core';
import { startServer } from '../serve.js';
const srv = await startServer(8052);
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8052/#skip=' + (process.argv[2] || 'armory'));
await new Promise(r => setTimeout(r, 4000));
console.log(await p.evaluate(() => window.__game.room.colliders.map(c => [c.x0, c.z0, c.x1, c.z1].map(v => v.toFixed(2)).join(' ')).join('\n')));
await b.close(); srv.close();
