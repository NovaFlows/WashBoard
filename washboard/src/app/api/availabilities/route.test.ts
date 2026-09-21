import { describe, it, expect, vi, beforeEach } from 'vitest'

// Route de création d'une plage d'ouverture. Le point sensible ajouté ici :
// une minute qui n'est pas un multiple de 30 (ex. 17:07) glissée par un
// laveur qui tape dans le champ, ou par un appel direct qui ignore
// step="1800" — elle romprait l'alignement que suppose `generateSlots` côté
// réservation publique, et pouvait faire disparaître tous les créneaux du
// jour sans qu'aucune erreur ne le signale.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: unknown
  washer: Reponse
  insert: Reponse
}

function nouveauBuilder(table: string) {
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: self,
    eq: self,
    insert: self,
    single: () => Promise.resolve(table === 'washers' ? plan.washer : plan.insert),
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))

const { POST } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/availabilities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  plan = {
    utilisateur: { id: 'user-1' },
    washer: { data: { id: 'washer-1' }, error: null },
    insert: { data: { id: 'slot-1', day_of_week: 5, start_time: '09:00', end_time: '18:00' }, error: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/availabilities — chemin nominal', () => {
  it('accepte une plage alignée sur le pas de 30 min', async () => {
    const res = await POST(requete({ day_of_week: 5, start_time: '09:00', end_time: '18:00' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe('slot-1')
  })
})

describe('POST /api/availabilities — validations', () => {
  it('refuse sans utilisateur authentifié', async () => {
    plan.utilisateur = null
    const res = await POST(requete({ day_of_week: 5, start_time: '09:00', end_time: '18:00' }))
    expect(res.status).toBe(401)
  })

  it('refuse si le profil laveur est introuvable', async () => {
    plan.washer = { data: null, error: null }
    const res = await POST(requete({ day_of_week: 5, start_time: '09:00', end_time: '18:00' }))
    expect(res.status).toBe(404)
  })

  it('refuse des champs manquants', async () => {
    const res = await POST(requete({ day_of_week: 5, start_time: '09:00' }))
    expect(res.status).toBe(400)
  })

  it('refuse un jour hors de 0-6', async () => {
    const res = await POST(requete({ day_of_week: 7, start_time: '09:00', end_time: '18:00' }))
    expect(res.status).toBe(400)
  })

  it('refuse une fin avant ou égale au début', async () => {
    const res = await POST(requete({ day_of_week: 5, start_time: '18:00', end_time: '09:00' }))
    expect(res.status).toBe(400)
  })

  it('refuse un horaire de début non aligné sur 30 min', async () => {
    const res = await POST(requete({ day_of_week: 5, start_time: '17:07', end_time: '20:00' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/30 minutes/)
  })

  it('refuse un horaire de fin non aligné sur 30 min', async () => {
    const res = await POST(requete({ day_of_week: 5, start_time: '09:00', end_time: '18:15' }))
    expect(res.status).toBe(400)
  })
})
