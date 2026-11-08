// Pièces détachées des vrais écrans WashBoard pour le carrousel v2 (une par slide, pour varier les visuels) :
// une ligne du catalogue, les options, le total, une demande « En attente » côté laveur, le formulaire d'ajout.
// Données fictives, textes remplacés dans la page uniquement ; rien n'est enregistré.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
// Racine du dépôt WashBoard (dossier qui contient washboard/), où que soit ce script : Playwright vient de washboard.
const DEPOT = (d) => (existsSync(join(d, 'washboard', 'package.json')) ? d : DEPOT(dirname(d)));
const require = createRequire(join(DEPOT(ICI), 'washboard', 'package.json'));
const { chromium } = require('@playwright/test');
const SORTIE = join(ICI, 'ecrans');
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch();
const mobile = await navigateur.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR' });

// Ligne de catalogue : bloc .py-4 autour du bouton radio ; on y écrit nom, prix, description, durée, options.
const editer = (page, nom, l) => page.evaluate(([nom, l]) => {
  const bloc = [...document.querySelectorAll('input[type=radio]')].map((e) => e.closest('label').parentElement).find((b) => b.querySelector('label').textContent.includes(nom));
  if (l.cacher) { bloc.style.display = 'none'; return; }
  const [titre, prix] = bloc.querySelectorAll('label span.font-semibold > span');
  titre.textContent = l.nom; prix.textContent = l.prix;
  bloc.querySelector('label span.mt-1').textContent = l.desc;
  bloc.querySelector('label span.mt-2').textContent = l.duree;
  (l.options ?? []).forEach((o, i) => { const lab = bloc.querySelectorAll('input[type=checkbox]')[i].closest('label');
    lab.querySelector('.flex-1').textContent = o.nom; lab.querySelector('.whitespace-nowrap').textContent = o.prix; });
  bloc.id = 'cible';
}, [nom, l]);
async function reservation(choix) {
  const page = await mobile.newPage();
  await page.route('**/api/**', (r) => r.fulfill({ json: {} }));
  await page.goto((process.env.WB_URL || 'http://localhost:3017') + '/dev/booking-preview');
  await page.getByRole('heading', { name: 'Que faut-il laver ?' }).waitFor();
  await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click();
  await page.getByRole('radio', { name: new RegExp('^' + choix) }).check();
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector('nextjs-portal')?.remove(); document.body.style.paddingBottom = '900px'; });
  return page;
}
// capture d'un élément ; `bord` rogne les filets de séparation en haut et en bas d'une ligne du catalogue
async function piece(page, sel, nom, marge = 14, bord = 0) {
  const b = await page.locator(sel).first().boundingBox();
  await page.screenshot({ path: join(SORTIE, nom + '.png'), clip: { x: Math.max(0, b.x - marge), y: Math.max(0, b.y - marge + bord), width: Math.min(393, b.width + 2 * marge), height: b.height + 2 * marge - 2 * bord } });
}

// 1 · la ligne « Rénovation des phares », choisie
{
  const p = await reservation('Complet');
  await editer(p, 'Complet', { nom: 'Rénovation des phares', desc: 'Ponçage, polissage et vernis anti-UV', prix: '49€', duree: 'Environ 45 min sur place' });
  await p.evaluate(() => window.scrollTo(0, document.querySelector('#cible').getBoundingClientRect().top + window.scrollY - 200));
  await piece(p, '#cible', 'z-phares', 0, 2);
  await p.close();
}

