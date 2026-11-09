import { EQUIPE, type Responsable } from '@/lib/responsables'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import { ongletDe, type Onglet, type Prospect } from '@/lib/prospects'
import type { LaveurResume } from '@/lib/resumeLaveurs'

// « Équipe » (2026-11-09) : chaque membre retrouve ses laveurs et ses prospects.
// Demande d'Alexandre : « un endroit équipe avec Yanis, Alexandre et Ryan, et en
// cliquant on retrouve nos laveurs attitrés et nos prospects ». Calculs purs : les
// écrans ne font que les afficher.

/** Adresse d'un membre : son prénom sans accent ni majuscule. `a-repartir` = personne ne le suit. */
export const SANS_RESPONSABLE = 'a-repartir'
export type Membre = Responsable | typeof SANS_RESPONSABLE

export const slugMembre = (m: Membre): string => (m === SANS_RESPONSABLE ? m : m.toLowerCase())

export function membreDepuisSlug(slug: string): Membre | null {
  if (slug === SANS_RESPONSABLE) return SANS_RESPONSABLE
  return EQUIPE.find(m => m.toLowerCase() === slug) ?? null
}

/** Étapes encore « vivantes » : les autres (refus, inscrits, archives) restent consultables mais à part. */
const ONGLETS_EN_COURS: Onglet[] = ['trier', 'vu', 'discussion', 'interesses', 'contactes']
export const enCours = (p: Prospect, now: Date): boolean => ONGLETS_EN_COURS.includes(ongletDe(p, now))

const suit = (membre: Membre, responsable: string | null | undefined) =>
  membre === SANS_RESPONSABLE ? !responsable : responsable === membre

export type ResumeMembre = {
  membre: Membre
  laveurs: number
  /** Prospects encore en cours (réponses à trier, en discussion, intéressés, messages récents). */
  prospects: number
  /** Laveurs et prospects dont le rappel est dû aujourd'hui ou en retard. */
  aRappeler: number
  /** Réponses de ses prospects qu'il n'a pas encore triées. */
  aTrier: number
}

export function resumerMembre(membre: Membre, laveurs: LaveurResume[], prospects: Prospect[], now: Date): ResumeMembre {
  const auj = aujourdhuiParis(now)
  const siensL = laveurs.filter(l => suit(membre, l.responsable))
  const siensP = prospects.filter(p => suit(membre, p.responsable))
  return {
    membre,
    laveurs: siensL.length,
    prospects: siensP.filter(p => enCours(p, now)).length,
    aRappeler:
      siensL.filter(l => l.relance && l.relance.le <= auj).length +
      siensP.filter(p => (p.statut === 'en_discussion' || p.statut === 'interesse') && p.relancer_le && p.relancer_le <= auj).length,
    aTrier: siensP.filter(p => p.statut === 'a_repondu').length,
  }
}

/** Les trois membres, puis « à répartir » seulement s'il reste quelqu'un sans responsable. */
export function resumerEquipe(laveurs: LaveurResume[], prospects: Prospect[], now: Date): ResumeMembre[] {
  const membres = EQUIPE.map(m => resumerMembre(m, laveurs, prospects, now))
  const reste = resumerMembre(SANS_RESPONSABLE, laveurs, prospects, now)
  const rienARepartir = reste.laveurs === 0 && prospects.every(p => p.responsable || !enCours(p, now))
  return rienARepartir ? membres : [...membres, reste]
}

/** Ce qu'un membre a dans les mains. Les prospects en cours d'abord, rappels dus en tête. */
export function contenuMembre(membre: Membre, laveurs: LaveurResume[], prospects: Prospect[], now: Date) {
  const auj = aujourdhuiParis(now)
  const l = laveurs.filter(x => suit(membre, x.responsable))
  const p = prospects.filter(x => suit(membre, x.responsable))
  const rang = (x: Prospect) => (x.statut === 'a_repondu' ? 0 : (x.statut === 'en_discussion' || x.statut === 'interesse') && x.relancer_le && x.relancer_le <= auj ? 1 : enCours(x, now) ? 2 : 3)
  return {
    laveurs: [...l].sort((a, b) => a.priorite - b.priorite || a.name.localeCompare(b.name, 'fr')),
    prospects: [...p].sort((a, b) => rang(a) - rang(b) || b.updated_at.localeCompare(a.updated_at)),
  }
}
