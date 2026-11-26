import { describe, it, expect, vi, beforeEach } from 'vitest'

const etat = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  laveur: null as Record<string, unknown> | null,
  filleuls: 0,
  reservations: 0,
  aFeter: [] as Record<string, unknown>[],
  majs: [] as { table: string; valeurs: Record<string, unknown>; filtres: [string, unknown][] }[],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: etat.user } }) } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let maj: Record<string, unknown> | null = null
      let compte = false
      const filtres: [string, unknown][] = []
      const b: Record<string, unknown> = {}
      const fin = () => {
        if (maj) { etat.majs.push({ table, valeurs: maj, filtres }); return { error: null } }
        if (table === 'parrainages' && compte) return { count: etat.filleuls, error: null }
        if (table === 'bookings') return { count: etat.reservations, error: null }
        return { data: etat.aFeter, error: null }
      }
      Object.assign(b, {
        select: (_c: string, o?: { count?: string }) => { compte = !!o?.count; return b },
        update: (v: Record<string, unknown>) => { maj = v; return b },
        eq: (c: string, v: unknown) => { filtres.push([c, v]); return b },
        is: () => b, not: () => b, neq: () => b, order: () => b, limit: () => b,
        maybeSingle: async () => ({ data: etat.laveur, error: null }),
        then: (ok: (v: unknown) => void) => ok(fin()),
      })
      return b
    },
  }),
}))

const { GET, POST } = await import('./route')
const poster = (corps: unknown) => POST(new Request('https://x/api', { method: 'POST', body: JSON.stringify(corps) }))

beforeEach(() => {
  etat.user = { id: 'u1' }
  etat.laveur = { id: 'w1', created_at: '2026-01-01T00:00:00Z', parrainage_carte_revoir_le: null }
  etat.filleuls = 0
  etat.reservations = 0
  etat.aFeter = []
  etat.majs = []
})

describe('/api/parrainage/accueil', () => {
  it('sans session : rien à afficher, et aucune écriture possible', async () => {
    etat.user = null
    expect(await (await GET()).json()).toEqual({ carte: false, celebration: null })
    expect((await poster({ action: 'fermer_carte' })).status).toBe(401)
    expect(etat.majs).toHaveLength(0)
  })

  it('carte visible pour un compte ancien sans filleul, cachée dès qu’il parraine', async () => {
    expect((await (await GET()).json()).carte).toBe(true)
    etat.filleuls = 1
    expect((await (await GET()).json()).carte).toBe(false)
  })

  it('célébration : le nom du filleul et la phrase du gain', async () => {
    etat.aFeter = [{ recompense_forme: 'pro_offert', recompense_detail: { pro_offert_jusqu_au: '2026-12-20T10:00:00Z' }, filleul: { name: 'CleanCar 77' } }]
    const { celebration } = await (await GET()).json()
    expect(celebration.filleul).toBe('CleanCar 77')
    expect(celebration.phrase).toMatch(/Pro jusqu’au 20 décembre/)
  })

  it('fermer la carte écrit une date de retour entre 14 et 28 jours, sur son propre compte', async () => {
    await poster({ action: 'fermer_carte' })
    const maj = etat.majs[0]
    expect(maj.table).toBe('washers')
    expect(maj.filtres).toContainEqual(['id', 'w1'])
    const jours = (new Date(maj.valeurs.parrainage_carte_revoir_le as string).getTime() - Date.now()) / 86_400_000
    expect(jours).toBeGreaterThan(13.9)
    expect(jours).toBeLessThan(28.1)
  })

  it('célébration vue : marquée sur ses propres parrainages seulement', async () => {
    await poster({ action: 'celebre' })
    expect(etat.majs[0].table).toBe('parrainages')
    expect(etat.majs[0].filtres).toContainEqual(['parrain_id', 'w1'])
  })

  it('action inconnue refusée', async () => {
    expect((await poster({ action: 'plan', plan: 'business' })).status).toBe(400)
    expect(etat.majs).toHaveLength(0)
  })
})
