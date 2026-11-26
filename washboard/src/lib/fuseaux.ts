// Fuseaux horaires qu'un laveur peut choisir (colonne `washers.fuseau`).
//
// Jusqu'au 2026-11-26, tout WashBoard était à l'heure de Paris. Un laveur de
// Cayenne (UTC−3) voyait alors « aujourd'hui » basculer à 20 h ou 21 h chez
// lui, les créneaux du matin disparaître comme « déjà passés », et ses
// rappels partir quatre ou cinq heures trop tôt.
//
// La liste est volontairement fermée : la France et ses outre-mer, plus la
// Belgique et la Suisse (même heure que Paris). Une valeur inconnue — colonne
// absente, faute de frappe, ancienne ligne — retombe TOUJOURS sur Paris, le
// comportement historique : un laveur ne peut pas se retrouver décalé par
// accident.

import { FUSEAU } from './dateUtils'

export type FuseauPropose = { id: string; libelle: string }

/** Ordre d'affichage du sélecteur des réglages. Les libellés sont des noms de
 *  lieux, traduits par `useT` côté interface. */
export const FUSEAUX_PROPOSES: FuseauPropose[] = [
  { id: 'Europe/Paris', libelle: 'France métropolitaine, Belgique, Suisse' },
  { id: 'America/Cayenne', libelle: 'Guyane' },
  { id: 'America/Martinique', libelle: 'Martinique' },
  { id: 'America/Guadeloupe', libelle: 'Guadeloupe, Saint-Martin, Saint-Barthélemy' },
  { id: 'Indian/Reunion', libelle: 'La Réunion' },
  { id: 'Indian/Mayotte', libelle: 'Mayotte' },
  { id: 'America/Miquelon', libelle: 'Saint-Pierre-et-Miquelon' },
  { id: 'Pacific/Noumea', libelle: 'Nouvelle-Calédonie' },
  { id: 'Pacific/Tahiti', libelle: 'Polynésie française' },
  { id: 'Pacific/Wallis', libelle: 'Wallis-et-Futuna' },
]

const CONNUS = new Set(FUSEAUX_PROPOSES.map(f => f.id))

export function estFuseauPropose(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && CONNUS.has(valeur)
}

/** Le fuseau d'un laveur, tel qu'il faut le passer aux fonctions de
 *  `dateUtils`. Accepte la ligne `washers` entière ou juste la valeur. */
export function fuseauDuLaveur(source: { fuseau?: string | null } | string | null | undefined): string {
  const valeur = typeof source === 'string' ? source : source?.fuseau
  return estFuseauPropose(valeur) ? valeur : FUSEAU
}
