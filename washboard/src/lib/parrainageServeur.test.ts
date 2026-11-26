import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/push', () => ({ notifierLaveur: vi.fn(async () => {}), notifierEquipe: vi.fn(async () => {}) }))
vi.mock('@/lib/email', () => ({ sendParrainageRecompense: vi.fn(async () => ({})) }))

const { recompenserParrain } = await import('./parrainageServeur')

type Ligne = Record<string, unknown>

/** Base en mémoire : juste ce que `recompenserParrain` utilise. */
function fausseBase(tables: Record<string, Ligne[]>, pannes: { ecritureParrain?: boolean; concurrent?: (parrain: Ligne) => void } = {}) {
  return {
    auth: { admin: { getUserById: async () => ({ data: { user: { email: 'parrain@exemple.fr' } }, error: null }) } },
    from(table: string) {
      const filtres: ((l: Ligne) => boolean)[] = []
      let maj: Ligne | null = null
      const lignes = () => (tables[table] ?? []).filter(l => filtres.every(f => f(l)))
      const b: Record<string, unknown> = {}
      const appliquer = () => {
        if (!maj) return lignes()
        if (table === 'washers' && pannes.ecritureParrain) return null
        // Un autre paiement modifie le parrain entre la lecture et l'écriture.
        if (table === 'washers' && pannes.concurrent) for (const l of tables.washers) pannes.concurrent(l)
        const touchees = lignes()
        for (const l of touchees) Object.assign(l, maj)
        return touchees
      }
      Object.assign(b, {
        select: () => b,
        update: (v: Ligne) => { maj = v; return b },
        eq: (c: string, v: unknown) => { filtres.push(l => l[c] === v); return b },
        is: (c: string, v: unknown) => { filtres.push(l => (l[c] ?? null) === v); return b },
        maybeSingle: async () => {
          const r = appliquer()
          if (r === null) return { data: null, error: { message: 'panne' } }
          return { data: r[0] ?? null, error: null }
        },
        then: (ok: (v: unknown) => void) => {
          const r = appliquer()
          ok(r === null ? { data: null, error: { message: 'panne' } } : { data: r, error: null })
        },
      })
      return b
    },
  }
}

const NOW = new Date('2026-11-20T10:00:00.000Z')
let tables: Record<string, Ligne[]>

beforeEach(() => {
  tables = {
    parrainages: [{ id: 'pg1', parrain_id: 'bell', filleul_id: 'clean', recompense_le: null }],
    washers: [{ id: 'bell', name: 'Bell Auto', user_id: 'u1', plan: 'starter', subscription_status: 'active', subscription_ends_at: '2026-12-05T00:00:00.000Z' }],
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('recompenserParrain', () => {
  it('applique le mois au parrain et le note sur le parrainage', async () => {
    const r = await recompenserParrain(fausseBase(tables) as never, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    expect(r).toMatchObject({ statut: 'recompense', parrainNom: 'Bell Auto', forme: 'abonnement' })
    expect(tables.washers[0]).toMatchObject({ subscription_ends_at: '2027-01-05T00:00:00.000Z', pro_offert_jusqu_au: '2026-12-20T10:00:00.000Z' })
    expect(tables.parrainages[0]).toMatchObject({ recompense_forme: 'abonnement' })
  })

  it('une seule fois : le second appel (double clic, rattrapage, réactivation) ne donne rien', async () => {
    const base = fausseBase(tables) as never
    await recompenserParrain(base, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    const second = await recompenserParrain(base, { id: 'clean', name: 'CleanCar' }, 'rattrapage', NOW)
    expect(second).toEqual({ statut: 'deja_recompense' })
    expect(tables.washers[0].subscription_ends_at).toBe('2027-01-05T00:00:00.000Z')
  })

  it('compte sans parrain : rien', async () => {
    const r = await recompenserParrain(fausseBase(tables) as never, { id: 'autre', name: 'X' }, 'equipe', NOW)
    expect(r).toEqual({ statut: 'sans_parrain' })
  })

  it('écriture chez le parrain en échec : le verrou est levé pour réessayer plus tard', async () => {
    const r = await recompenserParrain(fausseBase(tables, { ecritureParrain: true }) as never, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    expect(r).toEqual({ statut: 'echec' })
    expect(tables.parrainages[0].recompense_le).toBeNull()
  })

  it('un autre mois écrit chez le parrain pendant le calcul : relu et ajouté, aucun mois perdu', async () => {
    let fois = 0
    const concurrent = (l: Ligne) => { if (fois++ === 0) l.subscription_ends_at = '2027-01-05T00:00:00.000Z' }
    const r = await recompenserParrain(fausseBase(tables, { concurrent }) as never, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    expect(r).toMatchObject({ statut: 'recompense', forme: 'abonnement' })
    expect(tables.washers[0].subscription_ends_at).toBe('2027-02-05T00:00:00.000Z')
  })

  it('concurrence sans fin : échec propre, verrou levé pour le rattrapage de nuit', async () => {
    let n = 0
    const concurrent = (l: Ligne) => { l.subscription_ends_at = new Date(Date.UTC(2027, 0, 1 + n++)).toISOString() }
    const r = await recompenserParrain(fausseBase(tables, { concurrent }) as never, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    expect(r).toEqual({ statut: 'echec' })
    expect(tables.parrainages[0].recompense_le).toBeNull()
  })

  it('parrain dont le compte est fermé : rien n’est écrit chez lui', async () => {
    tables.washers[0].account_status = 'pending_deletion'
    const r = await recompenserParrain(fausseBase(tables) as never, { id: 'clean', name: 'CleanCar' }, 'equipe', NOW)
    expect(r).toMatchObject({ statut: 'recompense', forme: 'aucune' })
    expect(tables.washers[0].subscription_ends_at).toBe('2026-12-05T00:00:00.000Z')
  })
})