// 3 · 4 · lavage complet + options (protection, puis odeurs) ; et le total en bas de l'écran
for (const [cle, coche, total] of [['z-protection', 0, '135€'], ['z-odeurs', 1, '100€']]) {
  const p = await reservation('Intérieur');
  await p.getByRole('checkbox').nth(coche).check();
  await p.waitForTimeout(300);
  await editer(p, 'Complet', { cacher: true });
  await editer(p, 'Intérieur', { nom: 'Complet', desc: 'Intérieur et extérieur en une seule visite', prix: '75€', duree: 'Environ 2h sur place',
    options: [{ nom: 'Protection céramique', prix: '+60€' }, { nom: 'Traitement des odeurs', prix: '+25€' }] });
  await p.evaluate((t) => {
    const e = [...document.querySelectorAll('p')].find((x) => /^Total estimé/.test(x.textContent));
    e.nextElementSibling.textContent = t;
    e.closest('div.flex').parentElement.id = 'barre';
  }, total);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('#cible').getBoundingClientRect().top + window.scrollY - 100));
  await piece(p, '#cible', cle, 0, 2);
  await piece(p, '#barre', cle + '-total', 0);
  await p.close();
}

// 5 · côté laveur : la demande arrive « En attente » dans « À confirmer » (/demo)
{
  const p = await (await navigateur.newContext({ viewport: { width: 393, height: 798 }, deviceScaleFactor: 3, isMobile: true, locale: 'fr-FR' })).newPage();
  await p.clock.setFixedTime(new Date('2026-11-05T10:00:00+01:00'));
  await p.goto((process.env.WB_URL || 'http://localhost:3017') + '/demo');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1500);
  await p.evaluate(() => {
    const titre = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && e.textContent.trim() === 'À confirmer');
    const section = titre.closest('section');
    section.id = 'demande';
    const r = { '3 nov.': '12 nov.', 'Sophie Lambert': 'Sarah Benali', 'Extérieur express': 'Préparation revente', '35 €': '149 €', 'À clôturer': 'En attente' };
    const m = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    for (let n = m.nextNode(); n; n = m.nextNode()) { const v = n.nodeValue.trim(); if (r[v]) n.nodeValue = n.nodeValue.replace(v, r[v]); }
    titre.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(400);
  await piece(p, '#demande', 'z-demande', 12);
  await p.close();
}

// 6 · le formulaire « Ajouter une prestation » du laveur, rempli au clavier (banc /banc-prestations), sans enregistrer
{
  const p = await (await navigateur.newContext({ viewport: { width: 520, height: 1400 }, deviceScaleFactor: 3, locale: 'fr-FR' })).newPage();
  await p.goto((process.env.WB_URL || 'http://localhost:3017') + '/banc-prestations');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(1000);
  await p.evaluate(() => { document.querySelector('#neuf')?.remove(); document.querySelectorAll('p.text-xs.uppercase').forEach((x) => x.remove()); });
  await p.locator('#configure button', { hasText: '+ Ajouter une prestation' }).click();
  await p.waitForTimeout(500);
  const form = p.locator('#configure input[placeholder="Lavage intérieur + extérieur"]').locator('xpath=ancestor::div[3]');
  const nom = form.locator('input[placeholder="Lavage intérieur + extérieur"]');
  await nom.click();
  await nom.type('Rénovation des phares', { delay: 10 });
  await form.locator('input[placeholder="80"]').first().fill('49');
  await form.locator('input[placeholder="90"]').first().fill('45');
  await p.evaluate(() => document.activeElement?.blur());
  await form.evaluate((f) => { const lab = [...f.querySelectorAll('label')].find((l) => l.textContent.startsWith('Description')); lab.parentElement.style.display = 'none'; f.style.background = '#fff'; f.querySelectorAll('*').forEach((e) => { if (getComputedStyle(e).backgroundColor === getComputedStyle(f).backgroundColor) e.style.background = '#fff'; }); });
  await p.evaluate(() => { document.body.style.background = '#fff'; });
  await p.waitForTimeout(300);
  const b1 = await form.locator('label', { hasText: 'Nom de la prestation' }).boundingBox();
  const b2 = await form.locator('input[placeholder="90"]').first().boundingBox();
  await p.screenshot({ path: join(SORTIE, 'z-formulaire.png'), clip: { x: b1.x - 16, y: b1.y - 14, width: b2.x + b2.width - b1.x + 32, height: b2.y + b2.height - b1.y + 28 } });
  await p.close();
}
await navigateur.close();
console.log('ok');
