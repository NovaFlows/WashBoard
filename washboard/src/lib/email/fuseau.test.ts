import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chaque e-mail lié à un rendez-vous écrit l'heure du LAVEUR (son client est
// au même endroit), et l'heure de Paris quand aucun fuseau n'est donné.
// Même capture que support.test.ts : aucun envoi réel.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0] as { subject: string; html: string }
const texte = () => `${envoi().subject}\n${envoi().html}`

// Jeudi 10 décembre 2026, 11:00 UTC : 8 h à Cayenne, 12 h à Paris.
const RDV = '2026-12-10T11:00:00.000Z'
// Jeudi 10 décembre 2026, 23:30 UTC : 20 h 30 le 10 à Cayenne, 0 h 30 le VENDREDI 11 à Paris.
const SOIR = '2026-12-10T23:30:00.000Z'
const CAYENNE = 'America/Cayenne'

const commun = {
  clientName: 'Inès Martin', clientEmail: 'ines@test.fr', clientPhone: '0694123456',
  washerName: 'Lavage Amazonie', serviceName: 'Lavage complet', address: '1 Place des Palmistes, 97300 Cayenne',
  bookingId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
}

const { sendBookingRequest, sendBookingConfirmation, sendWasherNotification, sendWasherBookingLocked,
  sendRappelRdv, sendAnnulationAcompte, sendRemiseLaveur, sendPrestationModifiee } = await import('./index')

type Cas = [string, (fuseau: string | undefined, quand: string) => Promise<unknown>]
const CAS: Cas[] = [
  ['demande reçue (client)', (fuseau, quand) => sendBookingRequest({ ...commun, to: 'ines@test.fr', servicePrice: 60, scheduledAt: quand, fuseau })],
  ['confirmation (client)', (fuseau, quand) => sendBookingConfirmation({ ...commun, to: 'ines@test.fr', servicePrice: 60, scheduledAt: quand, jeton: null, fuseau })],
  ['nouvelle réservation (laveur)', (fuseau, quand) => sendWasherNotification({ ...commun, to: 'laveur@test.fr', bookedPrice: 60, scheduledAt: quand, fuseau })],
  ['rappel de rendez-vous', (fuseau, quand) => sendRappelRdv({ ...commun, to: 'ines@test.fr', scheduledAt: quand, heures: 24, fuseau })],
  ['annulation faute d’acompte', (fuseau, quand) => sendAnnulationAcompte({ ...commun, to: 'ines@test.fr', scheduledAt: quand, fuseau })],
  ['remise accordée', (fuseau, quand) => sendRemiseLaveur({ ...commun, to: 'ines@test.fr', scheduledAt: quand, ancienPrix: 60, nouveauPrix: 50, fuseau })],
  ['prestation ajoutée', (fuseau, quand) => sendPrestationModifiee({ ...commun, to: 'ines@test.fr', scheduledAt: quand, prestation: 'Cire', ajout: true,
    lignes: [{ libelle: 'Lavage complet', montant: 60 }, { libelle: 'Cire', montant: 15 }], ancienPrix: 60, nouveauPrix: 75, jeton: null, fuseau })],
]

beforeEach(() => { sendMock.mockClear() })

describe('e-mails : l’heure du rendez-vous', () => {
  for (const [nom, envoyer] of CAS) {
    it(`${nom} : 8 h pour un laveur de Cayenne`, async () => {
      await envoyer(CAYENNE, RDV)
      expect(texte()).toContain('08:00')
      expect(texte()).not.toContain('12:00')
    })

    it(`${nom} : 12 h pour un laveur de Paris (comportement d’avant)`, async () => {
      await envoyer(undefined, RDV)
      expect(texte()).toContain('12:00')
      expect(texte()).not.toContain('08:00')
    })

    it(`${nom} : le soir à Cayenne reste le jeudi`, async () => {
      await envoyer(CAYENNE, SOIR)
      expect(texte()).toMatch(/jeudi 10 décembre/i)
      expect(texte()).not.toMatch(/vendredi 11 décembre/i)
      expect(texte()).toContain('20:30')
    })
  }

  it('réservation au-delà du quota : le jour de Cayenne, jamais l’heure', async () => {
    await sendWasherBookingLocked({ to: 'laveur@test.fr', washerName: 'Lavage Amazonie', scheduledAt: SOIR, fuseau: CAYENNE })
    expect(envoi().subject).toBe('Nouvelle réservation — jeudi 10 décembre')
    expect(texte()).not.toContain('20:30')
    await sendWasherBookingLocked({ to: 'laveur@test.fr', washerName: 'Lavage Amazonie', scheduledAt: SOIR })
    expect(envoi().subject).toBe('Nouvelle réservation — vendredi 11 décembre')
  })
})
