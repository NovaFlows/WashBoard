import { describe, it, expect, vi, beforeEach } from 'vitest'

const logError = vi.fn()
const logInfo = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...a: unknown[]) => logError(...a),
    info: (...a: unknown[]) => logInfo(...a),
  },
}))

import { emettreFacture } from './emettreFacture'

// Émission d'une facture : le seul endroit du produit qui consomme un numéro
// de facture. La règle comptable derrière ces tests est qu'une suite de
// numéros ne doit ni sauter, ni servir deux fois — d'où « une réservation déjà
// facturée ne repasse jamais par l'appel qui attribue un numéro ».

/** SIRET valide au sens du contrôle de Luhn, déjà utilisé par facture.test.ts. */
const SIRET = '123 456 789 00007'

const VENDEUR_COMPLET = {
  name: 'Kooki Clean',
  phone: '0600000000',
  facture_statut: 'ei',
  facture_nom_legal: 'Compte de démonstration',
  facture_siret: SIRET,
  facture_adresse: '1 rue de la Démo, 75002 Paris',
  facture_regime_tva: 'franchise',
  facture_taux_tva: null,
  facture_numero_tva: null,
  facture_forme_juridique: null,
  facture_capital: null,
  facture_immatriculation: null,
  logo_url: null,
  brand_color: null,
}

const RESERVATION = {
  id: 'b1',
  washer_id: 'w1',
  facture_numero: null,
  client_name: 'Client de démonstration',
  client_email: 'client@example.com',
  address: '2 rue de la Démo',
  scheduled_at: '2026-09-10T09:00:00.000Z',
  is_professional: false,
  company_name: null,
  siret: null,
  billing_address: null,
  booked_price: 50,
  is_smart_slot: false,
  smart_discount: 0,
  vehicle_count: 1,
  travel_fee: 0,
  vehicles_detail: null,
  selected_addons: null,
  services: { name: 'Lavage complet' },
  washers: VENDEUR_COMPLET,
}

/** Client admin réduit à ce que la fonction en utilise, qui retient ses appels. */
function adminQui(
  lecture: { data: unknown; error: unknown },
  emission: { data: unknown; error: unknown } = { data: [{ numero: 'F-2026-0001' }], error: null },
) {
  const appels: { nom: string; args: unknown }[] = []
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => lecture }) }),
    }),
    rpc: async (nom: string, args: unknown) => {
      appels.push({ nom, args })
      return emission
    },
  }
  return { admin: admin as never, appels }
}

const reservation = (champs: Record<string, unknown> = {}) => ({ ...RESERVATION, ...champs })

beforeEach(() => {
  logError.mockClear()
  logInfo.mockClear()
})

describe('emettreFacture', () => {
  it('émet la facture et rend le numéro attribué par la base', async () => {
    const { admin, appels } = adminQui({ data: reservation(), error: null })

    const r = await emettreFacture(admin, 'b1')

    expect(r).toEqual({ ok: true, numero: 'F-2026-0001', nouvelle: true })
    // Le numéro vient de la base, jamais du code : c'est elle qui verrouille.
    expect(appels).toHaveLength(1)
    expect(appels[0].nom).toBe('emettre_facture')
    expect(appels[0].args).toMatchObject({ p_booking_id: 'b1' })
  })

  it('accepte que la base rende un objet plutôt qu’une liste', async () => {
    const { admin } = adminQui(
      { data: reservation(), error: null },
      { data: { numero: 'F-2026-0002' }, error: null },
    )
    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({
      ok: true, numero: 'F-2026-0002', nouvelle: true,
    })
  })

  it('ne réémet jamais une facture déjà attribuée', async () => {
    // Le cœur de la règle : un second appel (double clic, reprise d'un envoi
    // d'email) doit rendre le numéro existant sans en consommer un nouveau.
    const { admin, appels } = adminQui({
      data: reservation({ facture_numero: 'F-2026-0001' }), error: null,
    })

    const r = await emettreFacture(admin, 'b1')

    expect(r).toEqual({ ok: true, numero: 'F-2026-0001', nouvelle: false })
    expect(appels).toHaveLength(0)
  })

  it('refuse d’émettre tant que les informations de facturation manquent', async () => {
    const { admin, appels } = adminQui({
      data: reservation({ washers: { ...VENDEUR_COMPLET, facture_siret: null, facture_adresse: '  ' } }),
      error: null,
    })

    const r = await emettreFacture(admin, 'b1')

    expect(r).toEqual({
      ok: false,
      raison: 'infos_incompletes',
      manques: ['votre SIRET', 'votre adresse professionnelle'],
    })
    // Une facture incomplète est un document non conforme : aucun numéro n'est
    // consommé, sinon la suite comptable garderait un trou.
    expect(appels).toHaveLength(0)
    expect(logError).not.toHaveBeenCalled()
  })

  it('traite l’absence totale de vendeur comme des informations manquantes', async () => {
    const { admin } = adminQui({ data: reservation({ washers: null }), error: null })

    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({
      ok: false, raison: 'infos_incompletes', manques: ['vos informations de facturation'],
    })
  })

  it('signale une lecture impossible sans rien émettre', async () => {
    const panne = { code: '57014', message: 'timeout' }
    const { admin, appels } = adminQui({ data: null, error: panne })

    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({ ok: false, raison: 'erreur' })
    expect(appels).toHaveLength(0)
    expect(logError).toHaveBeenCalledWith('facture.reservation.read_failed', { bookingId: 'b1' }, panne)
  })

  it('signale une réservation introuvable', async () => {
    const { admin } = adminQui({ data: null, error: null })
    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({ ok: false, raison: 'erreur' })
    expect(logError).toHaveBeenCalled()
  })

  it('signale un échec de l’attribution du numéro', async () => {
    const panne = { message: 'verrou indisponible' }
    const { admin } = adminQui({ data: reservation(), error: null }, { data: null, error: panne })

    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({ ok: false, raison: 'erreur' })
    expect(logError).toHaveBeenCalledWith('facture.emission_failed', { bookingId: 'b1' }, panne)
  })

  it('refuse une émission qui ne rend aucun numéro', async () => {
    // Sans numéro, la facture n'existe pas comptablement : la dire émise
    // laisserait le laveur croire qu'il a un document opposable.
    const { admin } = adminQui({ data: reservation(), error: null }, { data: [{}], error: null })

    await expect(emettreFacture(admin, 'b1')).resolves.toEqual({ ok: false, raison: 'erreur' })
    expect(logError).toHaveBeenCalledWith('facture.emission_sans_numero', { bookingId: 'b1' })
  })
})
