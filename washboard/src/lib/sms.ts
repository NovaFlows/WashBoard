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
