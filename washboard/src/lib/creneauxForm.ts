// Logique de la feuille « Créneaux intelligents » de la PWA (refonte 2026,
// `FeuilleCreneauxV2`, ouverte depuis l'écran « Prestations et prix »).
// Fonctions pures ; la feuille ne contient que de la présentation et de l'état.
//
// CE QUE « PROCHE » VEUT DIRE — relu dans `src/app/api/slots/smart/route.ts`,
// c'est la seule définition qui existe, et elle n'est réglable qu'à moitié :
//  1. on ne regarde que les rendez-vous du MÊME JOUR, hors annulés ;
//  2. Google Distance Matrix donne le temps de voiture du rendez-vous existant
//     vers l'adresse du nouveau client ; il doit être ≤ `smart_slot_radius_minutes`
//     (le seul paramètre réglable) ;
//  3. la fenêtre retenue va de 90 min AVANT le début du rendez-vous à 90 min APRÈS
//     sa fin (`WINDOW_MIN = 90`, codé en dur, ni réglable ni stocké) ; la fin tient
//     compte de la durée réelle (prestation + options) × nombre de véhicules ;
//  4. un créneau qui tombe dans cette fenêtre est marqué « ★ optimisé » et se voit
//     appliquer la remise (`StepSlot`, `isSlotInWindows`).
// Sans clé Google, sans rendez-vous ce jour-là ou si Distance Matrix échoue,
// aucun créneau n'est optimisé : la remise ne part pas, la réservation passe.
//
// CORRESPONDANCE AVEC LE V1 (`admin/IdentiteForm.tsx`, carte `#creneaux`, inchangé) :
// mêmes quatre colonnes (`smart_slot_enabled`, `smart_slot_radius_minutes`,
// `smart_slot_discount_type`, `smart_slot_discount_value`), même route.
//
// LES GARDE-FOUS DE VALEUR SONT ICI, PAS AU SERVEUR : `PATCH /api/washer` écrête
// le rayon entre 5 et 60 min mais accepte n'importe quelle remise positive — 200 %
// compris. L'écran refuse donc au-delà de 50 % et au-delà du prix de la prestation
// la moins chère. Ce n'est PAS une protection : un appel direct à la route passe
// toujours (voir TODO.md, section Refonte 2026).

import { formatEuros } from '@/lib/plan'
import { smartDiscountAmount, smartPrice } from '@/lib/pricing'

export type TypeRemise = 'fixed' | 'percent'

export const PROXIMITES = [5, 10, 15, 20, 30] as const
export const PROXIMITE_MIN = 5
/** Plafond du serveur (`Math.min(60, …)`) : au-delà, la valeur enregistrée
 *  ne serait pas celle affichée. */
export const PROXIMITE_MAX = 60
export const PROXIMITE_DEFAUT = 15

export const REMISES_EUROS = [3, 5, 10] as const
export const REMISES_POURCENT = [5, 10, 15] as const
export const POURCENT_MAX = 50

/** Demi-fenêtre autour d'un rendez-vous, en minutes — `WINDOW_MIN` de
 *  `api/slots/smart/route.ts`. Codée en dur là-bas : montrée, jamais réglable ici. */
export const FENETRE_MINUTES = 90

export const ERREUR_PROXIMITE = `Indiquez un nombre de minutes entre ${PROXIMITE_MIN} et ${PROXIMITE_MAX}.`
export const ERREUR_REMISE_VIDE = 'Indiquez un montant. Mettez 0 pour seulement mettre le créneau en avant.'
export const ERREUR_REMISE_NEGATIVE = 'Une remise ne peut pas être négative.'
export const ERREUR_POURCENT_MAX = `Une remise au-delà de ${POURCENT_MAX} % vous coûte plus qu’elle ne rapporte.`

export type FormulaireCreneaux = {
  actif: boolean
  /** Saisie libre : une puce (« 15 ») ou le champ « Autre ». */
  proximite: string
  type: TypeRemise
  /** Saisie libre, virgule décimale acceptée. */
  valeur: string
}

export type ReglagesCreneaux = {
  actif: boolean
  proximite: number
  type: TypeRemise
  valeur: number
}

export function formulaireDepuisReglages(r: ReglagesCreneaux): FormulaireCreneaux {
  return { actif: r.actif, proximite: String(r.proximite), type: r.type, valeur: formatEuros(r.valeur) }
}

/** Un nombre positif ou nul, virgule décimale acceptée (« 7,5 » → 7.5).
 *  `null` si la saisie est vide ou n'est pas un nombre. */
