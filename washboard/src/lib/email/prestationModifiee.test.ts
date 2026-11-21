import { describe, it, expect, vi, beforeEach } from 'vitest'

// Email « réservation mise à jour » : détail à jour comme sur le reçu, jamais d'envoi réel.
const sendMock = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock }
  },
}))

const envoi = () => sendMock.mock.calls.at(-1)![0] as { from: string; subject: string; html: string }
const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const base = {
  to: 'julie@example.fr', clientName: 'Julie M.', washerName: 'AutoNett', washerPhone: '0612345678',
  // Lundi 23 novembre 2026, 16 h à Paris (UTC+1).
  scheduledAt: '2026-11-23T15:00:00.000Z', address: '1 rue de Paris', lieu: null, bookingId: ID,
}

beforeEach(() => { sendMock.mockClear() })

describe('sendPrestationModifiee', () => {
  it('ajout : chaque prestation avec son prix, l’ajoutée marquée, ancien et nouveau total', async () => {
    const { sendPrestationModifiee } = await import('./index')
    await sendPrestationModifiee({
      ...base, prestation: 'Lavage Entier', ajout: true, ancienPrix: 55, nouveauPrix: 155,
      lignes: [{ libelle: 'Lavage extérieur', montant: 55 }, { libelle: 'Lavage Entier', montant: 100 }],
    })
    const { from, subject, html } = envoi()
    expect(from).toBe('AutoNett via WashBoard <noreply@washboard.fr>')
    expect(subject).toBe('AutoNett a ajouté une prestation à votre réservation')
    expect(html).toContain('Réf. 6F1C2A4E')
    expect(html).toContain('lundi 23 novembre 2026')
    expect(html).toContain('16:00')
    expect(html).toContain('1 rue de Paris')
    expect(html).toMatch(/Lavage extérieur<\/td>\s*<td[^>]*>55 €/)
    expect(html).toMatch(/Lavage Entier<span[^>]*>Ajoutée<\/span><\/td>\s*<td[^>]*>100 €/)
    expect(html).toContain('NOUVEAU TOTAL')
    expect(html).toMatch(/line-through;">55 €/)
    expect(html).toContain('155 €')
    expect(html).toContain('06 12 34 56 78')
    // Rendez-vous pas encore confirmé : pas de reçu à télécharger.
    expect(html).not.toContain('Télécharger le reçu')
  })

  it('retrait : la prestation retirée apparaît barrée, avec son montant', async () => {
    const { sendPrestationModifiee } = await import('./index')
    await sendPrestationModifiee({
      ...base, prestation: 'Lavage Entier', ajout: false, ancienPrix: 155, nouveauPrix: 55,
      lignes: [{ libelle: 'Lavage extérieur', montant: 55 }],
    })
    const { subject, html } = envoi()
    expect(subject).toBe('AutoNett a retiré une prestation de votre réservation')
    expect(html).toMatch(/<s>Lavage Entier<\/s><span[^>]*>Retirée<\/span><\/td>\s*<td[^>]*><s>100 €<\/s>/)
    expect(html).not.toContain('>Ajoutée<')
  })

  it('total différent de la somme des lignes (remise) : les noms seuls, le total fait foi', async () => {
    const { sendPrestationModifiee } = await import('./index')
    await sendPrestationModifiee({
      ...base, prestation: 'Lavage Entier', ajout: true, ancienPrix: 45, nouveauPrix: 145,
      lignes: [{ libelle: 'Lavage extérieur', montant: 55 }, { libelle: 'Lavage Entier', montant: 100 }],
    })
    const { html } = envoi()
    expect(html).not.toContain('Montant TTC')
    expect(html).not.toMatch(/>55 €/)
    expect(html).toContain('145 €')
  })

  it('rendez-vous confirmé : bouton vers le reçu PDF à jour', async () => {
    const { sendPrestationModifiee } = await import('./index')
    await sendPrestationModifiee({
      ...base, prestation: 'Lavage Entier', ajout: true, ancienPrix: 55, nouveauPrix: 155, jeton: 'abc', appUrl: 'https://app.test',
      lignes: [{ libelle: 'Lavage extérieur', montant: 55 }, { libelle: 'Lavage Entier', montant: 100 }],
    })
    expect(envoi().html).toContain(`href="https://app.test/api/bookings/${ID}/pdf?jeton=abc"`)
    expect(envoi().html).toContain('Télécharger le reçu à jour')
  })

  it('saisies échappées : nom de prestation, client et adresse', async () => {
    const { sendPrestationModifiee } = await import('./index')
    await sendPrestationModifiee({
      ...base, clientName: '<b>x</b>', address: '<a href="y">', prestation: '<i>P</i>', ajout: true, ancienPrix: 0, nouveauPrix: 10,
      lignes: [{ libelle: '<i>P</i>', montant: 10 }],
    })
    const { html } = envoi()
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<a href="y">')
    expect(html).not.toContain('<i>P</i>')
  })
})
