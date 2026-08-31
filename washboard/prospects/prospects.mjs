#!/usr/bin/env node
// Fichier de prospection WashBoard — ajout et consultation des prospects.
//
// Le fichier Excel vit ici, dans un dossier NON versionné : il contient des
// données personnelles (numéros, noms) qui n'ont rien à faire sur GitHub.
//
// ⚠️ Ce que ce fichier a le droit de contenir : des coordonnées
// PROFESSIONNELLES publiques (numéro affiché sur une fiche Google, un site, une
// bio Instagram) et ce qu'on en déduit pour préparer un appel. Rien d'autre —
// pas de donnée personnelle sensible, pas d'information obtenue en contournant
// un profil privé.
//
// Conservation : un prospect passé en « pas intéressé » doit le rester, et sa
// ligne n'a plus vocation à être exploitée. À revoir avec l'agent `legal` si ce
// fichier devient le vrai outil de suivi terrain (durée de conservation, accès).
//
// Usage :
//   node prospects.mjs add --tel "06 12 34 56 78" [--nom "..."] [--entreprise "..."]
//                          [--ville "..."] [--site "..."] [--instagram "..."]
//                          [--source "..."] [--analyse "..."] [--pitch "..."] [--notes "..."]
//   node prospects.mjs list [--statut "à appeler"]
//   node prospects.mjs update --tel "06..." [--statut "..."] [--pitch "..."] [--notes "..."]
//
// Sortie : prospects.xlsx, ouvrable directement dans Excel.

import path from 'node:path'
import fs from 'node:fs'

// exceljs est installé dans CE dossier (voir package.json), pas emprunté au
// projet WashBoard. Une première version pointait vers `washboard/node_modules`
// par un chemin en dur : ça marchait, mais ça couplait deux projets que
// `CLAUDE.md` veut indépendants, et l'outil de prospection cassait dès que le
// dossier WashBoard bougeait ou perdait ses dépendances.
let ExcelJS
try {
  ExcelJS = (await import('exceljs')).default
} catch {
  console.error('exceljs introuvable. Lance `npm install` dans ce dossier.')
  process.exit(1)
}

const FICHIER = path.join(import.meta.dirname, 'prospects.xlsx')
const FEUILLE = 'Prospects'

const COLONNES = [
  { header: 'Statut',         key: 'statut',       width: 16 },
  { header: 'Entreprise',     key: 'entreprise',   width: 26 },
  { header: 'Contact',        key: 'nom',          width: 20 },
  { header: 'Téléphone',      key: 'tel',          width: 18 },
  { header: 'Ville',          key: 'ville',        width: 18 },
  { header: 'Site web',       key: 'site',         width: 30 },
  { header: 'Instagram',      key: 'instagram',    width: 24 },
  { header: 'Source',         key: 'source',       width: 16 },
  { header: 'Analyse',        key: 'analyse',      width: 60 },
  { header: 'Pitch',          key: 'pitch',        width: 70 },
  { header: 'Notes',          key: 'notes',        width: 40 },
  { header: 'Ajouté le',      key: 'ajoute',       width: 12 },
  { header: 'Dernier contact', key: 'contact',     width: 14 },
]

const STATUTS = ['à appeler', 'appelé - à relancer', 'RDV pris', 'client', 'pas intéressé', 'injoignable']

/** Réduit un numéro à ses chiffres, au format international français.
 *  Sans ça, « 06 12 34 56 78 » et « +33612345678 » créeraient deux fiches
 *  pour la même personne — et Alexandre l'appellerait deux fois. */
function normaliserTel(brut) {
  const chiffres = String(brut ?? '').replace(/[^\d+]/g, '')
  if (chiffres.startsWith('+33')) return '0' + chiffres.slice(3)
  if (chiffres.startsWith('0033')) return '0' + chiffres.slice(4)
  if (chiffres.startsWith('33') && chiffres.length === 11) return '0' + chiffres.slice(2)
  return chiffres
}

/** Affichage lisible : 06 12 34 56 78 */
function formaterTel(brut) {
  const n = normaliserTel(brut)
  return /^0\d{9}$/.test(n) ? n.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : String(brut ?? '')
}

function aujourdhui() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue
    const cle = argv[i].slice(2)
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    out[cle] = val
  }
  return out
}

async function chargerClasseur() {
  const wb = new ExcelJS.Workbook()
  if (fs.existsSync(FICHIER)) {
    await wb.xlsx.readFile(FICHIER)
    const ws = wb.getWorksheet(FEUILLE)
    if (ws) return { wb, ws }
  }
  const ws = wb.addWorksheet(FEUILLE, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLONNES
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } }
  ws.autoFilter = { from: 'A1', to: 'M1' }
  return { wb, ws }
}

