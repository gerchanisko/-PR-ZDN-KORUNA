// Vyrenderuje náhled assetů do docs/preview.png (headless Chromium).
import puppeteer from 'puppeteer-core';
import { startServer } from './serve.js';
import fs from 'node:fs';
const srv = await startServer(8048);
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 1800, height: 1000 });
const errs = [];
page.on('console', m => { if (['error', 'warn'].includes(m.type())) errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
await page.goto('http://127.0.0.1:8048/preview.html');
await page.waitForFunction('window.__ready', { timeout: 20000 }).catch(() => {});
await new Promise(r => setTimeout(r, 1500));
fs.mkdirSync('docs', { recursive: true });
await page.screenshot({ path: 'docs/preview.png' });
console.log(errs.length ? 'CHYBY:\n' + errs.join('\n') : 'OK bez chyb');
await browser.close(); srv.close();
