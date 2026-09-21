import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pendant de `services/route.test.ts` (POST) pour la modification d'une
// prestation existante : même plafond (`DUREE_MAX_MINUTES`), même case
// précise à 800 minutes — c'est en modifiant une prestation existante que la
// durée à 800 min a été constatée sur le compte de test Kooki Clean.

type Reponse = { error?: unknown }

let plan: { updateError: unknown }

const updates: Record<string, unknown>[] = []

const fauxSupabase = {
  from: () => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      update: (valeurs: Record<string, unknown>) => { updates.push(valeurs); return b },
      delete: self,
      eq: self,
      then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ error: plan.updateError }).then(ok, ko),
    })
    return b
  },
}

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase: fauxSupabase, washerId: 'washer-1' } }),
}))

const { PATCH } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/services/service-1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0]
}

const params = Promise.resolve({ id: 'service-1' })

beforeEach(() => {
  updates.length = 0
  plan = { updateError: null }
})

describe('PATCH /api/services/[id] — plafond de durée', () => {
  it('refuse 800 minutes précisément, le cas constaté sur Kooki Clean', async () => {
    const res = await PATCH(requete({ duration_minutes: 800 }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/480/)
    expect(updates).toHaveLength(0)
  })

  it('refuse 800 minutes envoyées en chaîne, comme le fait le formulaire', async () => {
    const res = await PATCH(requete({ duration_minutes: '800' }), { params })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('accepte le plafond exact de 480 minutes', async () => {
    const res = await PATCH(requete({ duration_minutes: 480 }), { params })
    expect(res.status).toBe(200)
    expect(updates[0].duration_minutes).toBe(480)
  })

  it('laisse passer une mise à jour qui ne touche pas la durée', async () => {
    const res = await PATCH(requete({ name: 'ez' }), { params })
    expect(res.status).toBe(200)
    expect(updates[0]).not.toHaveProperty('duration_minutes')
  })
})
