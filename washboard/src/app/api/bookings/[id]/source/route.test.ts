import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// « Comment avez-vous connu le laveur ? » — route publique, sans session.
// Deux comportements à vérifier particulièrement : la liste fermée (pas de
// texte libre) et la non-réécriture d'une réponse déjà enregistrée.

type Plan = { booking: Record<string, unknown> | null }
let plan: Plan
const miseAJour = vi.fn()
const depuis = vi.fn()

const fauxAdmin = {
  from: (table: string) => {
    depuis(table)
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

const ID = '041793cc-1f4c-4d33-a6f2-59f92d86bdae'

function requete(body: unknown, id = ID) {
  return new NextRequest(`https://www.washboard.fr/api/bookings/${id}/source`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': '203.0.113.1' },
  })
}
const params = (id = ID) => Promise.resolve({ id })

beforeEach(() => {
  miseAJour.mockClear()
  depuis.mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  plan = { booking: { id: ID, source_decouverte: null } }
})

describe('PATCH /api/bookings/[id]/source', () => {
  it('refuse une valeur hors de la liste fermée', async () => {
    const res = await PATCH(requete({ source: 'Facebook' }), { params: params() })
    expect(res.status).toBe(400)
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('enregistre une valeur valide', async () => {
    const res = await PATCH(requete({ source: 'camionnette' }), { params: params() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(miseAJour).toHaveBeenCalledWith({ source_decouverte: 'camionnette' })
  })

  it('ne réécrit pas une réponse déjà enregistrée', async () => {
    plan.booking = { id: ID, source_decouverte: 'google' }
    const res = await PATCH(requete({ source: 'instagram' }), { params: params() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, already: true })
    expect(miseAJour).not.toHaveBeenCalled()
  })

  it('renvoie 404 pour une réservation introuvable', async () => {
    plan.booking = null
    const res = await PATCH(requete({ source: 'google' }), { params: params() })
    expect(res.status).toBe(404)
  })

  // Vu en production le 2026-10-04 : un id mal formé (lien cassé, bot, ou
  // `undefined` interpolé côté client dans l'URL) atteignait Postgres tel
  // quel et y déclenchait une vraie erreur serveur (invalid input syntax for
  // type uuid) pour ce qui n'est jamais qu'un lien invalide. Voir lib/uuid.ts.
  it('renvoie 404 sans toucher la base pour un id mal formé, avant même Postgres', async () => {
    const res = await PATCH(requete({ source: 'google' }, 'undefined'), { params: params('undefined') })
    expect(res.status).toBe(404)
    expect(depuis).not.toHaveBeenCalled()
  })
})
