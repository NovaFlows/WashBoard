import { FUSEAU } from '@/lib/dateUtils'

/** Tri de l'onglet Factures par année et par mois d'émission.
 *
 *  Le mois qui compte est celui de l'ÉMISSION, pas celui du rendez-vous : c'est
 *  lui qui range la facture dans la comptabilité et les déclarations du laveur. */

export type FactureDatee = { facture_emise_le: string }
export type Filtre = { annee: string | null; mois: string | null }

export const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

/** Année et mois à l'heure de Paris : une facture émise le 31 décembre à
 *  23 h 30 (heure de Paris) appartient à décembre, même si l'horloge de la
 *  base, en UTC, est encore la veille ou déjà le lendemain. */
export function anneeMois(iso: string): { annee: string; mois: string } {
  const [annee, mois] = new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSEAU }).split('-')
  return { annee, mois }
}

/** Filtre lu dans l'adresse de la page. Toute valeur inattendue revient à
 *  « tout » plutôt qu'à une liste vide inexplicable ; un mois sans année
 *  n'a pas de sens et est ignoré. */
export function lireFiltre(p: { annee?: string | string[]; mois?: string | string[] }): Filtre {
  const annee = typeof p.annee === 'string' && /^\d{4}$/.test(p.annee) ? p.annee : null
  const mois = annee && typeof p.mois === 'string' && /^(0[1-9]|1[0-2])$/.test(p.mois) ? p.mois : null
  return { annee, mois }
}

export function filtrerFactures<T extends FactureDatee>(liste: T[], filtre: Filtre): T[] {
  return liste.filter(f => {
    const { annee, mois } = anneeMois(f.facture_emise_le)
    return (!filtre.annee || annee === filtre.annee) && (!filtre.mois || mois === filtre.mois)
  })
}

/** Années qui ont au moins une facture, la plus récente d'abord : on ne
 *  propose pas de choisir une année vide. */
export function anneesDisponibles(liste: FactureDatee[]): string[] {
  return [...new Set(liste.map(f => anneeMois(f.facture_emise_le).annee))].sort().reverse()
}

/** Mois d'une année qui ont au moins une facture, le plus récent d'abord. */
export function moisDisponibles(liste: FactureDatee[], annee: string): string[] {
  return [...new Set(
    liste.map(f => anneeMois(f.facture_emise_le)).filter(d => d.annee === annee).map(d => d.mois),
  )].sort().reverse()
}

export function libelleMois(mois: string): string {
  return NOMS_MOIS[Number(mois) - 1] ?? mois
}
