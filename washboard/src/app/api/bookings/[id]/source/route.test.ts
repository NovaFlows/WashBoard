import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// « Comment avez-vous connu le laveur ? » — route publique, sans session.
// Deux comportements à vérifier particulièrement : la liste fermée (pas de
// texte libre) et la non-réécriture d'une réponse déjà enregistrée.

type Plan = { booking: Record<string, unknown> | null }
let plan: Plan
const miseAJour = vi.fn()

const fauxAdmin = {
  from: () => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self,
      eq: self,
      update: (valeurs: Record<string, unknown>) => { miseAJour(valeurs); return b },
      maybeSingle: () => Promise.resolve({ data: plan.booking, error: null }),
    })
    return b
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))

const { PATCH } = await import('./route')

function requete(body: unknown) {
  return new NextRequest('https://www.washboard.fr/api/bookings/b1/source', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '203.0.113.1' },
  })
}
const params = Promise.resolve({ id: 'b1' })

beforeEach(() => {
  miseAJour.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  plan = { booking: { id: 'b1', source_decouverte: null } }
})

describe('PATCH /api/bookings/[id]/source', () => {
  it('refuse une valeur hors de la liste fermée', async () => {
    const res = await PATCH(requete({ source: 'Facebook' }), { params })
    expect(res.status).toBe(400)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('enregistre une valeur valide', async () => {
    const res = await PATCH(requete({ source: 'camionnette' }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(miseAJour).toHaveBeenCalledWith({ source_decouverte: 'camionnette' })
  })

  it('ne réécrit pas une réponse déjà enregistrée', async () => {
    plan.booking = { id: 'b1', source_decouverte: 'google' }
    const res = await PATCH(requete({ source: 'instagram' }), { params })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, already: true })
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('renvoie 404 pour une réservation introuvable', async () => {
    plan.booking = null
    const res = await PATCH(requete({ source: 'google' }), { params })
    expect(res.status).toBe(404)
  })
})
