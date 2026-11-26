import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Réservation chez un laveur hors de l'heure de Paris (Cayenne, La Réunion).
//
// Même faux client que route.test.ts, recopié ici pour ne pas toucher à ce
// fichier (branche feat/fuseau-horaire, à fusionner sans conflit). Le fuseau
// est déduit de l'adresse ou du téléphone de la fiche (lib/fuseaux.ts).

const rpcAppels: { nom: string; args: Record<string, unknown> }[] = []
const majAppels: { table: string; valeurs: Record<string, unknown> }[] = []

type Reponse = { data?: unknown; error?: unknown; count?: number }

let plan: {
  tables: Record<string, Reponse>
  /** Réponse d'une lecture par liste d'identifiants (`.in`), quand elle diffère de celle de la table. */
  tablesIn?: Record<string, Reponse>
  countJour: number
  /** Réservations déjà prises ce mois-ci (quota de l'offre). */
  countMois: number
  /** Panne de lecture sur le comptage mensuel. */
  erreurCountMois: unknown
  rpc: Reponse
  utilisateur: unknown
  /** Session du navigateur (cookies) — distincte du client admin, qui n'en a jamais. */
  session: unknown
}

function nouveauBuilder(table: string) {
  let head = false
  // Les deux comptages de cette route portent sur la même table. Celui du
  // quota mensuel se distingue par son `.neq('status', 'cancelled')` : un
  // rendez-vous annulé ne consomme pas le quota du laveur, alors que le
  // plafond anti-spam du jour compte tout.
  let mensuel = false
  let parListe = false
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: (_cols?: string, opts?: { head?: boolean }) => { head = !!opts?.head; return b },
    update: (valeurs: Record<string, unknown>) => { majAppels.push({ table, valeurs }); return b },
    eq: self, gte: self, gt: self, lte: self, in: () => { parListe = true; return b }, order: self, limit: self, or: self, ilike: self,
    upsert: () => Promise.resolve({ error: null }),
    neq: () => { mensuel = true; return b },
    single:      () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    maybeSingle: () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(
        head
          ? (mensuel
              ? { count: plan.countMois, error: plan.erreurCountMois }
              : { count: plan.countJour, error: null })
          : ((parListe ? plan.tablesIn?.[table] : undefined) ?? plan.tables[table] ?? { data: [], error: null }),
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
// Session du navigateur : distincte du client admin (qui n'en a pas). C'est elle qui décide
// si l'auteur est le laveur lui-même, donc libre de forcer ses propres horaires.
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: plan.session } }) } }),
}))
vi.mock('@/lib/email', () => ({
  sendBookingRequest: vi.fn(async () => {}),
  sendWasherNotification: vi.fn(async () => {}),
  sendWasherBookingLocked: vi.fn(async () => {}),
}))
vi.mock('@/lib/push', () => ({ notifierLaveur: vi.fn(async () => {}) }))
vi.mock('@/lib/travelFee', () => ({ computeTravelFee: vi.fn(async () => 0) }))
vi.mock('@/lib/googleMaps', () => ({ getMapsApiKey: () => 'cle-test' }))

