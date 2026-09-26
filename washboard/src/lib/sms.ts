/** Envoi de SMS transactionnels via l'API Brevo. */

/** Normalise un numéro français en format E.164 (+33XXXXXXXXX).
 *  Retourne null si le numéro ne peut pas être normalisé. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  // Déjà en format international
  if (digits.startsWith('33') && digits.length === 11) return `+${digits}`
  // Format local français (06, 07)
  if (digits.length === 10 && digits.startsWith('0')) return `+33${digits.slice(1)}`
  return null
}

/** L'expéditeur affiché quand le laveur n'en a pas d'approuvé à lui.
 *
 *  Brevo n'accepte QUE des identifiants d'expéditeur approuvés à l'avance, et
 *  remplace silencieusement tout autre valeur par celui par défaut du compte.
 *  Vérifié le 2026-09-26 : nous envoyions « Kooki Clean », les clients
 *  recevaient « Nova » — l'identifiant approuvé s'écrit « KookiClean », sans
 *  espace, et la moindre différence suffit à déclencher le remplacement.
 *
 *  D'où ce repli sur un identifiant unique et approuvé, au lieu du nom du
 *  laveur : un nom d'entreprise quelconque n'est par définition jamais
 *  approuvé, donc toujours remplacé. Le nom du laveur, lui, est écrit dans le
 *  CORPS du message — le seul endroit que personne ne peut réécrire.
 *
 *  ⚠️ Doit rester identique à un identifiant approuvé dans le compte Brevo.
 *  Le changer ici sans l'avoir fait approuver là-bas ramène le remplacement
 *  silencieux. */
export const EXPEDITEUR_SMS_DEFAUT = 'WashBoard'

export async function sendSms({ to, content, sender = EXPEDITEUR_SMS_DEFAUT }: { to: string; content: string; sender?: string }): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY manquant')

  const phone = normalizePhone(to)
  if (!phone) throw new Error(`Numéro de téléphone invalide : ${to}`)

  // Brevo: alphanumeric sender max 11 chars, phone number sender in E.164
  const safeSender = sender.slice(0, 11)

  const res = await fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: safeSender,
      recipient: phone,
      content,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo SMS error ${res.status}: ${body}`)
  }
}

/** Ce qu'un SMS d'une longueur normale coûte en crédits Brevo, vers la France.
 *
 *  Un crédit n'est ni un message ni un caractère : c'est une unité de
 *  facturation qui dépend du pays et du nombre de SEGMENTS. Un SMS se découpe
 *  tous les 153 caractères une fois concaténé, et chaque segment se paie.
 *
 *  Mesure du 2026-09-26 : le solde est passé de 900 à 882, soit 18 crédits,
 *  pour un envoi unique de 566 caractères — donc 4 segments, donc environ
 *  4,5 crédits par segment. Arrondi à 5, volontairement pessimiste : mieux
 *  vaut annoncer moins d'envois restants qu'il n'y en a que l'inverse.
 *
 *  ⚠️ Cette conversion suppose un message d'UN segment. Elle sous-estime la
 *  consommation d'un laveur dont le lien d'avis est à rallonge — c'était
 *  précisément le cas de l'envoi mesuré, qui portait une URL de recherche
 *  Google de 468 caractères au lieu d'un lien `g.page` de 39.
 *
 *  Brevo n'expose aucun tarif par API : sans cette conversion, « 882 crédits »
 *  se lirait comme 882 messages. */
export const CREDITS_PAR_SMS = 5

/** Combien de messages le solde représente réellement. */
export function smsRestants(credits: number): number {
  return Math.floor(credits / CREDITS_PAR_SMS)
}

/** En dessous, il est temps de recharger — exprimé en MESSAGES, pas en crédits.
 *
 *  Dix envois, c'est moins d'une semaine d'activité pour un seul laveur qui
 *  demande un avis après chaque prestation. */
export const SEUIL_SMS_BAS = 10

/** Crédits SMS restants chez Brevo, ou `null` si le solde est illisible.
 *
 *  Pourquoi cette fonction existe : les crédits SMS sont prépayés et se
 *  vident sans prévenir. Le 2026-09-15 à 12 h, le solde est tombé à zéro en
 *  plein envoi — la moitié d'un lot est partie, l'autre non, et personne ne
 *  l'a su avant le 26. Un solde affiché tous les matins rend la panne visible
 *  AVANT qu'elle arrive.
 *
 *  Ne lève jamais : un solde illisible ne doit pas faire échouer ce qui
 *  l'affiche. L'appelant distingue « 0 crédit » (panne réelle) de `null`
 *  (information manquante) — les confondre ferait crier au loup. */
export async function soldeSms(): Promise<number | null> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' },
    })
    if (!res.ok) return null
    const compte = await res.json() as { plan?: { type?: string; credits?: number }[] }
    const sms = (compte.plan ?? []).find(p => p.type === 'sms')
    return typeof sms?.credits === 'number' ? sms.credits : null
  } catch {
    return null
  }
}
