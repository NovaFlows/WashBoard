import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// PATCH /api/support/questions/[id] — côté laveur : marquer lu (existant) et
// masquer la conversation de sa liste (« supprimer », glisser vers la gauche dans la
// PWA). Isolable sans base : la date de masquage est calculée côté serveur (jamais
// lue dans le corps), l'écriture est cloisonnée sur le laveur connecté, marque le fil
// lu dans le même appel, et un échec est tracé et renvoyé plutôt qu'avalé.

const updates: Record<string, unknown>[] = []
const filtres: [string, unknown][] = []
let updateError: unknown = null

const supabase = {
  from: () => ({
    update: (valeurs: Record<string, unknown>) => {
      updates.push(valeurs)
      const chaine = {
        eq: (colonne: string, valeur: unknown) => {
          filtres.push([colonne, valeur])
          return filtres.length % 2 === 0 ? Promise.resolve({ error: updateError }) : chaine
        },
      }
      return chaine
    },
  }),
}

vi.mock('@/lib/requireWasher', () => ({
  requireWasher: async () => ({ ok: true, ctx: { supabase, washerId: 'w1' } }),
}))

const { PATCH } = await import('./route')

async function patch(body: unknown) {
  const req = new Request('https://www.washboard.fr/api/support/questions/q1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0]
  const res = await PATCH(req, { params: Promise.resolve({ id: 'q1' }) })
  return { res, json: await res.json() }
}

beforeEach(() => {
  updates.length = 0
  filtres.length = 0
  updateError = null
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('PATCH /api/support/questions/[id]', () => {
  it('masque la conversation : date serveur, fil marqué lu, cloisonné sur le laveur', async () => {
    const { res, json } = await patch({ hidden: true, hidden_for_washer_at: '2020-01-01T00:00:00.000Z' })
    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(updates).toHaveLength(1)
    expect(updates[0].is_read_by_washer).toBe(true)
    // La date du corps est ignorée : celle du serveur est récente.
    expect(new Date(updates[0].hidden_for_washer_at as string).getFullYear()).toBeGreaterThan(2024)
    expect(updates[0].last_read_by_washer_at).toBe(updates[0].hidden_for_washer_at)
    expect(filtres).toEqual([['id', 'q1'], ['washer_id', 'w1']])
  })

  it("ne touche à aucune colonne de l'équipe", async () => {
    await patch({ hidden: true })
    expect(Object.keys(updates[0]).sort()).toEqual(['hidden_for_washer_at', 'is_read_by_washer', 'last_read_by_washer_at'])
  })

  it('renvoie une erreur claire quand l’écriture échoue', async () => {
    updateError = { code: '42501' }
    const { res, json } = await patch({ hidden: true })
    expect(res.status).toBe(503)
    expect(json.error).toContain('Impossible de supprimer')
  })

  it('garde le marquage « lu » tel quel, et refuse le reste', async () => {
    const lu = await patch({ is_read: true })
    expect(lu.res.status).toBe(200)
    expect(updates[0]).not.toHaveProperty('hidden_for_washer_at')
    expect((await patch({ hidden: false })).res.status).toBe(400)
    expect((await patch({})).res.status).toBe(400)
  })
})
