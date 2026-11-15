import { EQUIPE } from '@/lib/responsables'

// Tâches à faire de l'équipe (table `taches_equipe`, 2026-11-14). Demande d'Alexandre :
// des tâches attribuées à Ryan, Alexandre ou Yanis, supprimées une fois faites.

/** « Équipe » = tâche à faire à plusieurs, visible chez chaque membre. */
export const TOUTE_L_EQUIPE = 'Équipe'
export const ASSIGNES = [...EQUIPE, TOUTE_L_EQUIPE] as const
export type Assigne = (typeof ASSIGNES)[number]

export type Tache = { id: string; titre: string; assigne_a: Assigne; created_at: string }

/** Une tâche d'équipe concerne tout le monde. */
export const concerne = (t: Tache, f: Assigne): boolean => t.assigne_a === f || t.assigne_a === TOUTE_L_EQUIPE

export const TITRE_MAX = 200

/** Une idée : une note à garder de côté, qui n'est pas (encore) une tâche. */
export type Idee = { id: string; titre: string; created_at: string }

/** Valide l'ajout d'une idée : un titre non vide. */
export function validerIdee(corps: unknown): { erreur: string } | { titre: string } {
  const t = (corps as { titre?: unknown } | null)?.titre
  const titre = typeof t === 'string' ? t.trim() : ''
  if (!titre) return { erreur: 'Décrivez l’idée.' }
  if (titre.length > TITRE_MAX) return { erreur: `L’idée est trop longue (${TITRE_MAX} caractères maximum).` }
  return { titre }
}

/** Valide la personne à qui on confie une idée devenue tâche. */
export function validerAssigne(corps: unknown): { erreur: string } | { assigne_a: Assigne } {
  const a = (corps as { assigne_a?: unknown } | null)?.assigne_a
  if (!ASSIGNES.includes(a as Assigne)) return { erreur: 'Choisissez un membre ou « Équipe ».' }
  return { assigne_a: a as Assigne }
}

/** Valide la création d'une tâche : un titre non vide et un membre de l'équipe. */
export function validerTache(corps: unknown): { erreur: string } | { titre: string; assigne_a: Assigne } {
  const c = corps as { titre?: unknown; assigne_a?: unknown } | null
  const titre = typeof c?.titre === 'string' ? c.titre.trim() : ''
  if (!titre) return { erreur: 'Décrivez la tâche.' }
  if (titre.length > TITRE_MAX) return { erreur: `La tâche est trop longue (${TITRE_MAX} caractères maximum).` }
  if (!ASSIGNES.includes(c?.assigne_a as Assigne)) return { erreur: 'Choisissez un membre ou « Équipe ».' }
  return { titre, assigne_a: c!.assigne_a as Assigne }
}
