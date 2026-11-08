// Capture image par image de index.html dans Chrome headless (protocole DevTools, sans Puppeteer).
// Chaque image est calculée par rendu(t) avec t = n / 60 : 60 images/s réelles, aucune
// dépendance à l'horloge. Plusieurs onglets travaillent en parallèle ; les images sont remises
// dans l'ordre puis envoyées à ffmpeg.
//
//   node capture.mjs --out ../out/video.mp4 [--jobs 6] [--de 0] [--a 31]
//   node capture.mjs --stills 1.2,4.8,13.9 --dir ../out/stills      (images fixes pour relecture)
//   node capture.mjs --stills 0 --couverture clair --dir ../out/couv  (couverture claire ou sombre)
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ICI = dirname(fileURLToPath(import.meta.url));
// Chrome : variable CHROME si elle est définie, sinon le Chromium de Playwright installé avec washboard
// (npx playwright install chromium). WebSocket : celui de Node (22 ou plus), sans dépendance.
const DEPOT = (d) => (existsSync(join(d, 'washboard', 'package.json')) ? d : DEPOT(dirname(d)));
const require = createRequire(join(DEPOT(ICI), 'washboard', 'package.json'));
const CHROME = process.env.CHROME || require('@playwright/test').chromium.executablePath();

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const FPS = 60;
const JOBS = parseInt(arg('jobs', '6'), 10);

// ── petit serveur statique
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2' };
const serveur = createServer((req, res) => {
  const chemin = join(ICI, decodeURIComponent(req.url.split('?')[0]));
  if (!chemin.startsWith(ICI) || !existsSync(chemin)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream' });
  res.end(readFileSync(chemin));
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const URL_PAGE = `http://127.0.0.1:${serveur.address().port}/index.html?capture${arg('couverture') ? '&couverture=' + arg('couverture') : ''}`;

// ── Chrome
const port = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((ok, ko) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = buf.match(/ws:\/\/[^\s]+/); if (m) ok(m[0]); });
  setTimeout(() => ko(new Error('Chrome ne répond pas')), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, ko) => { ws.addEventListener('open', ok); ws.addEventListener('error', ko); });
let id = 0;
const attente = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && attente.has(msg.id)) { const [ok, ko] = attente.get(msg.id); attente.delete(msg.id); msg.error ? ko(new Error(msg.error.message)) : ok(msg.result); }
});
const cdp = (method, params = {}, sessionId) => new Promise((ok, ko) => { const i = ++id; attente.set(i, [ok, ko]); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

async function onglet() {
  const { targetId } = await cdp('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp('Target.attachToTarget', { targetId, flatten: true });
  await cdp('Page.enable', {}, sessionId);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1080, height: 1920, deviceScaleFactor: 1, mobile: false }, sessionId);
  await cdp('Page.navigate', { url: URL_PAGE }, sessionId);
  for (let k = 0; k < 100; k++) {
    try {
      const r = await cdp('Runtime.evaluate', { expression: 'window.__pret', awaitPromise: true, returnByValue: true }, sessionId);
      if (r.result && r.result.value === true) break;
      if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    } catch (e) { if (k === 99) throw e; }
    await new Promise((ok) => setTimeout(ok, 150));
  }
  return async (t) => {
    const r = await cdp('Runtime.evaluate', { expression: `__image(${t})`, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'erreur de rendu');
    return Buffer.from(r.result.value, 'base64');
  };
}

const pages = await Promise.all(Array.from({ length: JOBS }, onglet));

const stills = arg('stills');
if (stills) {
  const dir = arg('dir', join(ICI, '..', 'out', 'stills'));
  mkdirSync(dir, { recursive: true });
  const ts = stills.split(',').map(Number);
  await Promise.all(ts.map(async (t, k) => {
    const png = await pages[k % JOBS](t);
    writeFileSync(join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`), png);
  }));
  console.log(`${ts.length} images -> ${dir}`);
} else {
  const de = parseFloat(arg('de', '0')), a = parseFloat(arg('a', String(31)));
  const sortie = arg('out', join(ICI, '..', 'out', 'video.mp4'));
  mkdirSync(dirname(sortie), { recursive: true });
  const n0 = Math.round(de * FPS), n1 = Math.round(a * FPS);
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709',
    '-color_trc', 'bt709', '-movflags', '+faststart', '-r', String(FPS), sortie], { stdio: ['pipe', 'inherit', 'inherit'] });
  const pret = new Map();
  let suivant = n0, prochain = n0;
  const debut = Date.now();
  const ecrire = async () => {
    while (pret.has(suivant)) {
      const b = pret.get(suivant); pret.delete(suivant);
      if (!ff.stdin.write(b)) await new Promise((ok) => ff.stdin.once('drain', ok));
      suivant++;
      if (suivant % 120 === 0) process.stdout.write(`\r${suivant - n0}/${n1 - n0} images · ${((Date.now() - debut) / 1000).toFixed(0)} s`);
    }
  };
  let verrou = Promise.resolve();
  await Promise.all(pages.map(async (rendre) => {
    while (prochain < n1) {
      // fenêtre bornée : pas plus de 3×JOBS images en mémoire en attente d'écriture
      while (prochain - suivant > JOBS * 3) await new Promise((ok) => setTimeout(ok, 5));
      const n = prochain++;
      pret.set(n, await rendre(n / FPS));
      verrou = verrou.then(ecrire);
    }
  }));
  await verrou;
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));
  console.log(`\n${n1 - n0} images en ${((Date.now() - debut) / 1000).toFixed(0)} s -> ${sortie}`);
}
ws.close();
chrome.kill();
serveur.close();
process.exit(0);