// Recuperes apres les `vi.mock` : ce que le laveur RECOIT est au coeur du
// verrouillage, un test qui ne lirait que le code HTTP passerait a cote.
const { notifierLaveur } = vi.mocked(await import('@/lib/push'))
const { sendWasherNotification, sendWasherBookingLocked, sendBookingRequest } = vi.mocked(await import('@/lib/email'))

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
  majAppels.length = 0
  notifierLaveur.mockClear()
  sendWasherNotification.mockClear()
  sendWasherBookingLocked.mockClear()
  sendBookingRequest.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T09:00:00Z'))
  plan = {
    countJour: 0,
    countMois: 0,
    erreurCountMois: null,
    utilisateur: null,
    session: null,
    rpc: { data: { id: 'ok' }, error: null },
    tables: {
      washers: { data: {
        name: 'Kooki Clean', phone: '0600000000', user_id: 'user-1',
        google_refresh_token: null, team_size: 1,
        subscription_status: 'active', trial_ends_at: null, subscription_ends_at: null,
        plan: 'pro', grandfathered: false, zone_config: { enabled: false },
        created_at: '2026-01-15T00:00:00.000Z',
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

// Jeudi 10 décembre 2026, 11:00 UTC = 8 h à Cayenne, 12 h à Paris.
const HUIT_H_CAYENNE = '2026-12-10T11:00:00Z'
const MATIN_JEUDI = [{ day_of_week: 4, start_time: '08:00', end_time: '12:00' }]

describe('POST /api/bookings — laveur de Cayenne', () => {
  beforeEach(() => {
    // Mercredi 9 décembre, 12:00 UTC = 9 h à Cayenne.
    vi.setSystemTime(new Date('2026-12-09T12:00:00Z'))
    plan.tables.availabilities = { data: MATIN_JEUDI, error: null }
  })

  it('accepte 8 h, ouvert de 8 h à 12 h heure de Cayenne', async () => {
    avecWasher({ base_address: '1 Place des Palmistes, 97300 Cayenne' })
    const { res } = await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(1)
  })

  it('le même instant chez un laveur de Paris tombe à 12 h, hors de ses horaires : refusé', async () => {
    const { res, body } = await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/horaires/)
  })

  it('refuse 4 h du matin à Cayenne (8 h à Paris)', async () => {
    avecWasher({ base_address: '1 Place des Palmistes, 97300 Cayenne' })
    const { res } = await poster({ scheduled_at: '2026-12-10T07:00:00Z' })
    expect(res.status).toBe(409)
    expect(rpcAppels).toHaveLength(0)
  })

  it('le numéro guyanais suffit quand la fiche n’a pas d’adresse', async () => {
    avecWasher({ base_address: null, phone: '0694123456' })
    const { res } = await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(res.status).toBe(201)
  })

  it('« le jour même » se juge à la date de Cayenne', async () => {
    // Mercredi 9 à 22 h à Cayenne = jeudi 10 à 2 h à Paris.
    vi.setSystemTime(new Date('2026-12-10T01:00:00Z'))
    avecWasher({ base_address: '97300 Cayenne', reservation_jour_meme: false })
    const { res } = await poster({ scheduled_at: HUIT_H_CAYENNE })
    // Demain pour lui : accepté sans le réglage « jour même ».
    expect(res.status).toBe(201)
  })

  it('… alors que pour un laveur de Paris, c’est aujourd’hui : refusé sans le réglage', async () => {
    vi.setSystemTime(new Date('2026-12-10T01:00:00Z'))
    plan.tables.availabilities = { data: [{ day_of_week: 4, start_time: '09:00', end_time: '18:00' }], error: null }
    const { res, body } = await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/jour même/)
  })

  it('e-mails et notification annoncent 8 h, le jeudi', async () => {
    avecWasher({ base_address: '97300 Cayenne' })
    await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(sendBookingRequest).toHaveBeenCalledWith(expect.objectContaining({ fuseau: 'America/Cayenne' }))
    expect(sendWasherNotification).toHaveBeenCalledWith(expect.objectContaining({ fuseau: 'America/Cayenne' }))
    const notif = notifierLaveur.mock.calls.at(-1)![1] as { body: string }
    expect(notif.body).toContain('jeudi 10 décembre à 08:00')
  })

  it('un laveur de Paris garde ses e-mails et notifications à l’heure de Paris', async () => {
    plan.tables.availabilities = { data: [{ day_of_week: 4, start_time: '09:00', end_time: '18:00' }], error: null }
    await poster({ scheduled_at: HUIT_H_CAYENNE })
    expect(sendWasherNotification).toHaveBeenCalledWith(expect.objectContaining({ fuseau: 'Europe/Paris' }))
    const notif = notifierLaveur.mock.calls.at(-1)![1] as { body: string }
    expect(notif.body).toContain('jeudi 10 décembre à 12:00')
  })
})

describe('POST /api/bookings — laveur de La Réunion (numéro 0692, pas d’adresse)', () => {
  it('9 h à La Réunion = 5 h UTC : accepté dans ses horaires du matin', async () => {
    vi.setSystemTime(new Date('2026-12-09T12:00:00Z'))
    avecWasher({ base_address: null, phone: '0692123456' })
    plan.tables.availabilities = { data: MATIN_JEUDI, error: null }
    const { res } = await poster({ scheduled_at: '2026-12-10T05:00:00Z' })
    expect(res.status).toBe(201)
    expect(sendWasherNotification).toHaveBeenCalledWith(expect.objectContaining({ fuseau: 'Indian/Reunion' }))
  })
})
