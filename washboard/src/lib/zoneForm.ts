// Logique de la feuille « Où vous intervenez » de la PWA (refonte 2026,
// `FeuilleZoneV2`, ouverte depuis l'écran « Prestations et prix »). Fonctions
// pures : la feuille ne contient que de la présentation et de l'état.
//
// CORRESPONDANCE AVEC LE V1 (`admin/IdentiteForm.tsx`, cartes `#zone`, inchangé) —
// une correction de règle se reporte des deux côtés :
//  · même champ en base (`washers.zone_config`), même route (`PATCH /api/washer`),
//    mêmes trois modes ; le mode `crow` est géocodé par le serveur À L'ENREGISTREMENT,
//    on ne lui envoie donc jamais de coordonnées ;
//  · éteindre l'interrupteur puis enregistrer écrit `{ enabled: false }` et EFFACE
//    la configuration (adresse, rayon, départements) : c'est déjà le comportement du
//    v1, la feuille le dit à voix haute plutôt que de le faire en silence.
//
// DEUX DURCISSEMENTS propres à cet écran (ni le v1 ni la route ne les font) :
//  · une zone « départements » sans aucun département est REFUSÉE : `verdictZone`
//    répond alors `allowed: false` pour tout le monde — le v1 laisse enregistrer
//    une zone qui refuse tous les clients ;
//  · la recherche de département ignore les accents et la casse (« herault »
//    ne trouvait rien dans le v1).
//
// Ce qui N'EST PAS durci ici, exprès : une adresse que Google ne reconnaît pas
// n'est pas refusée. `verdictZone` LAISSE PASSER quand le géocodage échoue
// (choix produit assumé, voir `lib/zone.ts`) — la feuille avertit, elle ne bloque pas.

import { DEPARTMENTS } from '@/lib/france-departments'
import type { ZoneConfig } from '@/types'

export type ModeZone = 'crow' | 'road' | 'departments'

export const RAYONS_PRESETS = [10, 20, 30, 50, 100] as const
export const RAYON_MIN = 5
export const RAYON_MAX = 150
export const RAYON_DEFAUT = 20

export const ERREUR_ADRESSE = 'Indiquez votre point de départ : sans lui, la limite ne s’applique pas.'
export const ERREUR_RAYON = `Indiquez un rayon entre ${RAYON_MIN} et ${RAYON_MAX} km.`
export const ERREUR_DEPARTEMENTS = 'Choisissez au moins un département : sinon plus personne ne peut réserver.'

export const AVERTISSEMENT_SUGGESTION =
  'Choisissez une suggestion, sinon la zone peut ne pas s’appliquer'

export type FormulaireZone = {
  limiter: boolean
  mode: ModeZone
  adresse: string
  /** Saisie libre : une puce (« 20 ») ou le champ « Autre ». */
  rayon: string
  departements: string[]
}

/** Ce que la feuille affiche à l'ouverture. Une zone éteinte ou absente rouvre
 *  sur les valeurs par défaut du v1 : ligne droite, 20 km, rien de rempli. */
export function formulaireDepuisZone(zone: ZoneConfig): FormulaireZone {
  if (!zone?.enabled) {
    return { limiter: false, mode: 'crow', adresse: '', rayon: String(RAYON_DEFAUT), departements: [] }
  }
  if (zone.type === 'departments') {
    return { limiter: true, mode: 'departments', adresse: '', rayon: String(RAYON_DEFAUT), departements: zone.departments }
  }
  return {
    limiter: true,
    mode: zone.type,
    adresse: zone.center_address,
    rayon: String(zone.radius_km),
    departements: [],
  }
}

// ── Départements ───────────────────────────────────────────────────────────

/** Minuscules, sans accents ni tirets : « Hérault » et « herault » se rejoignent,
 *  « Côte-d'Or » se trouve aussi en tapant « cote d or ». */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export type Departement = { code: string; name: string }

/** Départements dont le numéro commence par la recherche, ou dont le nom la
 *  contient. Recherche vide : la liste entière (c'est « Voir les … » qui s'en sert). */
export function chercherDepartements(recherche: string): Departement[] {
  const q = normaliser(recherche)
  if (!q) return DEPARTMENTS
  return DEPARTMENTS.filter(d => normaliser(d.code).startsWith(q) || normaliser(d.name).includes(q))
}

/** Nom du département, ou son numéro si `france-departments` ne le connaît pas
 *  (une zone enregistrée jadis avec un code devenu inconnu reste lisible). */
export function nomDepartement(code: string): string {
  return DEPARTMENTS.find(d => d.code === code)?.name ?? code
}

