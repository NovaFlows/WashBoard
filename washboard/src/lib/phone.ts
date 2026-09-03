// Normalisation et validation des numéros de téléphone français.
//
// Le point clé : sans forme canonique, une contrainte d'unicité en base ne
// sert à rien. « 06 12 34 56 78 », « +33612345678 » et « 06.12.34.56.78 »
// désignent la même ligne mais sont trois chaînes différentes — quelqu'un
// pourrait ouvrir trois comptes d'essai avec le même téléphone. On stocke donc
// toujours la même forme : 10 chiffres commençant par 0.

/** Forme canonique d'un numéro français : 10 chiffres, sans espace ni
 *  ponctuation. Renvoie `null` si l'entrée n'est pas un numéro français
 *  exploitable — l'appelant décide quoi en faire, on ne devine pas. */
export function normalizePhone(brut: string | null | undefined): string | null {
  if (!brut) return null

  // On garde les chiffres et un éventuel « + » de tête ; espaces, points,
  // tirets et parenthèses sont du bruit de saisie.
  let n = String(brut).trim().replace(/[\s.\-()]/g, '')

  if (n.startsWith('+33')) n = '0' + n.slice(3)
  else if (n.startsWith('0033')) n = '0' + n.slice(4)
  else if (n.startsWith('33') && n.length === 11) n = '0' + n.slice(2)

  if (!/^0[1-9]\d{8}$/.test(n)) return null
  return n
}

/** Le numéro est-il un numéro français exploitable ? */
export function isValidPhone(brut: string | null | undefined): boolean {
  return normalizePhone(brut) !== null
}

/** Est-ce un mobile (06 ou 07) ? Utile quand un SMS doit pouvoir arriver —
 *  un fixe accepterait la saisie mais ne recevrait jamais le message. */
export function isMobilePhone(brut: string | null | undefined): boolean {
  const n = normalizePhone(brut)
  return n !== null && /^0[67]/.test(n)
}

/** Affichage lisible : 06 12 34 56 78. Renvoie l'entrée telle quelle si elle
 *  n'est pas normalisable, plutôt que de masquer une donnée existante. */
export function formatPhone(brut: string | null | undefined): string {
  const n = normalizePhone(brut)
  if (!n) return String(brut ?? '')
  return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

/** Numéros autorisés à porter plusieurs comptes.
 *
 *  L'unicité du téléphone existe pour empêcher d'ouvrir plusieurs essais
 *  gratuits avec des adresses email différentes. Elle gêne une seule
 *  personne légitime : Alexandre, qui a besoin de plusieurs comptes de test
 *  sur son propre numéro.
 *
 *  La liste passe par une variable d'environnement, jamais par le code : le
 *  dépôt est public, et un numéro de téléphone y resterait inscrit pour
 *  toujours dans l'historique.
 *
 *  Format attendu : numéros séparés par des virgules, dans n'importe quelle
 *  écriture (ils sont normalisés ici).
 */
export function isPhoneExemptFromUniqueness(brut: string | null | undefined): boolean {
  const numero = normalizePhone(brut)
  if (!numero) return false

  const liste = process.env.PHONE_UNIQUENESS_EXEMPT
  if (!liste) return false

  return liste
    .split(',')
    .map(n => normalizePhone(n))
    .some(n => n !== null && n === numero)
}
