// Normalisation et validation des numéros de téléphone français.
//
// Le point clé : sans forme canonique, une contrainte d'unicité en base ne
// sert à rien. « 06 12 34 56 78 », « +33612345678 » et « 06.12.34.56.78 »
// désignent la même ligne mais sont trois chaînes différentes — quelqu'un
// pourrait ouvrir trois comptes d'essai avec le même téléphone. On stocke donc
// toujours la même forme : 10 chiffres commençant par 0.

export type PaysTelephone = 'FR' | 'BE' | 'CH'

// Ouverture à la Belgique (2026-11-11). Un numéro français reste stocké en 10 chiffres (06…) ;
// un numéro belge est stocké en forme internationale (+32470123456) : c'est la seule façon de ne
// pas confondre un 0470… belge avec un fixe français (04 70 …). Un Belge qui tape son numéro à la
// belge (0470 12 34 56) n'est reconnu comme tel que là où l'on sait qu'on est en Belgique
// (inscription, page d'un laveur belge) : voir `pays`.
//
// Ouverture à la Suisse (2026-11-13), même principe : un numéro suisse est stocké en +41…
// (+41791234567). Un mobile suisse saisi à la suisse (079 123 45 67) ressemble à s'y méprendre à
// un 07 français : il n'est donc lu comme suisse que là où l'on sait qu'on est en Suisse (page
// d'un laveur suisse). À l'inscription, où l'on ne sait rien, un Suisse écrit son numéro avec +41.

/** Un numéro belge en forme internationale : +32 puis 8 ou 9 chiffres. */
const BELGE = /^\+32[1-9]\d{7,8}$/
/** Un mobile belge : +32 4 suivi de 5-9 puis 7 chiffres (0456, 046x, 047x, 048x, 049x). */
const MOBILE_BELGE = /^\+324[5-9]\d{7}$/
/** Un numéro suisse en forme internationale : +41 puis 9 chiffres (indicatif régional ou mobile compris). */
const SUISSE = /^\+41[1-9]\d{8}$/
/** Un mobile suisse : +41 7 suivi de 5 à 9, puis 7 chiffres (075, 076, 077, 078, 079). */
const MOBILE_SUISSE = /^\+417[5-9]\d{7}$/

/** Forme canonique d'un numéro : 10 chiffres pour un numéro français, +32… pour un numéro belge,
 *  +41… pour un numéro suisse. Renvoie `null` si l'entrée n'est pas exploitable — l'appelant décide
 *  quoi en faire, on ne devine pas. `pays` ('BE', 'CH') permet de lire un numéro saisi à la
 *  belge (0470 12 34 56) ou à la suisse (079 123 45 67). */
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

  // Suisse : forme internationale (+41, 0041) — jamais ambiguë. Le « 41 » collé n'est PAS lu
  // comme suisse : 41 est aussi un début de numéro français (04 1…) une fois le 0 tombé.
  const intlCh = n.startsWith('+41') ? n : n.startsWith('0041') ? '+' + n.slice(2) : null
  if (intlCh) return SUISSE.test(intlCh) ? intlCh : null
  // Saisie à la suisse, seulement quand on sait qu'on est en Suisse : 079 123 45 67, 022 123 45 67.
  if (pays === 'CH' && /^0[1-9]\d{8}$/.test(n)) return '+41' + n.slice(1)

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

/** Est-ce un mobile (06 ou 07 en France, 04xx en Belgique, 07x en Suisse) ? Utile quand un SMS doit
 *  pouvoir arriver — un fixe accepterait la saisie mais ne recevrait jamais le message. */
export function isMobilePhone(brut: string | null | undefined, pays: PaysTelephone = 'FR'): boolean {
  const n = normalizePhone(brut, pays)
  return n !== null && (/^0[67]/.test(n) || MOBILE_BELGE.test(n) || MOBILE_SUISSE.test(n))
}

/** Le pays d'un numéro canonique : « +32… » est belge, « +41… » suisse, le reste français. */
export function paysDuTelephone(brut: string | null | undefined): PaysTelephone {
  const n = String(brut ?? '').trim().replace(/[\s.\-()]/g, '')
  if (/^(\+32|0032)/.test(n)) return 'BE'
  if (/^(\+41|0041)/.test(n)) return 'CH'
  return 'FR'
}

