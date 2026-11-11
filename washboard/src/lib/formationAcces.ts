// Qui voit l'onglet « Formation » ? (branche feat/formation, 2026-11-10)
//
// Tant que l'onglet est une coquille, il n'est visible que de ceux qu'on a listés : la variable
// `FORMATION_USER_IDS` (identifiants de comptes séparés par des virgules, comme
// `SUPPORT_ADMIN_USER_IDS`). `FORMATION_OUVERTE=1` l'ouvre à tous les laveurs, le jour du
// lancement. Sans aucune des deux, l'onglet n'existe pour personne.

type Env = Record<string, string | undefined>

export function formationOuverte(userId: string | null | undefined, env: Env = process.env): boolean {
  if (!userId) return false
  if (env.FORMATION_OUVERTE === '1') return true
  const liste = (env.FORMATION_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return liste.includes(userId)
}
