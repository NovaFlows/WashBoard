// Reel « Un garage te confie 3 véhicules ? » — côté laveur, VRAIS écrans de /demo (jeu de données fictif en
// mémoire, routes /api/** interceptées, rien n'est écrit) en plein écran sous la barre d'état (393×798, ×3) :
//   d1 : l'accueil, section « À confirmer » avec la demande du garage (textes remplacés à l'écran seulement)
//   d2 : Documents, la facture du garage en tête de liste
//   node capturer-demo.mjs [--sonde]
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ICI = dirname(fileURLToPath(import.meta.url));
// Racine du dépôt WashBoard (dossier qui contient washboard/), où que soit ce script : Playwright vient de washboard.
const DEPOT = (d) => (existsSync(join(d, 'washboard', 'package.json')) ? d : DEPOT(dirname(d)));
const require = createRequire(join(DEPOT(ICI), 'washboard', 'package.json'));
const { chromium } = require('@playwright/test');
const SORTIE = join(ICI, 'ecrans'); mkdirSync(SORTIE, { recursive: true });
const URL = process.env.WB_URL || 'http://localhost:3017';
const SONDE = process.argv.includes('--sonde');
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 393, height: 798 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR' });
const p = await ctx.newPage();
await p.route('**/api/**', (r) => r.fulfill({ json: {} }));
await p.goto(URL + '/demo', { timeout: 180000 });
await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
const positions = {};
const prep = () => p.evaluate(() => {
  document.querySelector('nextjs-portal')?.remove();
  // bandeau d'annonce des offres et barre « État » de la démo : hors champ (ce n'est pas l'appli d'un laveur)
  for (const e of document.querySelectorAll('*')) {
    if (e.children.length === 0 && /^(NOUVEAU|Voir les offres →)$/.test(e.textContent.trim())) { const b = e.closest('div[class*="border"], aside, section, div'); if (b) b.closest('div').style.display = 'none'; }
  }
});
const remplacer = (racine, r) => p.evaluate(([sel, r]) => {
  const el = typeof sel === 'string' ? document.querySelector(sel) : document.body;
  const m = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = m.nextNode(); n; n = m.nextNode()) { const v = n.nodeValue.trim(); if (r[v] !== undefined) n.nodeValue = n.nodeValue.replace(v, r[v]); }
}, [racine, r]);

// d1 · « À confirmer »
await prep();
await p.evaluate(() => {
  const titre = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'À confirmer');
  const section = titre.closest('section'); section.id = 'aconfirmer';
  section.querySelector('a, button, li')?.setAttribute('data-carte', '1');
  window.scrollBy(0, titre.getBoundingClientRect().top - 330);
});
await remplacer(null, { 'Garage Renault Mérignac': 'Garage du Lac', 'Garage Renault Mérign…': 'Garage du Lac' });
await p.evaluate(() => { const m = document.createTreeWalker(document.querySelector('#aconfirmer'), NodeFilter.SHOW_TEXT); for (let n = m.nextNode(); n; n = m.nextNode()) n.nodeValue = n.nodeValue.replace(/Dim\.\s8/, 'Sam. 7'); });
await remplacer('#aconfirmer', { 'Sophie Lambert': 'Yasmine Haddad', 'Extérieur express': 'Extérieur · 3 utilitaires', '35 €': '105 €', 'À clôturer': 'En attente', 'Dim. 8': 'Sam. 7' });
await p.waitForTimeout(400);
if (SONDE) console.log(await p.locator('#aconfirmer').innerText());
await p.screenshot({ path: join(SORTIE, 'd1-a-confirmer.png') });
const b = await p.locator('#aconfirmer [data-carte]').first().boundingBox();
positions.carte = b && { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) };

// d2 · Documents
await p.getByRole('button', { name: 'Documents' }).or(p.getByRole('link', { name: 'Documents' })).first().click();
await p.waitForTimeout(1800);
await prep();
await p.locator('button', { hasText: /^Factures$/ }).first().click().catch((e) => console.log('pas de filtre', e.message));
await p.evaluate(() => { const j = [...document.querySelectorAll('p, div, span')].find((e) => e.children.length === 0 && e.textContent.startsWith('Jeu de données fabriqué')); if (j) { let c = j.parentElement; while (c && !c.querySelector('a, button')) c = c.parentElement; (c || j).style.display = 'none'; j.style.display = 'none'; } });
await p.waitForTimeout(800);
await remplacer(null, { 'Moreau Auto Détailing': 'Garage des Tilleuls' });
await p.evaluate(() => {
  const nom = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'Garage des Tilleuls');
  let ligne = nom.parentElement; while (ligne && !(/F-00047/.test(ligne.textContent) && /120,00/.test(ligne.textContent))) ligne = ligne.parentElement;
  const subs = [[/F-00047/, 'F-00048'], [/5 nov\. 2026/, '8 nov. 2026'], [/120,00/, '105,00']];
  const m = document.createTreeWalker(ligne, NodeFilter.SHOW_TEXT);
  for (let n = m.nextNode(); n; n = m.nextNode()) for (const [a, b] of subs) n.nodeValue = n.nodeValue.replace(a, b);
  const m2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = m2.nextNode(); n; n = m2.nextNode()) n.nodeValue = n.nodeValue.replace(/601,00/, '586,00');
});
await p.evaluate(() => { const h = [...document.querySelectorAll('h1, h2')].find((e) => e.textContent.trim() === 'Devis et factures'); window.scrollBy(0, h.getBoundingClientRect().top - 20); });
await p.waitForTimeout(300);
if (SONDE) console.log('===== DOCUMENTS\n' + (await p.locator('body').innerText()).slice(0, 2500));
await p.screenshot({ path: join(SORTIE, 'd2-documents.png') });
writeFileSync(join(SORTIE, 'positions-demo.json'), JSON.stringify(positions, null, 1));
console.log(positions);
await nav.close();
