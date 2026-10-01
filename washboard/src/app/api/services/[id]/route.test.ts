import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ERREUR_PRESTATION_RESERVEE } from '@/lib/prestation'

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

const { PATCH, DELETE } = await import('./route')

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
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
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

// Suppression : `bookings.service_id` référence `services(id)` sans `ON DELETE`,
// donc une prestation déjà réservée ne peut pas être supprimée (violation de clé
// étrangère, code Postgres 23503). Avant ces tests la route répondait « Une erreur
// interne est survenue » (500) : le laveur ne savait pas que la prestation était
// simplement utilisée. (`plan.updateError` sert ici de réponse à la suppression.)
const appelSuppression = () =>
  DELETE(
    new Request('https://www.washboard.fr/api/services/service-1', { method: 'DELETE' }) as unknown as Parameters<typeof DELETE>[0],
    { params },
  )

describe('DELETE /api/services/[id]', () => {
  it('supprime une prestation sans réservation', async () => {
    const res = await appelSuppression()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('une prestation réservée : 409 avec une phrase claire et un errorId, pas un 500 opaque', async () => {
    plan.updateError = { code: '23503', message: 'violates foreign key constraint "bookings_service_id_fkey"' }
    const res = await appelSuppression()
    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps.error).toBe(ERREUR_PRESTATION_RESERVEE)
    expect(typeof corps.errorId).toBe('string')
  })

  it('le détail technique de la base ne fuit pas dans la réponse', async () => {
    plan.updateError = { code: '23503', message: 'violates foreign key constraint "bookings_service_id_fkey"' }
    const corps = JSON.stringify(await (await appelSuppression()).json())
    expect(corps).not.toContain('bookings_service_id_fkey')
  })

  it('toute autre erreur de base reste une erreur interne (500) : seule la clé étrangère est un cas attendu', async () => {
    plan.updateError = { code: '57014', message: 'canceling statement due to statement timeout' }
    const res = await appelSuppression()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Une erreur interne est survenue.')
  })
})
