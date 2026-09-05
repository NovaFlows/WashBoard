// Origine de confiance pour construire les liens envoyés par email.
//
// `reset-password` et `support/access` lisaient l'en-tête `Origin` de la
// requête pour bâtir le `redirectTo` d'un lien Supabase. Cet en-tête est
// choisi par l'appelant : une requête portant `Origin: https://attaquant.tld`
// faisait partir, depuis noreply@washboard.fr, un email de réinitialisation
// dont le lien renvoyait le jeton de récupération chez l'attaquant.
//
// En pratique la faille était neutralisée par un garde-fou EXTERNE au dépôt :
// Supabase remplace en silence tout `redirectTo` absent de la liste
// « Redirect URLs » du projet. C'est un réglage de tableau de bord, invisible
// à la relecture du code, modifiable par erreur, et qui disparaîtrait le jour
// où quelqu'un ajouterait un joker à cette liste. Le code ne doit pas dépendre
// d'une configuration qu'il ne contrôle pas. Signalé par un audit externe le
// 2026-09-05.

const DEFAUT = 'https://www.washboard.fr'

/** Retire le slash final : `${origin}/dashboard` doublerait la barre sinon. */
function normaliser(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Origines acceptées : celle du déploiement, plus le développement local.
 *
 *  `www.washboard.fr` et `washboard.fr` désignent le même site et l'un redirige
 *  vers l'autre : accepter les deux évite qu'un lien parte vers le mauvais
 *  hôte selon la façon dont le visiteur a tapé l'adresse. */
function originesAutorisees(envUrl: string | undefined): string[] {
  const base = normaliser(envUrl?.trim() || DEFAUT)
  const liste = [base]

  try {
    const u = new URL(base)
    const hote = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`
    liste.push(normaliser(`${u.protocol}//${hote}${u.port ? `:${u.port}` : ''}`))
  } catch {
    // `NEXT_PUBLIC_APP_URL` mal formée : on garde la valeur telle quelle plutôt
    // que de tout rejeter, la comparaison stricte fera le tri.
  }

  if (process.env.NODE_ENV !== 'production') {
    liste.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }
  return liste
}

/** Origine à utiliser dans un lien envoyé par email.
 *
 *  L'en-tête `Origin` n'est retenu que s'il correspond exactement à une origine
 *  connue — il ne sert alors qu'à choisir entre deux formes légitimes du même
 *  site, jamais à en désigner un autre. Dans tous les autres cas (en-tête
 *  absent, inconnu, ou forgé), on retombe sur la valeur configurée. */
export function trustedOrigin(
  headerOrigin: string | null | undefined,
  envUrl: string | undefined = process.env.NEXT_PUBLIC_APP_URL,
): string {
  const autorisees = originesAutorisees(envUrl)
  const candidat = headerOrigin ? normaliser(headerOrigin) : null
  if (candidat && autorisees.includes(candidat)) return candidat
  return autorisees[0]
}
