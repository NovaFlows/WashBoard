import { EQUIPE, type Responsable } from '@/lib/responsables'

// Tâches à faire de l'équipe (table `taches_equipe`, 2026-11-14). Demande d'Alexandre :
// des tâches attribuées à Ryan, Alexandre ou Yanis, supprimées une fois faites.

export type Tache = { id: string; titre: string; assigne_a: Responsable; created_at: string }

export const TITRE_MAX = 200

/** Valide la création d'une tâche : un titre non vide et un membre de l'équipe. */
export function validerTache(corps: unknown): { erreur: string } | { titre: string; assigne_a: Responsable } {
  const c = corps as { titre?: unknown; assigne_a?: unknown } | null
  const titre = typeof c?.titre === 'string' ? c.titre.trim() : ''
  if (!titre) return { erreur: 'Décrivez la tâche.' }
  if (titre.length > TITRE_MAX) return { erreur: `La tâche est trop longue (${TITRE_MAX} caractères maximum).` }
  if (!EQUIPE.includes(c?.assigne_a as Responsable)) return { erreur: 'Choisissez un membre de l’équipe.' }
  return { titre, assigne_a: c!.assigne_a as Responsable }
}
