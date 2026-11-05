// Qui suit quel laveur dans l'équipe (table `suivi_laveurs`, 2026-11-06).
// Demande d'Alexandre : « on est trois à gérer, on doit pouvoir s'affilier des
// clients ». Un prénom plutôt qu'un compte : Ryan et Yanis n'ont pas forcément
// de compte d'équipe, et la liste se change ici sans SQL. Visible de l'équipe
// seule — table sans politique RLS, service_role uniquement.

export const EQUIPE = ['Alexandre', 'Ryan', 'Yanis'] as const

export type Responsable = (typeof EQUIPE)[number]

/** Valide une affiliation : un prénom de l'équipe, ou null pour « personne ». */
export function validerResponsable(corps: unknown): { erreur: string } | { responsable: Responsable | null } {
  const v = (corps as { responsable?: unknown } | null)?.responsable
  if (v === null || v === '') return { responsable: null }
  if (!EQUIPE.includes(v as Responsable)) return { erreur: 'Choisissez un membre de l’équipe.' }
  return { responsable: v as Responsable }
}