function lignesProspects(ws) {
  const lignes = []
  ws.eachRow((row, n) => { if (n > 1) lignes.push(row) })
  return lignes
}

function valeurs(row) {
  const o = {}
  COLONNES.forEach((c, i) => { o[c.key] = row.getCell(i + 1).value ?? '' })
  return o
}

async function commandeAdd(args) {
  if (!args.tel) { console.error('--tel est obligatoire'); process.exit(1) }
  const tel = normaliserTel(args.tel)
  if (!/^0\d{9}$/.test(tel)) {
    console.error(`Numéro « ${args.tel} » non reconnu comme un mobile/fixe français à 10 chiffres.`)
    console.error('Ajoute-le quand même avec --force si c’est volontaire (numéro étranger).')
    if (args.force !== 'true') process.exit(1)
  }

  const { wb, ws } = await chargerClasseur()

  // Doublon : on refuse plutôt que d'empiler deux fiches pour la même personne.
  const existant = lignesProspects(ws).find(r => normaliserTel(valeurs(r).tel) === tel)
  if (existant) {
    const v = valeurs(existant)
    console.error(`Déjà présent (ligne ${existant.number}) : ${v.entreprise || v.nom || ''} — statut « ${v.statut} »`)
    console.error('Utilise `update` pour le modifier.')
    process.exit(2)
  }

  ws.addRow({
    statut:     args.statut || 'à appeler',
    entreprise: args.entreprise || '',
    nom:        args.nom || '',
    tel:        formaterTel(args.tel),
    ville:      args.ville || '',
    site:       args.site || '',
    instagram:  args.instagram || '',
    source:     args.source || '',
    analyse:    args.analyse || '',
    pitch:      args.pitch || '',
    notes:      args.notes || '',
    ajoute:     aujourdhui(),
    contact:    '',
  })
  await wb.xlsx.writeFile(FICHIER)
  console.log(`Ajouté : ${args.entreprise || args.nom || formaterTel(args.tel)} (${formaterTel(args.tel)})`)
}

async function commandeUpdate(args) {
  if (!args.tel) { console.error('--tel est obligatoire'); process.exit(1) }
  const tel = normaliserTel(args.tel)
  const { wb, ws } = await chargerClasseur()
  const ligne = lignesProspects(ws).find(r => normaliserTel(valeurs(r).tel) === tel)
  if (!ligne) { console.error(`Aucun prospect avec le numéro ${formaterTel(args.tel)}`); process.exit(2) }

  const majs = []
  for (const c of COLONNES) {
    if (c.key === 'tel' || c.key === 'ajoute') continue
    if (args[c.key] !== undefined) {
      ligne.getCell(COLONNES.indexOf(c) + 1).value = args[c.key]
      majs.push(c.header)
    }
  }
  if (args.statut && !STATUTS.includes(args.statut)) {
    console.error(`Statut inconnu « ${args.statut} ». Attendus : ${STATUTS.join(', ')}`)
    process.exit(1)
  }
  if (majs.length === 0) { console.error('Rien à mettre à jour.'); process.exit(1) }
  ligne.commit()
  await wb.xlsx.writeFile(FICHIER)
  console.log(`Mis à jour (${formaterTel(args.tel)}) : ${majs.join(', ')}`)
}

async function commandeList(args) {
  if (!fs.existsSync(FICHIER)) { console.log('Aucun prospect enregistré pour le moment.'); return }
  const { ws } = await chargerClasseur()
  const toutes = lignesProspects(ws).map(valeurs)
  const filtrees = args.statut ? toutes.filter(p => p.statut === args.statut) : toutes
  if (filtrees.length === 0) { console.log('Aucun prospect ne correspond.'); return }

  console.log(`${filtrees.length} prospect(s)${args.statut ? ` — statut « ${args.statut} »` : ''} :\n`)
  for (const p of filtrees) {
    console.log(`  ${String(p.statut).padEnd(20)} ${String(p.entreprise || p.nom).padEnd(28)} ${p.tel}  ${p.ville}`)
    if (p.pitch) console.log(`  ${''.padEnd(20)} → ${String(p.pitch).slice(0, 110)}`)
  }
  const parStatut = {}
  for (const p of toutes) parStatut[p.statut] = (parStatut[p.statut] ?? 0) + 1
  console.log(`\nTotal : ${toutes.length} — ` + Object.entries(parStatut).map(([s, n]) => `${s}: ${n}`).join(' · '))
}

const [, , commande, ...reste] = process.argv
const args = parseArgs(reste)

const commandes = { add: commandeAdd, update: commandeUpdate, list: commandeList }
if (!commandes[commande]) {
  console.log('Commandes : add | update | list')
  console.log(`Statuts    : ${STATUTS.join(' · ')}`)
  console.log(`Fichier    : ${FICHIER}`)
  process.exit(commande ? 1 : 0)
}
await commandes[commande](args)
