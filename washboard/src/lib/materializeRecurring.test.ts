import { describe, it, expect } from 'vitest'
import { recurringDatesInRange, materializeRecurring } from './materializeRecurring'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('recurringDatesInRange', () => {
  it('une occurrence par mois dans l’intervalle', () => {
    const occ = recurringDatesInRange(15, '2026-01-01', '2026-03-31')
    expect(occ.map(o => o.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('clampe le jour au dernier jour du mois (31 → 28/29 en février)', () => {
    const occ = recurringDatesInRange(31, '2026-01-01', '2026-03-31')
    expect(occ.map(o => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('gère février d’une année bissextile (2028 → 29)', () => {
    const occ = recurringDatesInRange(31, '2028-02-01', '2028-02-29')
    expect(occ.map(o => o.date)).toEqual(['2028-02-29'])
  })

  it('exclut les occurrences hors intervalle (bornes partielles)', () => {
    // le 20 de chaque mois, mais l’intervalle commence le 25 janvier
    const occ = recurringDatesInRange(20, '2026-01-25', '2026-02-28')
    expect(occ.map(o => o.date)).toEqual(['2026-02-20']) // le 2026-01-20 est avant le début
  })

  it('renseigne monthStart et monthEnd corrects', () => {
    const occ = recurringDatesInRange(10, '2026-02-01', '2026-02-28')
    expect(occ[0]).toEqual({
      date: '2026-02-10',
      monthStart: '2026-02-01',
      monthEnd: '2026-02-28',
    })
  })

  it('intervalle vide si dates invalides', () => {
    expect(recurringDatesInRange(10, 'nope', '2026-02-28')).toEqual([])
  })

  it('un seul mois', () => {
    const occ = recurringDatesInRange(5, '2026-06-01', '2026-06-30')
    expect(occ.map(o => o.date)).toEqual(['2026-06-05'])
  })
})

// Faux Supabase : la table des modèles est « awaitable » (resolve templates),
// la table des dépenses expose maybeSingle (existence) et insert (capturé).
function fakeSupabase(templates: unknown[], existingResults: unknown[], inserts: unknown[]): SupabaseClient {
  const queue = [...existingResults]
  return {
    from(table: string) {
      if (table === 'washer_recurring_expenses') {
        const b: Record<string, unknown> = {}
        b.select = () => b
        b.eq = () => b
        b.then = (resolve: (v: unknown) => void) => resolve({ data: templates })
        return b
      }
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = () => b
      b.gte = () => b
      b.lte = () => b
      b.maybeSingle = () => Promise.resolve({ data: queue.length ? queue.shift() : null })
      b.insert = (obj: unknown) => { inserts.push(obj); return Promise.resolve({ data: null }) }
      return b
    },
  } as unknown as SupabaseClient
}

describe('materializeRecurring (avec Supabase mocké)', () => {
  it('ne fait rien sans modèle actif', async () => {
    const inserts: unknown[] = []
    await materializeRecurring(fakeSupabase([], [], inserts), 'w1', '2026-01-01', '2026-03-31')
    expect(inserts).toHaveLength(0)
  })

  it('insère une dépense par mois quand elles n’existent pas encore', async () => {
    const inserts: unknown[] = []
    const templates = [{ id: 't1', day_of_month: 10, category: 'loyer', label: 'Local', amount: 300 }]
    await materializeRecurring(fakeSupabase(templates, [], inserts), 'w1', '2026-01-01', '2026-03-31')
    expect(inserts).toHaveLength(3)
    expect(inserts[0]).toMatchObject({ washer_id: 'w1', date: '2026-01-10', amount: 300, recurring_expense_id: 't1' })
  })

  it('n’insère pas si la dépense du mois existe déjà', async () => {
    const inserts: unknown[] = []
    const templates = [{ id: 't1', day_of_month: 10, category: 'loyer', label: 'Local', amount: 300 }]
    // janvier existe déjà, février/mars non
    await materializeRecurring(fakeSupabase(templates, [{ id: 'x' }, null, null], inserts), 'w1', '2026-01-01', '2026-03-31')
    expect(inserts).toHaveLength(2)
    expect((inserts as { date: string }[]).map(i => i.date)).toEqual(['2026-02-10', '2026-03-10'])
  })
})
