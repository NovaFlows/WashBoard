import { describe, it, expect, vi } from 'vitest'

// Même capture que support.test.ts : aucun envoi réel, seulement l'objet passé à `.send()`.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const QUAND = '2026-10-24T12:00:00.000Z'

// Les 20 emails, avec leurs variantes. Règle de Ryan (2026-10-19) : aucun emoji, ni dans
// l'objet ni dans le corps — un pictogramme utile est une image dessinée (public/email/).
async function tousLesEmails() {
  const m = await import('./index')
  const client = { to: 'c@test.fr', clientName: 'Julie M.', washerName: 'Malo Lavage' }
  const laveur = { to: 'l@test.fr', washerName: 'Malo Lavage', appUrl: 'https://app.test' }
  const resa = { serviceName: 'Lavage', servicePrice: 40, isSmartSlot: true, smartDiscount: 5, address: '1 rue A', scheduledAt: QUAND, bookingId: ID, notes: 'Portail vert' }
  const appels: Array<() => Promise<unknown>> = [
    () => m.sendBookingRequest({ ...client, ...resa, fidelite: { url: 'https://app.test/f', progression: 1, requis: 8, phrase: 'p' }, acompte: { montant: 10, liens: [{ libelle: 'PayPal', url: 'https://p.test' }], virement: { titulaire: 't', iban: 'FR76', reference: 'r' }, wero: { telephone: '06', lien: 'https://w.test' }, conditions: ['c'] } }),
    () => m.sendBookingConfirmation({ ...client, ...resa, clientEmail: 'c@test.fr', washerPhone: '06', jeton: 'j', appUrl: 'https://app.test' }),
    () => m.sendFollowupEmail({ ...client, message: 'Bonjour' }),
    () => m.sendReviewRequest({ ...client, reviewUrl: 'https://g.test' }),
    () => m.sendFacture({ ...client, numero: 'F-1', bookingId: ID, jeton: 'j', appUrl: 'https://app.test' }),
    () => m.sendDocument({ ...client, genre: 'devis', numero: 'D-1', documentId: ID, montantTtc: 10, valableJusquau: '1er novembre', appUrl: 'https://app.test' }),
    () => m.sendDocument({ ...client, genre: 'facture', numero: 'F-2', documentId: ID, montantTtc: 10, appUrl: 'https://app.test' }),
    () => m.sendAnnulationAcompte({ ...client, scheduledAt: QUAND }),
    () => m.sendTamponFidelite({ to: 'c@test.fr', clientName: 'Julie M.', washerName: 'Malo Lavage', url: 'https://app.test/f', tampons: 8, requis: 8, complete: true, phrase: 'p', couleur: '#306090' }),
    () => m.sendWasherNotification({ ...laveur, ...resa, clientName: 'Julie M.', clientEmail: 'c@test.fr', clientPhone: '06', bookedPrice: 40 }),
    () => m.sendWasherBookingLocked({ ...laveur, scheduledAt: QUAND }),
    () => m.sendTrialReminder({ ...laveur, trialEndsAt: QUAND }),
    () => m.sendTrialExpired({ ...laveur, retourGratuit: true }),
    () => m.sendTrialExpired({ ...laveur }),
    () => m.sendSubReminder({ ...laveur, endsAt: QUAND }),
    () => m.sendSubExpired({ ...laveur }),
    () => m.sendSupportReply({ to: 'l@test.fr', titreQuestion: 'Titre', questionId: 'q1', appUrl: 'https://app.test' }),
    () => m.sendGraceEndingWarning({ ...laveur, cutoffDate: QUAND }),
    () => m.sendEmailConfirmation({ to: 'l@test.fr', washerName: 'Malo Lavage', code: '123456' }),
    () => m.sendNouvellesOffres({ ...laveur }),
    () => m.sendAnnoncePwa({ ...laveur }),
    () => m.sendAnnonceBureau({ ...laveur }),
  ]
  const envois: Array<{ subject: string; html: string }> = []
  for (const appel of appels) {
    await appel()
    envois.push(sendMock.mock.calls.at(-1)![0])
  }
  return envois
}

describe('gabarit commun des emails', () => {
  it('aucun emoji, ni dans l’objet ni dans le corps', async () => {
    for (const { subject, html } of await tousLesEmails()) {
      expect(subject).not.toMatch(/\p{Extended_Pictographic}/u)
      expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })

  it('chaque image déclare sa taille et un texte de remplacement', async () => {
    for (const { html } of await tousLesEmails()) {
      for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
        expect(img).toMatch(/\bwidth="\d+"/)
        expect(img).toMatch(/\bheight="\d+"/)
        expect(img).toMatch(/\balt="[^"]*"/)
      }
    }
  })
})
