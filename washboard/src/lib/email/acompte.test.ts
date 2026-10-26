import { describe, it, expect, vi, beforeEach } from 'vitest'

// Même capture que support.test.ts : aucun envoi réel, seulement l'objet passé à `.send()`.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0] as { from: string; subject: string; html: string }
const client = { to: 'julie@example.fr', clientName: 'Julie M.', washerName: 'Malo Lavage' }
// Samedi 24 octobre 2026, 10 h à Paris (UTC+2) ; échéance jeudi 22, 14 h à Paris.
const RDV = '2026-10-24T08:00:00.000Z'
const ECHEANCE = '2026-10-22T12:00:00.000Z'
const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const SOMBRE = 'background:#16161A;'

beforeEach(() => { sendMock.mockClear() })

describe('sendAnnulationAcompte', () => {
  it('un bouton sombre vers la page de réservation du laveur', async () => {
    const { sendAnnulationAcompte } = await import('./index')
    await sendAnnulationAcompte({ ...client, scheduledAt: RDV, lienReservation: 'https://www.washboard.fr/book/malo-lavage' })
    const { html } = envoi()
    const bouton = html.match(/<td align="center" style="([^"]*)"><a href="([^"]*)"[^>]*>([^<]*)<\/a>/)!
    expect(bouton[1]).toContain(SOMBRE)
    expect(bouton[2]).toBe('https://www.washboard.fr/book/malo-lavage')
    expect(bouton[3]).toBe('Réserver un nouveau créneau')
    // Le texte d'origine reste.
    expect(html).toContain('vous pouvez réserver un nouveau créneau depuis la même page.')
  })

  it('sans lien, pas de bouton', async () => {
    const { sendAnnulationAcompte } = await import('./index')
    await sendAnnulationAcompte({ ...client, scheduledAt: RDV })
    expect(envoi().html).not.toContain('Réserver un nouveau créneau')
    expect(envoi().html).not.toContain('<a href=')
  })
})

describe('sendRappelAcompte', () => {
  const acompte = {
    montant: 12.5,
    liens: [{ libelle: 'PayPal', url: 'https://paypal.me/malolavage/12.50EUR' }],
    virement: { titulaire: 'Malo Durand', iban: 'FR76 3000 6000 0112 3456 7890 189', reference: 'WB-6F1C2A4E' },
    wero: { telephone: '06 12 34 56 78', lien: 'https://share.weropay.eu/p/1/c/abc' },
  }

  it('au nom du laveur, échéance en heure de Paris dans l’objet', async () => {
    const { sendRappelAcompte } = await import('./index')
    await sendRappelAcompte({ ...client, scheduledAt: RDV, echeance: ECHEANCE, bookingId: ID, acompte })
    const { from, subject } = envoi()
    expect(from).toBe('Malo Lavage via WashBoard <noreply@washboard.fr>')
    expect(subject).toBe('Rappel : acompte à régler avant le jeudi 22 octobre à 14:00 — Malo Lavage')
  })

  it('montant, conséquence, mêmes moyens de paiement que « Demande reçue », déjà payé', async () => {
    const { sendRappelAcompte } = await import('./index')
    await sendRappelAcompte({ ...client, scheduledAt: RDV, echeance: ECHEANCE, bookingId: ID, acompte })
    const { html } = envoi()
    expect(html).toContain('Acompte à régler : 12,50 €')
    expect(html).toContain('samedi 24 octobre à 10:00')
    expect(html).toContain('Sans paiement enregistré avant le jeudi 22 octobre à 14:00, elle sera annulée automatiquement')
    expect(html).toContain('href="https://paypal.me/malolavage/12.50EUR"')
    expect(html).toContain('FR76 3000 6000 0112 3456 7890 189')
    expect(html).toContain('WB-6F1C2A4E')
    expect(html).toContain('06 12 34 56 78')
    expect(html).toContain('href="https://share.weropay.eu/p/1/c/abc"')
    // Un client qui a payé sans que ce soit noté sera annulé : on ne lui dit pas d’ignorer.
    expect(html).not.toContain('ignorez')
    expect(html).toContain('Si vous avez déjà payé, prévenez <strong>Malo Lavage</strong> avant cette échéance')
    // Boutons de paiement sombres : le bleu est la couleur de WashBoard, pas celle du laveur.
    expect(html).not.toContain('background:#306090')
  })

  it('clé d’idempotence propre à la réservation : un nouvel essai ne double pas l’envoi', async () => {
    const { sendRappelAcompte } = await import('./index')
    await sendRappelAcompte({ ...client, scheduledAt: RDV, echeance: ECHEANCE, bookingId: ID, acompte })
    expect(sendMock.mock.calls.at(-1)![1]).toEqual({ idempotencyKey: `acompte-rappel/${ID}` })
  })

  it('donne le numéro du laveur au client qui a déjà payé, quand il est connu', async () => {
    const { sendRappelAcompte } = await import('./index')
    await sendRappelAcompte({ ...client, washerPhone: '0698765432', scheduledAt: RDV, echeance: ECHEANCE, bookingId: ID, acompte })
    expect(envoi().html).toMatch(/prévenez <strong>Malo Lavage<\/strong> au <strong[^>]*>06 98 76 54 32<\/strong> avant cette échéance/)
  })

  it('échappe ce que le laveur et le client ont saisi', async () => {
    const { sendRappelAcompte } = await import('./index')
    await sendRappelAcompte({ ...client, clientName: '<b>Julie</b>', washerName: 'Malo <script>', scheduledAt: RDV, echeance: ECHEANCE, bookingId: ID, acompte: { montant: 10, liens: [], virement: null, wero: null } })
    expect(envoi().html).not.toContain('<script>')
    expect(envoi().html).not.toContain('<b>Julie</b>')
  })
})
