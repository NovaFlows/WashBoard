// Qui voit l'onglet « Formation », et qui peut le gérer ? (branche feat/formation, 2026-11-11)
//
// Tant que l'onglet est une coquille, il n'est visible que de ceux qu'on a listés : la variable
// `FORMATION_USER_IDS` (identifiants de comptes séparés par des virgules, comme
// `SUPPORT_ADMIN_USER_IDS`). `FORMATION_OUVERTE=1` l'ouvre à tous les laveurs, le jour du
// lancement. Sans aucune des deux, l'onglet n'existe pour personne.
//
// `FORMATION_ADMIN_USER_IDS` désigne les comptes qui GÈRENT la formation (créer / modifier des
// packs, des leçons, envoyer des vidéos) : NovaFlows. Un administrateur voit toujours l'onglet,
// même absent de `FORMATION_USER_IDS`. (Variables lues à la construction du déploiement : en
// changer une demande un nouveau build.)

type Env = Record<string, string | undefined>

function liste(valeur: string | undefined): string[] {
  return (valeur ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

export function formationAdmin(userId: string | null | undefined, env: Env = process.env): boolean {
  if (!userId) return false
  return liste(env.FORMATION_ADMIN_USER_IDS).includes(userId)
}

export function formationOuverte(userId: string | null | undefined, env: Env = process.env): boolean {
  if (!userId) return false
  if (env.FORMATION_OUVERTE === '1') return true
  if (formationAdmin(userId, env)) return true
  return liste(env.FORMATION_USER_IDS).includes(userId)
}
