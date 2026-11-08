// Version TikTok du carrousel (mode photo, 1080×1920) : la même mise en page que les slides 4:5, réduite, calée à
// gauche et descendue de DECALAGE px, pour que rien d'important ne passe sous la légende de TikTok (bas de
// l'écran) ni sous sa colonne de boutons (à droite). Sorties : tiktok-01.jpg… + tiktok-couverture-clair.jpg / -sombre.jpg.
//   node capturer-tiktok.mjs [--dir <sortie>]
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
const DECALAGE = 170;
const ECHELLE = 0.87;
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ viewport: { width: 1200, height: 2100 }, deviceScaleFactor: 1, locale: 'fr-FR' })).newPage();
await page.goto(pathToFileURL(join(ICI, 'index.html')).href);
await page.evaluate(() => document.fonts.ready);
// Le contenu de la slide 4:5 passe dans un cadre de 1080×1350 réduit à ECHELLE et calé à gauche : la colonne de
// boutons de TikTok (≈ 130 px à droite) reste libre, et les stickers ancrés en bas du cadre débordent en entier.
await page.evaluate(([dec, ech]) => {
  for (const s of document.querySelectorAll('.slide')) {
    const cadre = document.createElement('div');
    cadre.style.cssText = `position:absolute; left:0; top:0; width:1080px; height:1350px; padding:72px 72px 0; transform:translate(0, ${dec}px) scale(${ech}); transform-origin:0 0`;
    cadre.append(...s.children);
    s.append(cadre);
    s.style.height = '1920px';
    s.style.padding = '0';
  }
}, [DECALAGE, ECHELLE]);
await page.waitForTimeout(900);
const slides = await page.locator('.slide').all();
const tirer = async (loc, nom) => { await loc.screenshot({ path: join(SORTIE, nom), type: 'jpeg', quality: 90 }); console.log(nom, (statSync(join(SORTIE, nom)).size / 1024).toFixed(0), 'Ko'); };
for (let i = 0; i < slides.length; i++) await tirer(slides[i], 'tiktok-' + String(i + 1).padStart(2, '0') + '.jpg');
await tirer(slides[0], 'tiktok-couverture-clair.jpg');
await slides[0].evaluate((s) => s.classList.add('sombre'));
await tirer(slides[0], 'tiktok-couverture-sombre.jpg');
await navigateur.close();
