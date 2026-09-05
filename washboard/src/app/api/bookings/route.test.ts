import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de la route de création de réservation — la seule porte d'entrée
// publique en écriture du produit, et donc celle qui concentre les correctifs
// de l'audit du 2026-09-05 : prix recalculé, prestation cloisonnée, date et
// créneau contrôlés, zone respectée, capacité vérifiée sans course.
//
// La couche Supabase est remplacée par un faux client : on vérifie ce que la
// route DÉCIDE, pas ce que la base répond.

const rpcAppels: { nom: string; args: Record<string, unknown> }[] = []

type Reponse = { data?: unknown; error?: unknown; count?: number }

let plan: {
  tables: Record<string, Reponse>
  countJour: number
  rpc: Reponse
  utilisateur: unknown
}

function nouveauBuilder(table: string) {
  let head = false
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: (_cols?: string, opts?: { head?: boolean }) => { head = !!opts?.head; return b },
    eq: self, neq: self, gte: self, lte: self, in: self, order: self, limit: self,
    single:      () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    maybeSingle: () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(
        head ? { count: plan.countJour, error: null }
             : (plan.tables[table] ?? { data: [], error: null }),
      ).then(ok, ko),
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  rpc: (nom: string, args: Record<string, unknown>) => {
    rpcAppels.push({ nom, args })
    return Promise.resolve(plan.rpc)
  },
  auth: {
    getUser: async () => ({ data: { user: plan.utilisateur } }),
    admin: { getUserById: async () => ({ data: { user: { email: 'laveur@test.fr' } } }) },
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxClient }))
vi.mock('@/lib/email', () => ({
  sendBookingRequest: vi.fn(async () => {}),
  sendWasherNotification: vi.fn(async () => {}),
}))
vi.mock('@/lib/push', () => ({ notifierLaveur: vi.fn(async () => {}) }))
vi.mock('@/lib/travelFee', () => ({ computeTravelFee: vi.fn(async () => 0) }))
vi.mock('@/lib/googleMaps', () => ({ getMapsApiKey: () => 'cle-test' }))

const { POST } = await import('./route')

// Vendredi 11 septembre 2026, 08:00 UTC = 10:00 à Paris (heure d'été).
const CRENEAU = '2026-09-11T08:00:00Z'
const WASHER  = '11111111-1111-4111-8111-111111111111'
const SERVICE = '22222222-2222-4222-8222-222222222222'

const SERVICE_DEFAUT = {
  name: 'Lavage complet', price: 60, vehicle_price_overrides: null,
  duration_minutes: 60, addons: [], washer_id: WASHER,
}

function corps(extra: Record<string, unknown> = {}) {
  return {
    washer_id: WASHER, service_id: SERVICE,
    vehicle_type: 'citadine', vehicle_count: 1,
    address: '3 rue Colbert, 89000 Auxerre',
    scheduled_at: CRENEAU,
    client_name: 'Jean Test', client_email: 'jean@test.fr', client_phone: '0612345678',
    ...extra,
  }
}

