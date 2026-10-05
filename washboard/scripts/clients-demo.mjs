// Remplit un compte de TEST avec des clients et des rendez-vous crédibles, pour
// voir à quoi ressemblent les écrans quand un laveur a de l'activité.
//
// ────────────────────────────────────────────────────────────────────────────
// À LIRE AVANT DE LANCER
//
// Ce dépôt n'a PAS de séparation base dev / base prod (voir l'en-tête de
// e2e/helpers.ts) : ce script écrit donc dans la VRAIE base. Trois garde-fous,
// repris de la convention des tests E2E :
//
//   1. Il refuse de démarrer sans qu'on lui nomme explicitement le compte visé
//      (son slug). Pas de valeur par défaut : viser le mauvais compte doit être
//      impossible par distraction.
//   2. Tout ce qu'il crée est préfixé « [DEMO] » et utilise des adresses en
//      @demo.invalid (domaine réservé par la RFC 2606, qui ne peut pas exister).
//      Donc repérable d'un coup d'œil et supprimable sans hésiter.
//   3. `--nettoyer` supprime tout ce qu'il a créé, et rien d'autre.
//
// LES AUTOMATISMES SONT NEUTRALISÉS, et ce n'est pas un détail : sans ça, les
// tâches planifiées enverraient de vrais messages aux adresses inventées.
//   - `review_request_sent_at` et `followup_sent_at` sont remplis d'avance : les
//     deux crons filtrent sur `.is(..., null)` et ignorent donc ces lignes
//     (src/app/api/cron/send-reviews, send-followups).
//   - les rendez-vous passés sont créés en `completed` : le rappel du soir
//     (cron rappel-terminer) ne relance que ce qui n'est pas clôturé.
//
// USAGE
//   node scripts/clients-demo.mjs --compte=<slug>
//   node scripts/clients-demo.mjs --compte=<slug> --nettoyer
// ────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ICI = dirname(fileURLToPath(import.meta.url))
const MARQUEUR = '[DEMO]'
const DOMAINE = 'demo.invalid'

// ── lecture de .env.local, sans dépendance ──────────────────────────────────
const env = {}
for (const ligne of readFileSync(join(ICI, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL
const CLE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !CLE) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env.local.')
  process.exit(1)
}

// ── arguments ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const slug = (args.find(a => a.startsWith('--compte=')) ?? '').split('=')[1]
const nettoyer = args.includes('--nettoyer')
if (!slug) {
  console.error('Il faut nommer le compte visé : --compte=<slug>')
  console.error('Le slug est ce qui suit /book/ dans votre lien de réservation.')
  process.exit(1)
}

async function main() {

async function appel(chemin, options = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${chemin}`, {
    ...options,
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${CLE}`,
      'Content-Type': 'application/json',
      Prefer: options.method === 'POST' ? 'return=representation' : 'count=exact',
      ...(options.headers ?? {}),
    },
  })
  const texte = await r.text()
  const corps = texte ? JSON.parse(texte) : null
  if (!r.ok) throw new Error(`${r.status} sur ${chemin} — ${JSON.stringify(corps)}`)
  return corps
}

// ── le compte visé ──────────────────────────────────────────────────────────
const comptes = await appel(`washers?slug=eq.${encodeURIComponent(slug)}&select=id,name,slug`)
if (comptes.length !== 1) {
  console.error(`Aucun compte (ou plusieurs) avec le slug « ${slug} ». Rien n'a été fait.`)
  process.exitCode = 1; return
}
const compte = comptes[0]
console.log(`Compte visé : ${compte.name} (${compte.slug})`)

// ── nettoyage ───────────────────────────────────────────────────────────────
if (nettoyer) {
  const avant = await appel(`bookings?washer_id=eq.${compte.id}&client_name=like.${encodeURIComponent(MARQUEUR + '%')}&select=id`)
  await appel(`bookings?washer_id=eq.${compte.id}&client_name=like.${encodeURIComponent(MARQUEUR + '%')}`, { method: 'DELETE' })
  console.log(`${avant.length} réservation(s) de démonstration supprimée(s). Rien d'autre n'a été touché.`)
  process.exitCode = 0; return
}

// ── les prestations du compte, pour y rattacher les rendez-vous ─────────────
const prestations = await appel(`services?washer_id=eq.${compte.id}&select=id,name,price&order=price.asc`)
if (prestations.length === 0) {
  console.error('Ce compte n\'a aucune prestation : un rendez-vous ne peut pas exister sans elle.')
  console.error('Créez-en au moins une dans « Prestations et prix », puis relancez.')
  process.exitCode = 1; return
}
const presta = (i) => prestations[Math.min(i, prestations.length - 1)]

