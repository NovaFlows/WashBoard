// Journal commun des posts de @washboard.fr (contenu/publications.json), partagé par Git entre les
// routines d'Alexandre et de Ryan : un seul post par jour, jamais un sujet déjà traité, couverture
// claire / sombre en alternance d'un post à l'autre, quel que soit celui qui publie.
//
//   node contenu/outils/journal.mjs etat [--date AAAA-MM-JJ]
//        -> {"date", "du_jour": [...], "prochain_theme": "clair|sombre", "dernier": {...}}
//   node contenu/outils/journal.mjs reserver --date AAAA-MM-JJ --personne ryan --type reel --sujet "…"
//        -> réserve le jour ; refusé (code 2) si quelqu'un d'autre l'a déjà réservé ou y a publié
//   node contenu/outils/journal.mjs publier --date AAAA-MM-JJ --personne ryan --type reel --sujet "…" --theme sombre [--liens '{"instagram":"…"}']
//   node contenu/outils/journal.mjs annuler --date AAAA-MM-JJ --personne ryan        (retire une réservation)
//   node contenu/outils/journal.mjs sujets          -> tous les sujets déjà traités ou réservés
//   node contenu/outils/journal.mjs noms --ajouter "Prénom Nom,Autre Nom"            (noms fictifs utilisés)
//
// Chaque commande commence par « git pull --ff-only » ; chaque écriture fait un commit qui ne contient
// QUE contenu/publications.json, puis « git push ». Ajoute --sans-git pour travailler hors ligne.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const DEPOT = (d) => (existsSync(join(d, 'washboard', 'package.json')) ? d : DEPOT(dirname(d)));
const RACINE = DEPOT(ICI);
const FICHIER = join(RACINE, 'contenu', 'publications.json');
const REL = 'contenu/publications.json';

const [, , commande, ...reste] = process.argv;
const arg = (n, d) => { const i = reste.indexOf('--' + n); return i > -1 ? reste[i + 1] : d; };
const sansGit = reste.includes('--sans-git');
const sortie = (o) => process.stdout.write(JSON.stringify(o, null, 2) + '\n');
const stop = (msg, code = 1) => { process.stderr.write(msg + '\n'); process.exit(code); };
const git = (...a) => execFileSync('git', a, { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function tirer() {
  if (sansGit) return true;
  try {
    const branche = git('branch', '--show-current');
    if (branche !== 'master') { process.stderr.write(`Branche « ${branche} » et pas master : journal lu sans mise à jour.\n`); return false; }
    git('pull', '--ff-only', '--quiet', 'origin', 'master');
    return true;
  } catch (e) { process.stderr.write(`git pull impossible (${String(e.stderr || e.message).trim()}) : journal local.\n`); return false; }
}
function pousser(message) {
  if (sansGit) return;
  try {
    git('add', REL);
    git('commit', '--quiet', '-m', message, '--', REL);
    git('push', '--quiet', 'origin', 'master');
  } catch (e) { stop(`Journal écrit en local mais pas partagé (${String(e.stderr || e.message).trim()}). Relance plus tard : git push.`); }
}
const lire = () => JSON.parse(readFileSync(FICHIER, 'utf8'));
const ecrire = (j) => writeFileSync(FICHIER, JSON.stringify(j, null, 2) + '\n', 'utf8');
const aujourdhui = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const inverse = (t) => (t === 'clair' ? 'sombre' : 'clair');
function dernierAvecTheme(j) {
  return [...j.publications].filter((p) => p.statut === 'publie' && p.theme_couverture).sort((a, b) => a.date.localeCompare(b.date)).pop();
}

const ecritures = new Set(['reserver', 'publier', 'annuler', 'noms']);
if (!commande || !['etat', 'sujets', ...ecritures].includes(commande)) stop('Commande : etat | reserver | publier | annuler | sujets | noms');
const aJour = tirer();
if (ecritures.has(commande) && !aJour && !sansGit) stop('Écriture refusée : le journal n\'a pas pu être mis à jour depuis GitHub (voir ci-dessus).');
const j = lire();
const date = arg('date', aujourdhui());
const personne = (arg('personne', '') || '').toLowerCase();

if (commande === 'etat') {
  const d = dernierAvecTheme(j);
  sortie({ date, du_jour: j.publications.filter((p) => p.date === date), prochain_theme: d ? inverse(d.theme_couverture) : 'clair', dernier: d || null, journal_a_jour: aJour });
} else if (commande === 'sujets') {
  sortie({ avant_le_2026_11_02: j.sujets_avant_le_2026_11_02, publications: j.publications.map((p) => `${p.date} ${p.statut} (${p.personne}) : ${p.sujet}`) });
} else if (commande === 'noms') {
  const nouveaux = (arg('ajouter', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!nouveaux.length) { sortie(j.noms_fictifs_utilises); process.exit(0); }
  const deja = nouveaux.filter((n) => j.noms_fictifs_utilises.includes(n));
  if (deja.length) stop(`Noms déjà utilisés dans une vidéo précédente : ${deja.join(', ')}`, 2);
  j.noms_fictifs_utilises.push(...nouveaux); ecrire(j); pousser(`contenu: noms fictifs ${nouveaux.join(', ')}`);
  sortie({ ajoutes: nouveaux });
} else {
  if (!personne) stop('Précise --personne alexandre|ryan');
  const autre = j.publications.find((p) => p.date === date && p.personne !== personne && ['prevu', 'publie'].includes(p.statut));
  const mien = j.publications.find((p) => p.date === date && p.personne === personne);
  if (commande === 'annuler') {
    if (!mien || mien.statut !== 'prevu') stop('Rien à annuler : pas de réservation à ton nom ce jour-là.', 2);
    j.publications.splice(j.publications.indexOf(mien), 1); ecrire(j); pousser(`contenu: ${personne} libère le ${date}`);
    sortie({ annule: date });
  } else {
    if (autre) stop(`Le ${date} est déjà pris par ${autre.personne} (${autre.statut} : ${autre.sujet}). Un seul post par jour.`, 2);
    const sujet = arg('sujet'); const type = arg('type');
    if (!sujet || !type) stop('Précise --sujet "…" et --type reel|carrousel|post');
    const entree = mien || { date, personne };
    Object.assign(entree, { statut: commande === 'reserver' ? 'prevu' : 'publie', type, sujet });
    if (commande === 'publier') {
      const theme = arg('theme'); if (!['clair', 'sombre'].includes(theme)) stop('Précise --theme clair|sombre (la couverture utilisée)');
      entree.theme_couverture = theme;
      entree.liens = JSON.parse(arg('liens', '{}'));
    }
    if (!mien) j.publications.push(entree);
    j.publications.sort((a, b) => a.date.localeCompare(b.date));
    ecrire(j); pousser(`contenu: ${commande === 'reserver' ? 'réservation' : 'publication'} du ${date} (${personne})`);
    sortie(entree);
  }
}
