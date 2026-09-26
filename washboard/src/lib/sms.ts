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

export async function sendSms({ to, content, sender = 'WashBoard' }: { to: string; content: string; sender?: string }): Promise<void> {
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

/** Ce qu'un SMS vers la France coûte réellement en crédits Brevo.
 *
 *  Un crédit n'est PAS un message : c'est une unité de facturation dont le
 *  tarif dépend du pays et de la longueur. Mesuré le 2026-09-26 : le solde est
 *  passé de 900 à 882 pour **un seul** envoi vers un 06 français, livré.
 *
 *  Pourquoi c'est écrit ici plutôt que déduit : Brevo n'expose aucun tarif par
 *  API. Sans cette conversion, « 882 crédits » se lit comme 882 messages alors
 *  qu'il en reste une cinquantaine — une erreur d'un facteur 18 sur la seule
 *  information que le rapport du matin est censé rendre claire.
 *
 *  À revoir si le tarif change ou si des SMS partent vers d'autres pays. */
export const CREDITS_PAR_SMS = 18

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
