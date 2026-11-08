// Carrousel du 3 novembre (v2) : la VRAIE page de réservation de WashBoard (/dev/booking-preview, API simulées,
// laveur fictif « Brillance Mobile »), telle que le client la voit sur iPhone (393×852, ×3).
// Les lignes du catalogue d'exemple sont renommées dans la page (rien n'est enregistré, le dépôt n'est pas modifié).
// Prérequis : `BOOKING_UI_PREVIEW=1 next dev --port 3017` lancé dans washboard/.
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
const contexte = await navigateur.newContext({
  viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});

// Une ligne du catalogue, telle que l'affiche BookingForm.
const PHARES = { nom: 'Rénovation des phares', desc: 'Ponçage, polissage et vernis anti-UV', prix: '49€', duree: 'Environ 45 min sur place' };
const SHAMPOO = { nom: 'Shampouinage sièges & moquettes', desc: 'Injection-extraction, détachage, séchage', prix: '69€', duree: 'Environ 1h30 sur place' };
const REVENTE = { nom: 'Préparation revente ou leasing', desc: 'Intérieur, extérieur, taches, phares : prête à rendre', prix: '149€', duree: 'Environ 3h sur place' };

async function ouvrir(choix) {
  const page = await contexte.newPage();
  await page.clock.setFixedTime(new Date('2026-11-05T10:00:00+01:00'));
  await page.route('**/api/**', (r) => r.fulfill({ json: {} }));
  await page.goto((process.env.WB_URL || 'http://localhost:3017') + '/dev/booking-preview');
  await page.getByRole('heading', { name: 'Que faut-il laver ?' }).waitFor();
  await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click();
  if (choix) await page.getByRole('radio', { name: new RegExp('^' + choix) }).check();
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
  return page;
}

// Réécrit une ligne du catalogue (le bloc .py-4 qui entoure le bouton radio) : nom, prix, description, durée,
// et éventuellement ses options [{ nom, prix }].
const editer = (page, nom, l) => page.evaluate(([nom, l]) => {
  const bloc = [...document.querySelectorAll('input[type=radio]')].map((e) => e.closest('label').parentElement).find((b) => b.querySelector('label').textContent.includes(nom));
  const [titre, prix] = bloc.querySelectorAll('label span.font-semibold > span');
  if (l.cacher) { bloc.style.display = 'none'; return; }
  titre.textContent = l.nom; prix.textContent = l.prix;
  bloc.querySelector('label span.mt-1').textContent = l.desc;
  bloc.querySelector('label span.mt-2').textContent = l.duree;
  (l.options ?? []).forEach((o, i) => { const lab = bloc.querySelectorAll('input[type=checkbox]')[i].closest('label');
    lab.querySelector('.flex-1').textContent = o.nom; lab.querySelector('.whitespace-nowrap').textContent = o.prix; });
}, [nom, l]);
const total = (page, t) => page.evaluate((t) => { const p = [...document.querySelectorAll('p')].find((e) => /^Total estimé/.test(e.textContent)); p.nextElementSibling.textContent = t; }, t);

// Fait défiler la page pour que le titre « La prestation » arrive en haut de l'écran (sous la barre d'état).
async function cadrer(page, ligne, marge = 14) {
  await page.evaluate(([ligne, marge]) => {
    document.body.style.paddingBottom = '900px'; // sinon la page est trop courte pour défiler jusque-là
    const t = ligne ? [...document.querySelectorAll('input[type=radio]')].map((e) => e.closest('label')).find((l) => l.textContent.includes(ligne))
      : [...document.querySelectorAll('h2, h3, p, span')].find((e) => e.textContent.trim() === 'La prestation');
    window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - marge);
  }, [ligne, marge]);
  await page.waitForTimeout(300);
}
const photo = (page, nom) => page.screenshot({ path: join(SORTIE, `${nom}.png`) });

// 2 — Le catalogue d'aujourd'hui : lavage extérieur, intérieur, complet. Rien de choisi.
{ const p = await ouvrir(); await cadrer(p); await photo(p, 'c0-aujourdhui'); await p.close(); }

// 3, 4, 7 — une nouvelle prestation à part entière, à la place de « Complet », choisie par le client.
for (const [cle, l] of [['c1-phares', PHARES], ['c2-shampouinage', SHAMPOO], ['c5-revente', REVENTE]]) {
  const p = await ouvrir('Complet');
  await editer(p, 'Complet', l); await total(p, l.prix);
  await cadrer(p); await photo(p, cle); await p.close();
}

// 5, 6 — en option d'un lavage complet : la case « En plus, si besoin » cochée.
const COMPLET = { nom: 'Complet', desc: 'Intérieur et extérieur en une seule visite', prix: '75€', duree: 'Environ 2h sur place',
  options: [{ nom: 'Protection céramique', prix: '+60€' }, { nom: 'Traitement des odeurs', prix: '+25€' }] };
for (const [cle, coche, t] of [['c3-protection', 0, '135€'], ['c4-odeurs', 1, '100€']]) {
  const p = await ouvrir('Intérieur');
  await p.getByRole('checkbox').nth(coche).check();
  await p.waitForTimeout(300);
  await editer(p, 'Complet', { cacher: true });
  await editer(p, 'Intérieur', COMPLET); await total(p, t);
  await cadrer(p); await photo(p, cle); await p.close();
}

// 8 — Le catalogue après : les trois lavages + trois nouvelles prestations.
{
  const p = await ouvrir();
  await p.evaluate(() => {
    const modele = [...document.querySelectorAll('input[type=radio]')].map((e) => e.closest('label').parentElement).find((b) => b.textContent.includes('Complet'));
    for (const n of ['A3', 'A2', 'A1']) { const c = modele.cloneNode(true); c.querySelector('input').checked = false; c.querySelector('label span.font-semibold > span').textContent = n; modele.after(c); }
  });
  await editer(p, 'A1', PHARES); await editer(p, 'A2', SHAMPOO); await editer(p, 'A3', REVENTE);
  await cadrer(p, 'Complet', 24); await photo(p, 'c6-catalogue'); await p.close();
}
await navigateur.close();
console.log('ok');
