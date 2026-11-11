// Normalisation et validation des numéros de téléphone français.
//
// Le point clé : sans forme canonique, une contrainte d'unicité en base ne
// sert à rien. « 06 12 34 56 78 », « +33612345678 » et « 06.12.34.56.78 »
// désignent la même ligne mais sont trois chaînes différentes — quelqu'un
// pourrait ouvrir trois comptes d'essai avec le même téléphone. On stocke donc
// toujours la même forme : 10 chiffres commençant par 0.

export type PaysTelephone = 'FR' | 'BE'

// Ouverture à la Belgique (2026-11-11). Un numéro français reste stocké en 10 chiffres (06…) ;
// un numéro belge est stocké en forme internationale (+32470123456) : c'est la seule façon de ne
// pas confondre un 0470… belge avec un fixe français (04 70 …). Un Belge qui tape son numéro à la
// belge (0470 12 34 56) n'est reconnu comme tel que là où l'on sait qu'on est en Belgique
// (inscription, page d'un laveur belge) : voir `pays`.

/** Un numéro belge en forme internationale : +32 puis 8 ou 9 chiffres. */
const BELGE = /^\+32[1-9]\d{7,8}$/
/** Un mobile belge : +32 4 suivi de 5-9 puis 7 chiffres (0456, 046x, 047x, 048x, 049x). */
const MOBILE_BELGE = /^\+324[5-9]\d{7}$/

/** Forme canonique d'un numéro : 10 chiffres pour un numéro français, +32… pour un numéro belge.
 *  Renvoie `null` si l'entrée n'est pas exploitable — l'appelant décide quoi en faire, on ne
 *  devine pas. `pays` ('BE') permet de lire un numéro belge saisi à la belge (0470 12 34 56). */
export function normalizePhone(brut: string | null | undefined, pays: PaysTelephone = 'FR'): string | null {
  if (!brut) return null

  // On garde les chiffres et un éventuel « + » de tête ; espaces, points,
  // tirets et parenthèses sont du bruit de saisie.
  let n = String(brut).trim().replace(/[\s.\-()]/g, '')

  // Belgique : forme internationale (+32, 0032, ou 32 collé) — jamais ambiguë.
  const intl = n.startsWith('+32') ? n : n.startsWith('0032') ? '+' + n.slice(2) : /^32[1-9]\d{7,8}$/.test(n) ? '+' + n : null
  if (intl) return BELGE.test(intl) ? intl : null
  // Saisie à la belge, seulement quand on sait qu'on est en Belgique : 0470 12 34 56, 02 123 45 67.
  if (pays === 'BE' && /^0[1-9]\d{7,8}$/.test(n)) return '+32' + n.slice(1)

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

/** Un numéro sous la forme attendue par une URL `wa.me` (WhatsApp) : chiffres
 *  seuls, préfixés `33` à la place d'un `0` initial français. Extraite de
 *  `contact.ts` (`openWhatsapp`) le 2026-09-24 pour être testée et réutilisée
 *  ailleurs (agenda v2, « Proposer ce créneau ») — comportement inchangé au
 *  chiffre près : contrairement à `normalizePhone`, elle ne valide rien et ne
 *  renvoie jamais `null`. Un numéro imparfait déjà en base (fixe, étranger,
 *  saisie libre) continue donc de produire un lien WhatsApp, comme avant
 *  cette extraction — l'appelant doit vérifier que le téléphone existe avant
 *  d'appeler cette fonction, elle ne le fait pas non plus. */
export function whatsappDigits(brut: string): string {
  const chiffres = brut.replace(/\D/g, '')
  return chiffres.startsWith('0') ? '33' + chiffres.slice(1) : chiffres
}

/** Est-ce un mobile (06 ou 07 en France, 04xx en Belgique) ? Utile quand un SMS doit pouvoir
 *  arriver — un fixe accepterait la saisie mais ne recevrait jamais le message. */
export function isMobilePhone(brut: string | null | undefined, pays: PaysTelephone = 'FR'): boolean {
  const n = normalizePhone(brut, pays)
  return n !== null && (/^0[67]/.test(n) || MOBILE_BELGE.test(n))
}

/** Le pays d'un numéro canonique : « +32… » est belge, le reste français. */
export function paysDuTelephone(brut: string | null | undefined): PaysTelephone {
  return String(brut ?? '').trim().replace(/[\s.\-()]/g, '').match(/^(\+32|0032)/) ? 'BE' : 'FR'
}

/** Mobile à qui envoyer un code par SMS : français (06, 07) ou belge (04xx). Renvoie la forme
 *  canonique (10 chiffres, ou +32…), ou `null`. Le numéro 04xx saisi à la belge est lu comme belge :
 *  à l'inscription, un fixe français (04 …) ne pourrait de toute façon pas recevoir de SMS. */
export function normaliserMobile(brut: string | null | undefined): string | null {
  const fr = normalizePhone(brut)
  if (fr && /^0[67]\d{8}$/.test(fr)) return fr
  const be = normalizePhone(brut, 'BE')
  return be && MOBILE_BELGE.test(be) ? be : null
}

/** Affichage lisible : 06 12 34 56 78. Renvoie l'entrée telle quelle si elle
 *  n'est pas normalisable, plutôt que de masquer une donnée existante. */
export function formatPhone(brut: string | null | undefined): string {
  const n = normalizePhone(brut)
  if (!n) return String(brut ?? '')
  // Belge : +32 470 12 34 56 (mobile) ou +32 2 123 45 67 (fixe).
  if (n.startsWith('+32')) {
    const reste = n.slice(3)
    return reste.startsWith('4')
      ? `+32 ${reste.slice(0, 3)} ${reste.slice(3, 5)} ${reste.slice(5, 7)} ${reste.slice(7)}`
      : `+32 ${reste.slice(0, 1)} ${reste.slice(1, 4)} ${reste.slice(4, 6)} ${reste.slice(6)}`.trim()
  }
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
