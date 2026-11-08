// Reel « Un garage te confie 3 véhicules ? » — VRAIS écrans de la page de réservation (/dev/booking-preview,
// API simulées, aucune réservation réelle), zone visible de Safari (393×700, ×3) : 3 utilitaires dans une seule
// réservation, puis « Je réserve pour une entreprise » + nom de l'entreprise + SIRET. Données fictives.
// Relève la position (en points) des éléments touchés -> ecrans/positions-resa.json.
//   node capturer-resa.mjs
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
const BASE = process.env.WB_URL || 'http://localhost:3017';
const SORTIE = join(ICI, 'ecrans');
mkdirSync(SORTIE, { recursive: true });

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 393, height: 700 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+01:00'));
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let body = {};
  if (url.pathname === '/api/zone/check') body = { allowed: true };
  if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] };
  if (url.pathname === '/api/travel-fee') body = { fee: 0 };
  if (url.pathname === '/api/slots/smart') body = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 };
  if (url.pathname === '/api/bookings') body = { data: { id: '00000000-0000-4000-8000-000000000099', booked_price: 135 } };
  await route.fulfill({ json: body });
});
const pause = (ms) => page.waitForTimeout(ms);
const nettoyer = () => page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
const photo = async (nom) => { await nettoyer(); await page.screenshot({ path: join(SORTIE, `${nom}.png`) }); console.log('photo', nom); };
const positions = {};
async function noter(cle, loc) {
  const b = await loc.boundingBox();
  positions[cle] = b && { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), w: Math.round(b.width), h: Math.round(b.height) };
}
// fait défiler pour que l'élément soit à `y` points du haut de la zone visible
const amener = (loc, y) => loc.evaluate((e, y) => window.scrollBy(0, e.getBoundingClientRect().top - y), y);

await page.goto(`${BASE}/dev/booking-preview`, { timeout: 180000 });
await page.getByRole('heading', { name: 'Que faut-il laver ?' }).waitFor({ timeout: 180000 });
await pause(800);
await photo('r1-accueil');
const utilitaire = page.getByLabel('Type de véhicule').getByRole('button', { name: 'Utilitaire', exact: true });
await noter('r1.utilitaire', utilitaire);
await utilitaire.click();
await pause(900);
const plus = page.getByRole('button', { name: 'Ajouter un véhicule (utilitaire)' });
await amener(page.getByLabel('Type de véhicule'), 24);
await pause(500);
await photo('r2-un');
await noter('r2.plus', plus);
await plus.click(); await pause(450);
await photo('r3-deux');
await plus.click(); await pause(450);
await photo('r4-trois');
await noter('r4.compteur', page.getByText('Nombre de véhicules').first());
const exterieur = page.getByRole('radio', { name: /^Extérieur/ });
await amener(page.getByText('Nombre de véhicules').first(), 120);
await pause(400);
await noter('r5.exterieur', exterieur);
await exterieur.check();
await pause(600);
await photo('r5-exterieur');
await noter('r5.continuer', page.getByTestId('booking-continue'));
console.log('prix :', await page.locator('body').innerText().then((t) => (t.match(/Prix pour[^\n]*/) || [''])[0]));
await page.getByTestId('booking-continue').click();
await pause(700);
await page.getByLabel('Adresse du lavage').fill('8 avenue Berthelot, 69007 Lyon');
await page.getByRole('button', { name: /dimanche 8 novembre/i }).click();
await pause(700);
const dix = page.getByRole('button', { name: /^9 h|^10 h/ }).first();
await dix.click();
await pause(500);
await photo('r6-creneau');
await page.getByTestId('booking-continue').click();
await pause(700);
await page.getByLabel('Nom et prénom').fill('Yasmine Haddad');
await page.getByLabel('Téléphone', { exact: true }).fill('0612345678');
await page.getByLabel(/^Email/).fill('atelier@garage-des-tilleuls.example');
const modeles = ['Renault Trafic blanc', 'Renault Trafic blanc', 'Peugeot Expert gris'];
for (let i = 0; i < 3; i++) await page.locator(`#booking-model-${i}`).fill(modeles[i]);
const caseEntreprise = page.getByText('Je réserve pour une entreprise');
await amener(caseEntreprise, 330);
await pause(400);
await photo('r7-contact');
await noter('r7.entreprise', caseEntreprise);
await caseEntreprise.click();
await pause(500);
await photo('r8-case');
await page.locator('#booking-company').fill('Garage des Tilleuls');
await page.locator('#booking-siret').fill('83245917600027');
await page.evaluate(() => document.activeElement?.blur());
await amener(page.locator('#booking-company'), 200);
await pause(500);
await photo('r9-entreprise');
await noter('r9.entreprise', page.locator('#booking-company'));
await noter('r9.siret', page.locator('#booking-siret'));
await noter('r9.continuer', page.getByTestId('booking-continue'));
await page.getByTestId('booking-continue').click();
await page.getByRole('heading', { name: 'Réservation envoyée !' }).waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await pause(800);
await photo('r10-envoyee');
writeFileSync(join(SORTIE, 'positions-resa.json'), JSON.stringify(positions, null, 1));
console.log(positions);
await nav.close();
