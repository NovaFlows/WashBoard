#!/usr/bin/env node
/**
 * Rafraichit la feuille « Clients » de prospects.xlsx depuis Supabase.
 *
 * Pourquoi un script et pas une saisie a la main : l'etat d'un inscrit change
 * tout seul. Une prestation ajoutee, une connexion, un essai qui se rapproche
 * de sa fin — recopie une fois dans Excel, l'information est fausse le
 * lendemain, et on rappelle quelqu'un en lui parlant d'un blocage qu'il a
 * resolu depuis. La source de verite est la base ; cette feuille n'en est
 * qu'une photo, reprise a chaque execution.
 *
 * Ce que le script NE touche PAS : les trois colonnes que tu remplis toi —
 * « Suivi par », « Prochaine action » et « Notes ». Elles sont relues avant
 * reecriture et recopiees, sinon chaque rafraichissement effacerait ton
 * travail.
 *
 *   node clients.mjs           rafraichit la feuille
 *   node clients.mjs --nettoie retire en plus des Prospects ceux devenus clients
 */
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const FICHIER = 'prospects.xlsx'
const FEUILLE = 'Clients'
const PRENOMS = ['Ryan', 'Yanis', 'Alexandre']

/** Comptes exclus du suivi client, avec la raison de chacun.
 *
 *  Exclure n'est PAS supprimer : ces comptes existent toujours en base et
 *  continuent de fonctionner. Ils n'apparaissent simplement pas dans la
 *  feuille, parce qu'on ne les demarche pas et qu'on ne suit pas leur essai. */
const COMPTES_EXCLUS = [
  'novaflows.pro@gmail.com',      // Alexandre
  'abouharirathelliez@gmail.com', // compte de test d'Alexandre
  'spotifypren1234@gmail.com',    // compte de test
  'yanis.zidiyy@gmail.com',       // ysclean — Yanis, membre de l'equipe, pas un client
  'alimladjao.saandi@gmail.com',  // « kookiclean » (un seul i) — ecarte le 2026-09-07
]

