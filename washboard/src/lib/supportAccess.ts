// Accès temporaire d'un membre du support au compte d'un laveur, à sa demande.
//
// Le principe : le laveur ouvre un accès depuis ses réglages, il dure une
// heure, il se ferme tout seul, et chaque utilisation laisse une trace qu'il
// peut consulter. Personne ne peut entrer dans son compte sans qu'il l'ait
// autorisé, et il peut couper à tout moment.
//
// La décision de validité est isolée ici parce qu'elle garde la porte : une
// erreur de raisonnement ouvrirait le compte d'un laveur à son insu. En
// fonction pure, elle se vérifie sans base de données ni serveur.

export const SUPPORT_ACCESS_DURATION_MS = 60 * 60 * 1000 // 1 heure

export type SupportGrant = {
  expires_at: string
  revoked_at: string | null
}

/** L'accès est-il ouvert à cet instant ?
 *
 *  Trois conditions, dans cet ordre : le laveur ne l'a pas coupé, la date de
 *  fin est lisible, et elle n'est pas passée. Toute incertitude referme la
 *  porte — un accès refusé à tort se répare en un clic, un accès accordé à
 *  tort ne se répare pas. */
export function isSupportAccessActive(grant: SupportGrant | null | undefined, now: Date): boolean {
  if (!grant) return false
  if (grant.revoked_at) return false

  const fin = new Date(grant.expires_at).getTime()
  // Une date illisible ne doit jamais valoir « valide pour toujours ».
  if (!Number.isFinite(fin)) return false

  return fin > now.getTime()
}

/** Temps restant, en minutes arrondies à la minute supérieure — pour afficher
 *  « il reste 42 minutes » plutôt qu'une heure de fin que le laveur devrait
 *  comparer à sa montre. */
export function supportAccessMinutesLeft(grant: SupportGrant | null | undefined, now: Date): number {
  if (!isSupportAccessActive(grant, now)) return 0
  const restant = new Date(grant!.expires_at).getTime() - now.getTime()
  return Math.max(1, Math.ceil(restant / 60_000))
}

/** Cette adresse fait-elle partie de l'équipe support ?
 *
 *  La liste vit dans une variable d'environnement, jamais dans le code : le
 *  dépôt est public. Sans variable définie, personne n'est support — un
 *  déploiement mal configuré doit fermer l'accès, pas l'ouvrir à tous. */
export function isSupportMember(email: string | null | undefined, liste: string | undefined): boolean {
  if (!email || !liste) return false
  const normalise = email.trim().toLowerCase()
  if (!normalise) return false
  return liste
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalise)
}