/** « Yonne », « Yonne et Nièvre », « Yonne, Nièvre et 2 autres ». */
export function resumeDepartements(codes: string[]): string {
  const noms = codes.map(nomDepartement)
  if (noms.length === 0) return ''
  if (noms.length === 1) return noms[0]
  if (noms.length === 2) return `${noms[0]} et ${noms[1]}`
  const reste = noms.length - 2
  return `${noms[0]}, ${noms[1]} et ${reste} autre${reste > 1 ? 's' : ''}`
}

// ── Rayon ──────────────────────────────────────────────────────────────────

/** Le rayon saisi, ou `null` s'il n'est pas un nombre entier de kilomètres dans
 *  les bornes. Une virgule n'a pas de sens ici (le v1 fait `parseInt`). */
export function lireRayon(saisie: string): number | null {
  const t = saisie.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= RAYON_MIN && n <= RAYON_MAX ? n : null
}

/** La phrase vivante sous les puces : ce que la zone veut dire, en français.
 *  `null` tant qu'il manque le rayon (rien à dire plutôt qu'une phrase à trous). */
export function phraseRayon(mode: ModeZone, saisieRayon: string, adresse: string): string | null {
  if (mode === 'departments') return null
  const rayon = lireRayon(saisieRayon)
  if (rayon === null) return null
  const ou = adresse.trim() ? `autour de ${adresse.trim()}` : 'autour de votre point de départ'
  if (mode === 'road') return `Jusqu’à ${rayon} km par les routes ${ou}.`
  return `Jusqu’à ${rayon} km en ligne droite ${ou}.`
}

/** Vrai pour le mode « ligne droite » : le rayon est mesuré à vol d'oiseau, la
 *  route est toujours plus longue — c'est la première surprise du réglage. */
export const routePlusLongue = (mode: ModeZone) => mode === 'crow'

// ── Enregistrement ─────────────────────────────────────────────────────────

export type ChampZone = 'adresse' | 'rayon' | 'departements'

export type ResultatZone =
  | { ok: true; config: ZoneConfig }
  | { ok: false; champ: ChampZone; message: string }

/** Ce qui part dans l'unique `PATCH /api/washer`, ou le champ à corriger.
 *  Jamais de coordonnées : le serveur géocode `crow` à l'enregistrement. */
export function validerZone(f: FormulaireZone): ResultatZone {
  if (!f.limiter) return { ok: true, config: { enabled: false } }

  if (f.mode === 'departments') {
    if (f.departements.length === 0) {
      return { ok: false, champ: 'departements', message: ERREUR_DEPARTEMENTS }
    }
    return { ok: true, config: { enabled: true, type: 'departments', departments: f.departements } }
  }

  const adresse = f.adresse.trim()
  if (!adresse) return { ok: false, champ: 'adresse', message: ERREUR_ADRESSE }
  const rayon = lireRayon(f.rayon)
  if (rayon === null) return { ok: false, champ: 'rayon', message: ERREUR_RAYON }

  return { ok: true, config: { enabled: true, type: f.mode, center_address: adresse, radius_km: rayon } }
}

// ── Résumé de la ligne de l'écran ──────────────────────────────────────────

export const ZONE_SANS_LIMITE = 'Pas de limite : on peut réserver chez vous de partout'

export type ResumeLigne = { texte: string; ton?: 'ambre' | 'rouge' }

/** La phrase grise sous « Où vous intervenez ». Un point n'apparaît QUE pour une
 *  configuration cassée : « pas de zone » est une option, pas un manque. */
export function resumeZone(zone: ZoneConfig): ResumeLigne {
  if (!zone?.enabled) return { texte: ZONE_SANS_LIMITE }

  if (zone.type === 'departments') {
    // `verdictZone` compare l'adresse du client à une liste vide : elle refuse tout.
    if (zone.departments.length === 0) {
      return { texte: 'Aucun département : personne ne peut réserver', ton: 'rouge' }
    }
    return { texte: resumeDepartements(zone.departments) }
  }

  // Sans adresse de centre, le géocodage ne rend rien et `verdictZone` laisse
  // passer : la limite existe en base mais n'a aucun effet.
  if (!zone.center_address?.trim()) {
    return { texte: 'Adresse manquante : la limite n’est pas appliquée', ton: 'ambre' }
  }
  const mesure = zone.type === 'road' ? 'par les routes' : 'en ligne droite'
  return { texte: `${zone.radius_km} km ${mesure} autour de ${zone.center_address.trim()}` }
}