// ── le jeu de données ───────────────────────────────────────────────────────
const CLIENTS = [
  ['Camille Lefebvre', '06 71 42 18 53', '12 rue Fondaudège, Bordeaux', false, null],
  ['Marc Dubreuil', '06 12 88 40 21', '8 cours de la Marne, Bordeaux', false, null],
  ['Claire Martin', '06 45 90 12 77', '3 rue Sainte-Catherine, Bordeaux', false, null],
  ['Thomas Girard', '06 22 51 63 09', '21 avenue Thiers, Bordeaux', false, null],
  ['Sophie Lambert', '06 84 33 70 12', '5 rue Notre-Dame, Bordeaux', false, null],
  ['Antoine Faure', '06 59 14 28 65', '17 rue de Bègles, Bègles', false, null],
  ['Bastien Leroy', '06 77 02 39 84', '44 cours Victor Hugo, Bordeaux', false, null],
  ['Nathalie Petit', '06 82 14 90 33', '44 av. de Magudas, Mérignac', true, 'Garage Renault Mérignac'],
  ['Lucas Rey', '06 44 90 21 07', 'ZI du Pontet, Pessac', true, 'Garage Renault Mérignac'],
  ['Émilie Vasseur', '06 31 77 55 02', '9 rue Lecocq, Bordeaux', false, null],
  ['Karim Benali', '06 68 41 23 90', '12 quai de Bacalan, Bordeaux', true, 'SARL Dumas Transport'],
  ['Julien Petit', '06 90 12 44 78', '2 place Gambetta, Bordeaux', false, null],
]

const JOUR = 86_400_000
const maintenant = Date.now()
const aJour = (decalage, heure) => {
  const d = new Date(maintenant + decalage * JOUR)
  d.setHours(heure, 0, 0, 0)
  return d.toISOString()
}

// Passés : clôturés, donc hors du rappel du soir. À venir : confirmés ou en attente.
const RDV = [
  { c: 0, j: -28, h: 10, s: 1, statut: 'completed' },
  { c: 1, j: -21, h: 14, s: 0, statut: 'completed' },
  { c: 2, j: -18, h: 9, s: 0, statut: 'completed' },
  { c: 3, j: -14, h: 16, s: 2, statut: 'completed' },
  { c: 5, j: -96, h: 11, s: 0, statut: 'completed' },   // nourrit « À relancer »
  { c: 6, j: -70, h: 15, s: 0, statut: 'completed' },   // idem
  { c: 7, j: -9, h: 17, s: 2, statut: 'completed' },
  { c: 0, j: 0, h: 14, s: 1, statut: 'confirmed' },
  { c: 1, j: 0, h: 16, s: 0, statut: 'confirmed' },
  { c: 7, j: 0, h: 17, s: 2, statut: 'pending' },
  { c: 3, j: 1, h: 9, s: 2, statut: 'confirmed' },
  { c: 4, j: 1, h: 10, s: 0, statut: 'pending' },
  { c: 9, j: 2, h: 11, s: 1, statut: 'confirmed' },
  { c: 11, j: 3, h: 15, s: 0, statut: 'confirmed' },
  { c: 10, j: 4, h: 8, s: 2, statut: 'confirmed' },
]

const traiteLe = new Date(maintenant).toISOString()
const lignes = RDV.map(r => {
  const [nom, tel, adresse, pro, societe] = CLIENTS[r.c]
  const p = presta(r.s)
  return {
    washer_id: compte.id,
    client_name: `${MARQUEUR} ${nom}`,
    client_email: `${nom.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${DOMAINE}`,
    client_phone: tel,
    address: adresse,
    scheduled_at: aJour(r.j, r.h),
    status: r.statut,
    service_id: p.id,
    booked_price: p.price,
    is_professional: pro,
    company_name: societe,
    saisie_par_laveur: true,
    // ⚠️ c'est ce qui empêche les automatismes de partir — voir l'en-tête.
    review_request_sent_at: traiteLe,
    followup_sent_at: traiteLe,
  }
})

const crees = await appel('bookings', { method: 'POST', body: JSON.stringify(lignes) })
console.log(`${crees.length} rendez-vous créés sur ${CLIENTS.length} clients, répartis de -96 jours à +4 jours.`)
console.log('Demandes d\'avis et relances neutralisées : aucun message ne partira.')
console.log(`Pour tout retirer : node scripts/clients-demo.mjs --compte=${slug} --nettoyer`)
}

await main()
