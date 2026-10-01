import { describe, it, expect, vi, beforeEach } from 'vitest'

// Même capture que support.test.ts : aucun envoi réel, seulement l'objet passé à `.send()`.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0]

describe('sendWasherBookingLocked — le laveur apprend le jour, rien d’autre', () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it('verrou — la fonction refuse le nom du client', async () => {
    const { sendWasherBookingLocked } = await import('./index')
    await sendWasherBookingLocked({
      to: 'laveur@test.fr',
      washerName: 'Kooki Clean',
      scheduledAt: '2026-09-11T08:00:00.000Z',
      // @ts-expect-error — si ce paramètre redevient accepté, la directive devient inutile et la
      // vérification de types échoue : remettre le nom dans cet email doit être une décision
      // consciente, pas un glissement.
      clientName: 'Nadia Costa',
    })
    expect(envoi().subject).not.toContain('Nadia')
    expect(envoi().html).not.toContain('Nadia')
  })

  it('annonce le jour dans l’objet et le corps, jamais l’heure', async () => {
    const { sendWasherBookingLocked } = await import('./index')
    await sendWasherBookingLocked({ to: 'laveur@test.fr', washerName: 'Kooki Clean', scheduledAt: '2026-09-11T08:00:00.000Z' })
    expect(envoi().subject).toBe('Nouvelle réservation — vendredi 11 septembre')
    expect(envoi().html).toContain('Vendredi 11 septembre')
    expect(envoi().html).not.toMatch(/\b10[:h]00\b/)
  })

  it('deux heures du même jour donnent le même email', async () => {
    // Si l'heure entrait quelque part dans le gabarit, les deux corps différeraient.
    const { sendWasherBookingLocked } = await import('./index')
    const corps = async (quand: string) => {
      await sendWasherBookingLocked({ to: 'laveur@test.fr', washerName: 'Kooki Clean', scheduledAt: quand, appUrl: 'https://app.test' })
      return `${envoi().subject}\n${envoi().html}`
    }
    expect(await corps('2026-09-11T06:30:00.000Z')).toBe(await corps('2026-09-11T15:45:00.000Z'))
  })
})
