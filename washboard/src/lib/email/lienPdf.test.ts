import { describe, it, expect, vi, beforeEach } from 'vitest'

// Même capture que support.test.ts : aucun envoi réel, seulement l'objet passé à `.send()`.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0]
const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const JETON = 'jeton_de-test_43caracteres_xxxxxxxxxxxxxxx'

// Le lien PDF de ces deux emails part chez le client : il doit porter le jeton, sans quoi le
// client d'une réservation verrouillée ne pourrait plus ouvrir son document.
describe('liens PDF envoyés au client', () => {
  beforeEach(() => { sendMock.mockClear() })

  const confirmation = async (jeton: string | null) => {
    const { sendBookingConfirmation } = await import('./index')
    await sendBookingConfirmation({
      to: 'client@test.fr', clientName: 'Nadia Costa', clientEmail: 'client@test.fr',
      washerName: 'Kooki Clean', serviceName: 'Lavage', servicePrice: 40,
      address: '3 rue Colbert, 89000 Auxerre', scheduledAt: '2026-10-03T14:30:00.000Z',
      bookingId: ID, jeton, appUrl: 'https://app.test',
    })
    return envoi().html as string
  }

  const facture = async (jeton: string | null) => {
    const { sendFacture } = await import('./index')
    await sendFacture({
      to: 'client@test.fr', clientName: 'Nadia Costa', washerName: 'Kooki Clean',
      numero: 'F-2026-0007', bookingId: ID, jeton, appUrl: 'https://app.test',
    })
    return envoi().html as string
  }

  it('sendBookingConfirmation — le lien porte le jeton', async () => {
    expect(await confirmation(JETON)).toContain(`href="https://app.test/api/bookings/${ID}/pdf?jeton=${JETON}"`)
  })

  it('sendFacture — le lien porte le jeton', async () => {
    expect(await facture(JETON)).toContain(`href="https://app.test/api/bookings/${ID}/pdf?jeton=${JETON}"`)
  })

  it('sans clé serveur (jeton null), le lien part quand même, sans paramètre vide', async () => {
    expect(await confirmation(null)).toContain(`href="https://app.test/api/bookings/${ID}/pdf"`)
    expect(await facture(null)).toContain(`href="https://app.test/api/bookings/${ID}/pdf"`)
  })

  it('le jeton est obligatoire à l’appel : l’oublier ne compile pas', async () => {
    const { sendFacture } = await import('./index')
    // @ts-expect-error — si `jeton` redevient optionnel, cette directive devient inutile et la
    // vérification de types échoue : un appel qui l'oublie enverrait un lien sans jeton.
    await sendFacture({ to: 'c@test.fr', clientName: 'N', washerName: 'K', numero: 'F-1', bookingId: ID })
    expect(envoi().html).not.toContain('?jeton=')
  })
})