export function lireNombre(saisie: string): number | null {
  const t = saisie.trim().replace(',', '.')
  if (!t) return null
  if (!/^-?\d*\.?\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Entier de minutes dans les bornes du serveur, ou `null`. */
export function lireProximite(saisie: string): number | null {
  const t = saisie.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= PROXIMITE_MIN && n <= PROXIMITE_MAX ? n : null
}

/** La définition exacte de « proche », en une phrase (voir l'en-tête). */
export function phraseProche(minutes: number): string {
  return (
    `Un créneau est concerné quand votre client est à moins de ${minutes} min de voiture ` +
    `d’un rendez-vous du même jour, et qu’il tombe dans l’heure et demie avant ce rendez-vous ou après.`
  )
}

// ── Exemple vivant ─────────────────────────────────────────────────────────

export type PrestationExemple = { nom: string; prix: number }

const euros = (n: number) => `${formatEuros(n)} €`

/** « Sur “Lavage complet” à 80 €, votre client paie 75 € : vous encaissez 5 € de
 *  moins. » Calculé par `smartPrice`, la fonction que la page de réservation
 *  utilise — aucun appel réseau, aucune règle dupliquée. */
export function exempleRemise(
  prestation: PrestationExemple | null,
  type: TypeRemise,
  saisieValeur: string,
): string | null {
  const valeur = lireNombre(saisieValeur)
  if (valeur === null || valeur < 0) return null
  const base = prestation?.prix ?? 80
  const remise = smartDiscountAmount(base, { type, value: valeur })
  const paye = smartPrice(base, { type, value: valeur })
  const sujet = prestation ? `Sur « ${prestation.nom} » à ${euros(base)}` : `Exemple : un lavage à ${euros(base)}`
  if (remise <= 0) {
    return `${sujet}, le prix ne change pas : le créneau est seulement mis en avant (★).`
  }
  const perdu = base - paye
  return `${sujet}, votre client paie ${euros(paye)} : vous encaissez ${euros(perdu)} de moins.`
}

/** La prestation qui sert d'exemple : la première au prix réel (> 0). Une
 *  prestation à 0 € est un « sur devis », elle n'illustrerait rien. */
export function prestationExemple(prestations: PrestationExemple[]): PrestationExemple | null {
  return prestations.find(p => p.prix > 0) ?? null
}

/** Le prix le plus bas parmi les prestations réelles — plafond de la remise en
 *  euros. `null` si le laveur n'a encore aucun prix : rien à plafonner. */
export function prixLePlusBas(prestations: PrestationExemple[]): number | null {
  const prix = prestations.map(p => p.prix).filter(p => p > 0)
  return prix.length > 0 ? Math.min(...prix) : null
}

// ── Enregistrement ─────────────────────────────────────────────────────────

export type ChampCreneaux = 'proximite' | 'valeur'

export type ChampsCreneaux = {
  smart_slot_enabled: boolean
  smart_slot_radius_minutes?: number
  smart_slot_discount_type?: TypeRemise
  smart_slot_discount_value?: number
}

export type ResultatCreneaux =
  | { ok: true; champs: ChampsCreneaux }
  | { ok: false; champ: ChampCreneaux; message: string }

/** Ce qui part dans l'unique `PATCH /api/washer`, ou le champ à corriger.
 *  Éteindre n'envoie que l'interrupteur : une valeur restée invalide ne doit pas
 *  empêcher de couper la remise. */
export function validerCreneaux(f: FormulaireCreneaux, prixMin: number | null): ResultatCreneaux {
  if (!f.actif) return { ok: true, champs: { smart_slot_enabled: false } }

  const proximite = lireProximite(f.proximite)
  if (proximite === null) return { ok: false, champ: 'proximite', message: ERREUR_PROXIMITE }

  const valeur = lireNombre(f.valeur)
  if (valeur === null) return { ok: false, champ: 'valeur', message: ERREUR_REMISE_VIDE }
  if (valeur < 0) return { ok: false, champ: 'valeur', message: ERREUR_REMISE_NEGATIVE }
  if (f.type === 'percent' && valeur > POURCENT_MAX) {
    return { ok: false, champ: 'valeur', message: ERREUR_POURCENT_MAX }
  }
  if (f.type === 'fixed' && prixMin !== null && valeur > prixMin) {
    return {
      ok: false,
      champ: 'valeur',
      message: `Cette remise dépasse votre prestation la moins chère (${euros(prixMin)}).`,
    }
  }

  return {
    ok: true,
    champs: {
      smart_slot_enabled: true,
      smart_slot_radius_minutes: proximite,
      smart_slot_discount_type: f.type,
      smart_slot_discount_value: valeur,
    },
  }
}

// ── Résumé de la ligne de l'écran ──────────────────────────────────────────

export const CRENEAUX_ETEINTS = 'Désactivés. Une remise pour regrouper vos trajets.'

/** La phrase grise sous « Créneaux intelligents ». Pas de point : c'est une
 *  option, pas un réglage manquant. */
export function resumeCreneaux(r: ReglagesCreneaux): string {
  if (!r.actif) return CRENEAUX_ETEINTS
  const proche = `sur les créneaux à moins de ${r.proximite} min d’un rendez-vous`
  if (r.valeur <= 0) return `Créneaux à moins de ${r.proximite} min d’un rendez-vous mis en avant, sans remise`
  const remise = r.type === 'percent' ? `${formatEuros(r.valeur)} %` : euros(r.valeur)
  return `−${remise} ${proche}`
}
