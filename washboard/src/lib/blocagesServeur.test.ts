import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lireBlocages } from './blocagesServeur'

/** Client minimal : chaque `select` reçoit la réponse suivante de la liste. */
function client(reponses: { data: unknown; error: unknown }[]) {
  const selects: string[] = []
  const c = {
    from: () => ({
      select: (colonnes: string) => {
        selects.push(colonnes)
        return { eq: async () => reponses.shift() }
      },
    }),
  }
  return { c: c as unknown as SupabaseClient, selects }
}

const plage = { start_date: '2026-11-09', end_date: '2026-11-09', team_members_off: 1, start_time: '08:00:00', end_time: '12:00:00' }

describe('lireBlocages', () => {
  it('lit les heures des plages bloquées, jamais le motif', async () => {
    const { c, selects } = client([{ data: [plage], error: null }])
    const r = await lireBlocages(c, 'w-1')
    expect(r).toEqual({ data: [plage], error: null })
    expect(selects).toEqual(['start_date, end_date, team_members_off, start_time, end_time'])
  })

  it('avant la migration : relit sans les heures (journées entières, comme avant)', async () => {
    const sansHeures = { start_date: '2026-11-09', end_date: '2026-11-09', team_members_off: 1 }
    const { c, selects } = client([
      { data: null, error: { code: '42703', message: 'column unavailabilities.start_time does not exist' } },
      { data: [sansHeures], error: null },
    ])
    const r = await lireBlocages(c, 'w-1', { avecId: true })
    expect(r).toEqual({ data: [sansHeures], error: null })
    expect(selects[1]).toBe('id, start_date, end_date, team_members_off')
  })

  it('une vraie panne reste une erreur (jamais « aucun congé »)', async () => {
    const panne = { code: '42501', message: 'permission denied' }
    const { c, selects } = client([{ data: null, error: panne }])
    const r = await lireBlocages(c, 'w-1')
    expect(r.error).toEqual(panne)
    expect(selects).toHaveLength(1)
  })
})
