import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { logger } = await import('./logger')
const {
  SOURCES_ACQUISITION, estSourceAcquisition, destinationSelonFiche, etatOnboarding,
} = await import('./onboarding')

beforeEach(() => vi.clearAllMocks())

describe('estSourceAcquisition', () => {
  it('accepte les cinq réponses proposées', () => {
    expect(SOURCES_ACQUISITION.map(s => s.valeur)).toEqual(['instagram', 'tiktok', 'google', 'recommandation', 'autre'])
    for (const s of SOURCES_ACQUISITION) expect(estSourceAcquisition(s.valeur)).toBe(true)
  })

  it('refuse tout le reste', () => {
    for (const v of ['Instagram', 'facebook', '', null, undefined, 42, {}]) {
      expect(estSourceAcquisition(v), String(v)).toBe(false)
    }
  })
})

describe('destinationSelonFiche', () => {
  it('onboarding pas encore fait : /onboarding', () => {
    expect(destinationSelonFiche({ onboarding_complete_at: null })).toBe('/onboarding')
  })

  it('onboarding terminé (ou compte antérieur, rempli au déploiement) : /dashboard', () => {
    expect(destinationSelonFiche({ onboarding_complete_at: '2026-10-01T08:00:00Z' })).toBe('/dashboard')
  })

  it('colonne absente de la fiche : traitée comme non faite', () => {
    expect(destinationSelonFiche({})).toBe('/onboarding')
  })

  it('pas de fiche : /dashboard, qui gère la session orpheline', () => {
    expect(destinationSelonFiche(null)).toBe('/dashboard')
  })
})

describe('etatOnboarding', () => {
  function base(reponse: { data: unknown; error: unknown }) {
    const appels: unknown[][] = []
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (...a: unknown[]) => { appels.push(['select', ...a]); return b },
      eq: (...a: unknown[]) => { appels.push(['eq', ...a]); return b },
      maybeSingle: async () => reponse,
    })
    const db = { from: (t: string) => { appels.push(['from', t]); return b } } as unknown as SupabaseClient
    return { db, appels }
  }

  it('nouveau compte : /onboarding avec son lien actuel', async () => {
    const { db, appels } = base({ data: { slug: 'kooki-clean-1f09', onboarding_complete_at: null }, error: null })
    expect(await etatOnboarding(db, 'u-1')).toEqual({ destination: '/onboarding', slug: 'kooki-clean-1f09' })
    expect(appels).toContainEqual(['from', 'washers'])
    expect(appels).toContainEqual(['eq', 'user_id', 'u-1'])
  })

  it('onboarding terminé : /dashboard', async () => {
    const { db } = base({ data: { slug: 'kooki', onboarding_complete_at: '2026-01-01T00:00:00Z' }, error: null })
    expect((await etatOnboarding(db, 'u-1')).destination).toBe('/dashboard')
  })

  it('aucune fiche : /dashboard, sans lien', async () => {
    const { db } = base({ data: null, error: null })
    expect(await etatOnboarding(db, 'u-1')).toEqual({ destination: '/dashboard', slug: null })
  })

  it('colonne pas encore créée (SQL non exécuté) : /dashboard, averti sans alerte', async () => {
    const { db } = base({ data: null, error: { code: '42703', message: 'column washers.onboarding_complete_at does not exist' } })
    expect(await etatOnboarding(db, 'u-1')).toEqual({ destination: '/dashboard', slug: null })
    expect(logger.warn).toHaveBeenCalledWith('onboarding.gate.migration_en_attente', { userId: 'u-1' })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('vraie panne de lecture : /dashboard quand même, mais l’erreur remonte', async () => {
    const panne = { code: '57014', message: 'timeout' }
    const { db } = base({ data: null, error: panne })
    expect((await etatOnboarding(db, 'u-1')).destination).toBe('/dashboard')
    expect(logger.error).toHaveBeenCalledWith('onboarding.gate.read_failed', { userId: 'u-1' }, panne)
  })
})
