import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const plan: { insert: { data: unknown; error: unknown } } = { insert: { data: null, error: null } }
const inserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: (table: string) => {
      if (table === 'washers') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'w-1' }, error: null }) }) }) }
      }
      return {
        insert: (ligne: Record<string, unknown>) => {
          inserts.push(ligne)
          return { select: () => ({ single: async () => plan.insert }) }
        },
      }
    },
  }),
}))

const { POST } = await import('./route')

function poster(corps: Record<string, unknown>) {
  return POST(new NextRequest('http://localhost/api/unavailabilities', { method: 'POST', body: JSON.stringify(corps) }))
}

const lundi = { start_date: '2026-11-09', end_date: '2026-11-09', label: 'Autre activité', team_members_off: 1 }

beforeEach(() => {
  inserts.length = 0
  plan.insert = { data: { id: 'u-1' }, error: null }
})

describe('POST /api/unavailabilities — plage horaire', () => {
  it('enregistre lundi de 8h à 12h', async () => {
    const res = await poster({ ...lundi, start_time: '08:00', end_time: '12:00' })
    expect(res.status).toBe(201)
    expect(inserts[0]).toMatchObject({ start_date: '2026-11-09', start_time: '08:00', end_time: '12:00', label: 'Autre activité' })
  })

  it('journée entière : aucune colonne d heure envoyée (marche aussi avant la migration)', async () => {
    const res = await poster(lundi)
    expect(res.status).toBe(201)
    expect(inserts[0]).not.toHaveProperty('start_time')
    expect(inserts[0]).not.toHaveProperty('end_time')
  })

  it('refuse une fin avant le début, une heure seule ou un format illisible', async () => {
    for (const heures of [
      { start_time: '12:00', end_time: '08:00' },
      { start_time: '08:00', end_time: '08:00' },
      { start_time: '08:00' },
      { start_time: '8h', end_time: '12h' },
    ]) {
      const res = await poster({ ...lundi, ...heures })
      expect(res.status).toBe(400)
    }
    expect(inserts).toHaveLength(0)
  })

  it('avant la migration : un message clair, jamais une journée entière bloquée à la place', async () => {
    plan.insert = { data: null, error: { code: 'PGRST204', message: "Could not find the 'start_time' column" } }
    const res = await poster({ ...lundi, start_time: '08:00', end_time: '12:00' })
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/plage horaire/)
  })
})