/** Mobile à qui envoyer un code par SMS : français (06, 07), belge (04xx) ou suisse (+41 7x).
 *  Renvoie la forme canonique (10 chiffres, +32… ou +41…), ou `null`. Le numéro 04xx saisi à la
 *  belge est lu comme belge : à l'inscription, un fixe français (04 …) ne pourrait de toute façon
 *  pas recevoir de SMS. Un mobile suisse, lui, doit être écrit avec +41 (ou 0041) : 079… serait
 *  lu comme un 07 français. */
export function normaliserMobile(brut: string | null | undefined): string | null {
  const fr = normalizePhone(brut)
  if (fr && /^0[67]\d{8}$/.test(fr)) return fr
  if (fr && MOBILE_SUISSE.test(fr)) return fr
  const be = normalizePhone(brut, 'BE')
  return be && MOBILE_BELGE.test(be) ? be : null
}

/** Affichage lisible : 06 12 34 56 78. Renvoie l'entrée telle quelle si elle
 *  n'est pas normalisable, plutôt que de masquer une donnée existante. */
export function formatPhone(brut: string | null | undefined): string {
  const n = normalizePhone(brut)
  if (!n) return String(brut ?? '')
  // Suisse : +41 79 123 45 67 (mobile ou fixe, indicatif sur deux chiffres).
  if (n.startsWith('+41')) {
    const reste = n.slice(3)
    return `+41 ${reste.slice(0, 2)} ${reste.slice(2, 5)} ${reste.slice(5, 7)} ${reste.slice(7)}`
  }
  // Belge : +32 470 12 34 56 (mobile) ou +32 2 123 45 67 (fixe).
  if (n.startsWith('+32')) {
    const reste = n.slice(3)
    return reste.startsWith('4')
      ? `+32 ${reste.slice(0, 3)} ${reste.slice(3, 5)} ${reste.slice(5, 7)} ${reste.slice(7)}`
      : `+32 ${reste.slice(0, 1)} ${reste.slice(1, 4)} ${reste.slice(4, 6)} ${reste.slice(6)}`.trim()
  }
  return n.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

// ── Choix du pays à l'inscription (2026-11-14) ──────────────────────────────────────────────────
//
// Une liste déroulante (FR +33, BE +32, CH +41) précède le champ du numéro : on sait alors de quel pays il
// vient, y compris pour un mobile suisse (079…) qu'on ne pouvait pas distinguer d'un 07 français.
// Le pays, une fois le numéro confirmé par SMS, décide du format de l'identifiant d'entreprise et
// des mentions du profil (`lib/facture.ts`, `reglesPays`).

export type ChoixPaysTelephone = { code: PaysTelephone; indicatif: string; libelle: string; exemple: string }

export const PAYS_TELEPHONE: readonly ChoixPaysTelephone[] = [
  { code: 'FR', indicatif: '+33', libelle: 'France', exemple: '06 12 34 56 78' },
  { code: 'BE', indicatif: '+32', libelle: 'Belgique', exemple: '0470 12 34 56' },
  { code: 'CH', indicatif: '+41', libelle: 'Suisse', exemple: '079 123 45 67' },
]

/** Le numéro saisi dans le champ, sous le pays choisi dans la liste, en forme canonique
 *  (06… / +32… / +41…) ; `null` s'il est inutilisable. Le zéro de tête peut manquer (« 470 12 34 56 »),
 *  et un numéro tapé en entier avec son indicatif (« +41 79… ») est lu tel quel, quel que soit le pays
 *  choisi : on ne devine pas contre ce que la personne a écrit. */
export function telephoneDuPays(brut: string | null | undefined, pays: PaysTelephone): string | null {
  const n = String(brut ?? '').trim().replace(/[\s.\-()]/g, '')
  if (!n) return null
  if (n.startsWith('+') || n.startsWith('00')) return normalizePhone(n, pays)
  return normalizePhone(/^0/.test(n) ? n : '0' + n, pays)
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
