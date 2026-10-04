import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// L'id d'une réservation ouvrait ce PDF à lui seul, or le laveur le voit dans son tableau de
// bord même pour une réservation verrouillée (au-delà du quota) : il récupérait ainsi nom,
// téléphone, adresse, heure et prix que le masquage retient partout ailleurs. Le jeton, remis
// au client seul, est désormais ce qui ouvre une réservation verrouillée.

let booking: Record<string, unknown> | null
let washer: Record<string, unknown> | null
let tablesLues: string[] = []

const fauxAdmin = {
  from: (table: string) => {
    tablesLues.push(table)
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      single: () => Promise.resolve(
        table === 'washers'
          ? (washer ? { data: washer, error: null } : { data: null, error: { message: 'panne' } })
          : { data: booking, error: null },
      ),
    })
    return b
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))
vi.mock('@react-pdf/renderer', () => ({ renderToBuffer: vi.fn(async () => Buffer.from('%PDF-test')) }))
vi.mock('@/components/pdf/BookingPDF', () => ({ default: () => null }))
vi.mock('@/components/pdf/FacturePDF', () => ({ default: () => null }))
vi.mock('@/lib/logoFacture', () => ({ logoPourPdf: async () => null }))

// Le seuil de la période est fixé ici ; le masque lui-même (estVerrouillee) reste le vrai.
vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { GET } = await import('./route')
const { genererJetonReservation } = await import('@/lib/bookingToken')
const { renderToBuffer } = await import('@react-pdf/renderer')

const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'
const VERROUILLEE = '2026-09-28T09:00:00.000Z'
const DANS_LE_QUOTA = '2026-09-24T09:00:00.000Z'

function telecharger(jeton?: string | null) {
  const url = `https://www.washboard.fr/api/bookings/${ID}/pdf${jeton != null ? `?jeton=${jeton}` : ''}`
  return GET(new Request(url), { params: Promise.resolve({ id: ID }) })
}

beforeEach(() => {
  vi.stubEnv('BOOKING_LINK_SECRET', 'cle-de-test-pas-un-vrai-secret')
  vi.mocked(renderToBuffer).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  tablesLues = []
  washer = { id: 'washer-1', plan: 'decouverte', created_at: '2026-01-01T00:00:00.000Z' }
  booking = {
    id: ID, washer_id: 'washer-1', status: 'pending', client_name: 'Nadia Costa',
    client_phone: '0633333333', address: '3 rue Colbert, 89000 Auxerre',
    scheduled_at: '2026-10-03T14:30:00.000Z', created_at: VERROUILLEE, saisie_par_laveur: false,
    booked_price: 40, facture_numero: null, facture_contenu: null,
    services: { name: 'Lavage' }, washers: { name: 'Kooki Clean', phone: null },
  }
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('GET /api/bookings/[id]/pdf — id mal formé', () => {
  // Vu en production le 2026-10-04 : un id mal formé (lien cassé, bot, ou
  // `undefined` interpolé côté client dans l'URL) atteignait Postgres tel
  // quel et y déclenchait une vraie erreur serveur (invalid input syntax for
  // type uuid) pour ce qui n'est jamais qu'un lien invalide. Voir lib/uuid.ts.
  it('renvoie 404 sans toucher la base, avant même Postgres', async () => {
    const res = await GET(new Request('https://www.washboard.fr/api/bookings/undefined/pdf'), { params: Promise.resolve({ id: 'undefined' }) })
    expect(res.status).toBe(404)
    expect(tablesLues).toEqual([])
    expect(renderToBuffer).not.toHaveBeenCalled()
  })
})

describe('GET /api/bookings/[id]/pdf — réservation verrouillée', () => {
  it('sert le PDF au client qui présente son jeton', async () => {
    const res = await telecharger(genererJetonReservation(ID))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(renderToBuffer).toHaveBeenCalledOnce()
  })

  it('refuse l’id seul — ce que le laveur connaît', async () => {
    const res = await telecharger()
    expect(res.status).toBe(404)
    expect(renderToBuffer).not.toHaveBeenCalled()
  })

  it('refuse un jeton invalide', async () => {
    const res = await telecharger('pas-le-bon-jeton')
    expect(res.status).toBe(404)
    expect(renderToBuffer).not.toHaveBeenCalled()
  })

  it('refuse le jeton d’une AUTRE réservation', async () => {
    const res = await telecharger(genererJetonReservation('6f1c2a4e-1b2c-4d5e-8f90-123456789abd'))
    expect(res.status).toBe(404)
  })

  it('refuse sans jeton quand la fiche du laveur est illisible, plutôt que de servir en clair', async () => {
    booking = { ...booking, created_at: DANS_LE_QUOTA }
    washer = null
    const res = await telecharger()
    expect(res.status).toBe(404)
    expect(renderToBuffer).not.toHaveBeenCalled()
  })

  it('refuse sans clé serveur, même avec un jeton qui était valide', async () => {
    const jeton = genererJetonReservation(ID)
    vi.stubEnv('BOOKING_LINK_SECRET', '')
    const res = await telecharger(jeton)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/bookings/[id]/pdf — comportement inchangé hors verrouillage', () => {
  it('sert sans jeton une réservation dans le quota (liens déjà envoyés)', async () => {
    booking = { ...booking, created_at: DANS_LE_QUOTA }
    const res = await telecharger()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('recapitulatif-6F1C2A4E.pdf')
  })

  it('sert sans jeton un rendez-vous saisi par le laveur, jamais verrouillé', async () => {
    booking = { ...booking, saisie_par_laveur: true }
    expect((await telecharger()).status).toBe(200)
  })

  it('ne lit pas la fiche du laveur quand le jeton est valide', async () => {
    await telecharger(genererJetonReservation(ID))
    expect(tablesLues).toEqual(['bookings'])
  })

  it('404 pour une réservation inexistante', async () => {
    booking = null
    expect((await telecharger(genererJetonReservation(ID))).status).toBe(404)
  })
})

describe('GET /api/bookings/[id]/pdf — facture déjà émise', () => {
  const FACTURE = {
    facture_numero: 'F-2026-0007',
    facture_emise_le: '2026-10-03T16:00:00.000Z',
    facture_contenu: { vendeur: { logoUrl: null } },
  }

  it.each([
    ['sans jeton', undefined],
    ['avec un jeton invalide', 'pas-le-bon-jeton'],
  ])('reste servie %s, même verrouillée', async (_cas, jeton) => {
    booking = { ...booking, ...FACTURE }
    const res = await telecharger(jeton)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('facture-F-2026-0007-2026-10-03.pdf')
    expect(tablesLues).toEqual(['bookings'])
  })
})
