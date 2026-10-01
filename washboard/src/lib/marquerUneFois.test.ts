import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { marquerUneFois } from './marquerUneFois'

type Reponse = { data: unknown; error: unknown }

function base(miseAJour: Reponse, relecture: Reponse = { data: null, error: null }) {
  const ecritures: { valeurs: Record<string, unknown>; filtres: unknown[][] }[] = []
  const lectures: unknown[][] = []
  const db = {
    from: () => {
      let ecriture: (typeof ecritures)[number] | null = null
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        update: (valeurs: Record<string, unknown>) => { ecriture = { valeurs, filtres: [] }; ecritures.push(ecriture); return b },
        eq: (...a: unknown[]) => { (ecriture ? ecriture.filtres : lectures).push(['eq', ...a]); return b },
        is: (...a: unknown[]) => { ecriture?.filtres.push(['is', ...a]); return b },
        select: (...a: unknown[]) => {
          if (ecriture) return Promise.resolve(miseAJour)
          lectures.push(['select', ...a])
          return b
        },
        maybeSingle: async () => relecture,
      })
      return b
    },
  } as unknown as SupabaseClient
  return { db, ecritures, lectures }
}

describe('marquerUneFois', () => {
  it('pose la date sur la fiche du laveur, seulement si elle est encore vide', async () => {
    const { db, ecritures } = base({ data: [{ id: 'w-1' }], error: null })
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toEqual({ ok: true })
    expect(ecritures).toHaveLength(1)
    expect(Date.parse(ecritures[0].valeurs.dashboard_tour_complete_at as string)).not.toBeNaN()
    expect(ecritures[0].filtres).toEqual([['eq', 'user_id', 'u-1'], ['is', 'dashboard_tour_complete_at', null]])
  })

  it('écrit les autres valeurs dans la même requête', async () => {
    const { db, ecritures } = base({ data: [{ id: 'w-1' }], error: null })
    await marquerUneFois(db, 'u-1', 'onboarding_complete_at', { acquisition_source: 'google' })
    expect(ecritures[0].valeurs).toEqual({ acquisition_source: 'google', onboarding_complete_at: expect.any(String) })
  })

  it('déjà posée (double envoi) : succès, sans réécrire', async () => {
    const { db, lectures } = base(
      { data: [], error: null },
      { data: { dashboard_tour_complete_at: '2026-10-01T08:00:00Z' }, error: null },
    )
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toEqual({ ok: true })
    expect(lectures).toEqual([['select', 'dashboard_tour_complete_at'], ['eq', 'user_id', 'u-1']])
  })

  it('écriture refusée par la base', async () => {
    const refus = { code: '42501', message: 'permission denied' }
    const { db } = base({ data: null, error: refus })
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toEqual({ ok: false, cause: 'ecriture', erreur: refus })
  })

  it('aucune ligne écrite et date toujours vide (RLS qui filtre en silence) : échec', async () => {
    const { db } = base({ data: [], error: null }, { data: { dashboard_tour_complete_at: null }, error: null })
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toMatchObject({ ok: false, cause: 'non_enregistre' })
  })

  it('aucune ligne écrite et fiche introuvable : échec', async () => {
    const { db } = base({ data: null, error: null }, { data: null, error: null })
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toMatchObject({ ok: false, cause: 'non_enregistre' })
  })

  it('relecture en échec : échec, avec l’erreur de lecture', async () => {
    const panne = { code: '57014', message: 'timeout' }
    const { db } = base({ data: [], error: null }, { data: null, error: panne })
    expect(await marquerUneFois(db, 'u-1', 'dashboard_tour_complete_at')).toEqual({ ok: false, cause: 'non_enregistre', erreur: panne })
  })
})