function requete(body: Record<string, unknown>) {
  const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`
  return new Request('https://www.washboard.fr/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  rpcAppels.length = 0
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T09:00:00Z'))
  plan = {
    countJour: 0,
    utilisateur: null,
    rpc: { data: { id: 'ok' }, error: null },
    tables: {
      washers: { data: {
        name: 'Kooki Clean', phone: '0600000000', user_id: 'user-1',
        google_refresh_token: null, team_size: 1,
        subscription_status: 'active', trial_ends_at: null, subscription_ends_at: null,
        grandfathered: false, zone_config: { enabled: false },
      }, error: null },
      services: { data: SERVICE_DEFAUT, error: null },
      unavailabilities: { data: [], error: null },
      availabilities:   { data: [{ day_of_week: 5, start_time: '09:00', end_time: '18:00' }], error: null },
      bookings: { data: [], error: null },
    },
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function poster(extra: Record<string, unknown> = {}) {
  const res = await POST(requete(corps(extra)))
  return { res, body: await res.json() }
}

function avecWasher(champs: Record<string, unknown>) {
  plan.tables.washers = {
    data: { ...(plan.tables.washers.data as Record<string, unknown>), ...champs },
    error: null,
  }
}

describe('POST /api/bookings — chemin nominal', () => {
  it('accepte une réservation valide et la confie à la fonction atomique', async () => {
    const { res } = await poster()
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(1)
    expect(rpcAppels[0].nom).toBe('create_booking_atomic')
  })

  it('transmet la fin du créneau, sans quoi la base ne peut rien vérifier', async () => {
    await poster()
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    // 60 minutes de prestation à partir de 08:00 UTC.
    expect(reserv.ends_at).toBe('2026-09-11T09:00:00.000Z')
  })

  it('multiplie la durée par le nombre de véhicules', async () => {
    await poster({ vehicle_count: 3 })
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.ends_at).toBe('2026-09-11T11:00:00.000Z')
  })
})

describe('POST /api/bookings — le prix ne vient jamais du navigateur (H1)', () => {
  it('ignore un prix soufflé par le client', async () => {
    // Le cas signalé : `booked_price: 0.01` était enregistré tel quel, reçu
    // PDF et comptabilité du laveur compris.
    await poster({ booked_price: 0.01 })
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.booked_price).toBe(60)
  })

  it('ignore une option inventée et retarife celles du catalogue', async () => {
    plan.tables.services = { data: {
      ...SERVICE_DEFAUT,
      addons: [{ id: 'cire', label: 'Cire', price: 15, category: 'exterieur' }],
    }, error: null }

    await poster({ selected_addons: [
      { id: 'cire',  label: 'Cire',   price: 1,    category: 'exterieur' },
      { id: 'bidon', label: 'Cadeau', price: -500, category: 'exterieur' },
    ] })

    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.booked_price).toBe(75) // 60 + 15, l'option inventée vaut 0
  })
})

describe('POST /api/bookings — cloisonnement entre laveurs (H2)', () => {
  it('refuse une prestation qui appartient à un autre laveur', async () => {
    plan.tables.services = { data: { ...SERVICE_DEFAUT, washer_id: 'un-autre-laveur' }, error: null }
    const { res, body } = await poster()
    expect(res.status).toBe(404)
    expect(body.error).toBe('Prestation introuvable')
    expect(rpcAppels).toHaveLength(0)
  })
})

describe('POST /api/bookings — le moment demandé (H3)', () => {
  it('refuse une date déjà passée', async () => {
    const { res } = await poster({ scheduled_at: '2020-06-01T08:00:00Z' })
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse une date au-delà de l horizon de réservation', async () => {
    const { res } = await poster({ scheduled_at: '2030-06-01T08:00:00Z' })
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un créneau hors des horaires du laveur', async () => {
    // 01:00 UTC = 03:00 à Paris, un vendredi : jamais proposé par l'interface.
    const { res, body } = await poster({ scheduled_at: '2026-09-11T01:00:00Z' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/horaires/)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un créneau un jour de fermeture', async () => {
    plan.tables.availabilities = { data: [{ day_of_week: 1, start_time: '09:00', end_time: '18:00' }], error: null }
    const { res } = await poster()
    expect(res.status).toBe(409)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse une prestation qui déborderait après la fermeture', async () => {
    plan.tables.services = { data: { ...SERVICE_DEFAUT, duration_minutes: 600 }, error: null }
    const { res } = await poster()
    expect(res.status).toBe(409)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse plutôt que de réserver à l aveugle si les horaires sont illisibles', async () => {
    plan.tables.availabilities = { data: null, error: { message: 'GRANT manquant' } }
    const { res } = await poster()
    expect(res.status).toBe(503)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse plutôt que de réserver à l aveugle si les congés sont illisibles', async () => {
    plan.tables.unavailabilities = { data: null, error: { message: 'GRANT manquant' } }
    const { res } = await poster()
    expect(res.status).toBe(503)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un jour de congé complet, avec un message qui l explique', async () => {
    plan.tables.unavailabilities = { data: [
      { start_date: '2026-09-10', end_date: '2026-09-12', team_members_off: 1 },
    ], error: null }
    const { res, body } = await poster()
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/absent/)
    expect(rpcAppels).toHaveLength(0)
  })
})

describe('POST /api/bookings — zone desservie (H3)', () => {
  it('refuse une adresse hors zone', async () => {
    avecWasher({ zone_config: { enabled: true, type: 'departments', departments: ['89'] } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ features: [{ properties: { context: '13, Bouches-du-Rhône, PACA' } }] }),
    } as unknown as Response)))

    const { res, body } = await poster({ address: '1 rue X, 13001 Marseille' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/zone/)
    expect(rpcAppels).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('laisse passer une adresse dans la zone', async () => {
    avecWasher({ zone_config: { enabled: true, type: 'departments', departments: ['89'] } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ features: [{ properties: { context: '89, Yonne, Bourgogne' } }] }),
    } as unknown as Response)))

    const { res } = await poster()
    expect(res.status).toBe(201)
    vi.unstubAllGlobals()
  })
})

describe('POST /api/bookings — capacité et concurrence (H4)', () => {
  it('transmet la capacité du jour à la fonction atomique', async () => {
    avecWasher({ team_size: 3 })
    await poster()
    expect(rpcAppels[0].args.p_capacity).toBe(3)
  })

  it('déduit les absences de la capacité du jour', async () => {
    avecWasher({ team_size: 3 })
    plan.tables.unavailabilities = { data: [
      { start_date: '2026-09-11', end_date: '2026-09-11', team_members_off: 2 },
    ], error: null }
    await poster()
    expect(rpcAppels[0].args.p_capacity).toBe(1)
  })

  it('traduit un créneau plein en refus clair, pas en erreur serveur', async () => {
    plan.rpc = { data: null, error: { message: 'SLOT_TAKEN' } }
    const { res, body } = await poster()
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/réservé/)
  })

  it('remonte une vraie panne d écriture comme une erreur serveur', async () => {
    plan.rpc = { data: null, error: { message: 'connexion perdue' } }
    const { res } = await poster()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/bookings — garde-fous existants', () => {
  it('refuse un abonnement expiré au-delà du délai de grâce', async () => {
    avecWasher({ subscription_status: 'past_due', subscription_ends_at: '2026-01-01T00:00:00Z' })
    const { res } = await poster()
    expect(res.status).toBe(403)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse au-delà du plafond quotidien du laveur', async () => {
    plan.countJour = 60
    const { res } = await poster()
    expect(res.status).toBe(429)
    expect(rpcAppels).toHaveLength(0)
  })

  it('avale silencieusement une soumission de robot', async () => {
    const { res } = await poster({ hp: 'rempli par un bot' })
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un corps de requête invalide', async () => {
    const res = await POST(requete({ washer_id: 'pas-un-uuid' }))
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })
})