const COLONNES = [
  { header: 'Statut', key: 'statut', width: 14 },
  { header: 'Suivi par', key: 'suivi', width: 12 },
  { header: 'Entreprise', key: 'entreprise', width: 24 },
  { header: 'Ce qui bloque', key: 'bloque', width: 34 },
  { header: 'Jours essai', key: 'jours', width: 11 },
  { header: 'Téléphone', key: 'tel', width: 16 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Lien public', key: 'lien', width: 34 },
  { header: 'Inscrit le', key: 'inscrit', width: 12 },
  { header: 'Dernière connexion', key: 'connexion', width: 17 },
  { header: 'Presta.', key: 'prestations', width: 8 },
  { header: 'Créneaux', key: 'creneaux', width: 9 },
  { header: 'Logo', key: 'logo', width: 6 },
  { header: 'RDV', key: 'rdv', width: 7 },
  { header: 'Prochaine action', key: 'action', width: 40 },
  { header: 'Notes', key: 'notes', width: 40 },
]

// Colonnes remplies a la main : preservees d'un rafraichissement a l'autre.
const MANUELLES = ['suivi', 'action', 'notes']

// ── Environnement ───────────────────────────────────────────────────────────
function chargerEnv() {
  const chemin = path.resolve('..', '.env.local')
  if (!fs.existsSync(chemin)) {
    console.error(`Fichier introuvable : ${chemin}`)
    console.error('Ce script doit tourner depuis washboard/prospects/.')
    process.exit(1)
  }
  for (const ligne of fs.readFileSync(chemin, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(ligne)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const fr = d => d ? new Date(d).toLocaleString('fr-FR', {
  timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
}) : ''
const frDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) : ''

/** Le diagnostic, calcule et non recopie : c'est tout l'interet de la feuille.
 *  L'ordre compte — on nomme le PREMIER obstacle, celui a lever au telephone,
 *  pas la liste de tout ce qui manque. */
function diagnostic(c) {
  if (c.rdv > 0) return `${c.rdv} réservation${c.rdv > 1 ? 's' : ''} — ça tourne`
  if (c.prestations === 0 && c.creneaux === 0) return 'Rien de configuré'
  if (c.prestations === 0) return 'AUCUNE prestation → page inutilisable'
  if (c.creneaux === 0) return 'AUCUN créneau → aucune date réservable'
  if (!c.logo) return 'Prêt, mais sans logo'
  return 'Page prête — 0 réservation, lien jamais partagé ?'
}

function statut(c) {
  if (c.abonnement === 'active') return 'client payant'
  if (c.jours === null) return c.abonnement ?? '?'
  if (c.jours < 0) return 'essai expiré'
  if (c.jours <= 7) return 'essai — urgent'
  return 'essai'
}

// ── Lecture de la base ──────────────────────────────────────────────────────
async function lireClients() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: comptes, error: e1 } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (e1) throw new Error('lecture des comptes : ' + e1.message)

  const { data: fiches, error: e2 } = await admin
    .from('washers')
    .select('id, user_id, name, slug, phone, logo_url, trial_ends_at, subscription_status, created_at, is_preview')
    // Les pages « proposition » sont des vitrines construites pour des
    // prospects qui n'ont pas de compte : elles vivent dans la meme table que
    // les vrais laveurs (une seule base), mais ce ne sont pas des clients et
    // elles n'ont rien a faire dans ce suivi.
    .eq('is_preview', false)
    .order('created_at', { ascending: false })
  if (e2) throw new Error('lecture des laveurs : ' + e2.message)

  const internes = new Set(COMPTES_EXCLUS.map(e => e.toLowerCase()))
  const clients = []

  for (const w of fiches ?? []) {
    const u = (comptes?.users ?? []).find(x => x.id === w.user_id)
    const email = (u?.email ?? '').toLowerCase()
    if (internes.has(email)) continue

    const compte = async (table) => {
      const { count, error } = await admin
        .from(table).select('id', { count: 'exact', head: true }).eq('washer_id', w.id)
      // Un comptage en echec renverrait 0, donc « rien de configure », donc un
      // appel a quelqu'un qui a tout fait. On prefere le dire.
      if (error) { console.error(`  ! comptage ${table} impossible pour ${w.name} : ${error.message}`); return null }
      return count ?? 0
    }

    const jours = w.trial_ends_at
      ? Math.ceil((new Date(w.trial_ends_at).getTime() - Date.now()) / 86_400_000)
      : null

    clients.push({
      entreprise: w.name, email, tel: w.phone ?? '',
      lien: `washboard.fr/book/${w.slug}`,
      inscrit: w.created_at,
      connexion: u?.last_sign_in_at ?? null,
      abonnement: w.subscription_status,
      jours, logo: !!w.logo_url,
      prestations: await compte('services'),
      creneaux: await compte('availabilities'),
      rdv: await compte('bookings'),
    })
  }
  return clients
}

// ── Ecriture ────────────────────────────────────────────────────────────────
async function ecrire(clients, nettoyer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FICHIER)

  // Ce que l'humain a saisi, releve avant de tout reecrire.
  const garde = new Map()
  const ancienne = wb.getWorksheet(FEUILLE)
  if (ancienne) {
    const cle = c => COLONNES.findIndex(x => x.key === c) + 1
    for (let r = 2; r <= ancienne.rowCount; r++) {
      const email = String(ancienne.getRow(r).getCell(cle('email')).value ?? '').toLowerCase()
      if (!email) continue
      const v = {}
      for (const k of MANUELLES) v[k] = ancienne.getRow(r).getCell(cle(k)).value ?? ''
      garde.set(email, v)
    }
    wb.removeWorksheet(ancienne.id)
  }

  const ws = wb.addWorksheet(FEUILLE, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLONNES
  ws.getRow(1).font = { bold: true }

  for (const c of clients) {
    const manuel = garde.get(c.email) ?? {}
    const ligne = ws.addRow({
      statut: statut(c),
      suivi: manuel.suivi ?? '',
      entreprise: c.entreprise,
      bloque: diagnostic(c),
      jours: c.jours === null ? '' : c.jours,
      tel: c.tel, email: c.email, lien: c.lien,
      inscrit: frDate(c.inscrit),
      connexion: fr(c.connexion) || 'jamais',
      prestations: c.prestations ?? '?',
      creneaux: c.creneaux ?? '?',
      logo: c.logo ? 'oui' : 'non',
      rdv: c.rdv ?? '?',
      action: manuel.action ?? '',
      notes: manuel.notes ?? '',
    })
    ligne.getCell(2).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`"${PRENOMS.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Prénom invalide',
      error: `Choisissez ${PRENOMS.join(', ')} — ou laissez vide.`,
    }
    ligne.getCell(15).alignment = { wrapText: true, vertical: 'top' }
    ligne.getCell(16).alignment = { wrapText: true, vertical: 'top' }
  }

  // Un client n'est plus un prospect : sinon on l'appelle deux fois, une fois
  // pour lui vendre l'outil qu'il utilise deja.
  let retires = []
  if (nettoyer) {
    const wsP = wb.getWorksheet('Prospects')
    const chiffres = s => String(s ?? '').replace(/\D/g, '')
    const telsClients = new Set(clients.map(c => chiffres(c.tel)).filter(t => t.length >= 9))
    const nomsClients = new Set(clients.map(c => c.entreprise.trim().toLowerCase()))

    for (let r = wsP.rowCount; r >= 2; r--) {
      const v = wsP.getRow(r).values
      const tel = chiffres(v[5])
      const nom = String(v[3] ?? '').trim().toLowerCase()
      if ((tel.length >= 9 && telsClients.has(tel)) || nomsClients.has(nom)) {
        retires.push(`L${r} ${v[3]}`)
        wsP.spliceRows(r, 1)
      }
    }
  }

  await wb.xlsx.writeFile(FICHIER)
  return retires
}

// ── Main ────────────────────────────────────────────────────────────────────
chargerEnv()
const nettoyer = process.argv.includes('--nettoie')

console.log('Lecture de la base…')
const clients = await lireClients()

if (nettoyer) {
  const copie = `prospects_sauvegarde_${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.xlsx`
  fs.copyFileSync(FICHIER, copie)
  console.log('sauvegarde :', copie)
}

const retires = await ecrire(clients, nettoyer)

console.log(`\nFeuille « ${FEUILLE} » : ${clients.length} inscrits\n`)
for (const c of clients.sort((a, b) => (a.jours ?? 999) - (b.jours ?? 999))) {
  const j = c.jours === null ? '  —' : String(c.jours).padStart(3)
  console.log(`  ${j}j  ${c.entreprise.slice(0, 20).padEnd(22)} ${diagnostic(c)}`)
}
if (retires.length) {
  console.log(`\nRetires de la feuille Prospects (${retires.length}) :`)
  for (const r of retires) console.log('  ' + r)
}
