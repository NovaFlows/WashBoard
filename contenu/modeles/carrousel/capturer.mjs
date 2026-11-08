// Capture les 8 visuels du carrousel v2 (1080×1350, JPEG qualité 90) + la couverture en thème sombre.
//   node capturer.mjs [--dir <sortie>]
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
// Racine du dépôt WashBoard (dossier qui contient washboard/), où que soit ce script : Playwright vient de washboard.
const DEPOT = (d) => (existsSync(join(d, 'washboard', 'package.json')) ? d : DEPOT(dirname(d)));
const require = createRequire(join(DEPOT(ICI), 'washboard', 'package.json'));
const { chromium } = require('@playwright/test');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const SORTIE = arg('dir', join(ICI, 'rendu'));
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1, locale: 'fr-FR' })).newPage();
await page.goto(pathToFileURL(join(ICI, 'index.html')).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(900);
const slides = await page.locator('.slide').all();
const tirer = async (loc, nom) => { await loc.screenshot({ path: join(SORTIE, nom), type: 'jpeg', quality: 90 }); console.log(nom, (statSync(join(SORTIE, nom)).size / 1024).toFixed(0), 'Ko'); };
for (let i = 0; i < slides.length; i++) await tirer(slides[i], String(i + 1).padStart(2, '0') + '.jpg');
await tirer(slides[0], 'couverture-clair.jpg');
await slides[0].evaluate((s) => s.classList.add('sombre'));
await tirer(slides[0], 'couverture-sombre.jpg');
const debord = await page.evaluate(() => [...document.querySelectorAll('.slide h1, .slide p')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 30)));
console.log(debord.length ? 'DÉBORDEMENT ' + JSON.stringify(debord) : 'aucun débordement');
await navigateur.close();
