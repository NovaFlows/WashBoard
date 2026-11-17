import { describe, it, expect } from 'vitest'
import {
  normaliserCode, genererCode, finEssaiFilleul, statutFilleul, recompenseParrain, lienParrainage,
  carteParrainageVisible, dateRetourCarte, phraseRecompense,
} from './parrainage'
import { planEffectif, doitChoisirFormule, hasFeature } from './plan'

const NOW = new Date('2026-11-20T10:00:00.000Z')

describe('normaliserCode', () => {
  it('met en majuscules et retire les espaces', () => {
    expect(normaliserCode('  bellauto-k7p2 ')).toBe('BELLAUTO-K7P2')
  })
  it('refuse tout ce qui n’a pas la forme d’un code', () => {
    for (const brut of ['', 'BELLAUTO', 'BELLAUTO-K7P', 'BELL AUTO-K7P2', '<script>-AAAA', 'A'.repeat(30) + '-AAAA', 42, null, undefined, { code: 'X' }]) {
      expect(normaliserCode(brut)).toBeNull()
    }
  })
})

describe('genererCode', () => {
  it('nom sans accent ni espace, puis 4 caractères faciles à dicter', () => {
    const code = genererCode('Bell’Auto Détailing 77', () => 0)
    expect(code).toBe('BELLAUTODE-AAAA')
    expect(normaliserCode(code)).toBe(code)
  })
  it('nom vide ou trop court : racine par défaut', () => {
    expect(genererCode('é', () => 0)).toBe('WASH-AAAA')
  })
  it('n’utilise jamais de caractère ambigu', () => {
    for (let i = 0; i < 200; i++) expect(genererCode('X1').split('-')[1]).not.toMatch(/[IL01O]/)
  })
})

describe('finEssaiFilleul', () => {
  it('28 jours : 14 d’essai + 14 de bonus', () => {
    expect(finEssaiFilleul(NOW)).toBe('2026-12-18T10:00:00.000Z')
  })
})

describe('statutFilleul', () => {
  it('abonné, en essai ou simplement inscrit', () => {
    expect(statutFilleul({ subscription_status: 'active' }, NOW)).toBe('client')
    expect(statutFilleul({ subscription_status: 'trial', trial_ends_at: '2026-12-01T00:00:00Z' }, NOW)).toBe('essai')
    expect(statutFilleul({ subscription_status: 'trial', trial_ends_at: '2026-11-01T00:00:00Z' }, NOW)).toBe('essai_termine')
    expect(statutFilleul({ subscription_status: 'expired' }, NOW)).toBe('essai_termine')
  })
})

describe('recompenseParrain', () => {
  it('abonné Starter : 1 mois en Pro et paiement repoussé d’un mois', () => {
    const r = recompenseParrain({ plan: 'starter', subscription_status: 'active', subscription_ends_at: '2026-12-05T00:00:00.000Z' }, NOW)
    expect(r).toEqual({
      forme: 'abonnement',
      colonnes: { pro_offert_jusqu_au: '2026-12-20T10:00:00.000Z', subscription_ends_at: '2027-01-05T00:00:00.000Z' },
    })
  })
  it('abonné Pro ou Business : seulement le paiement repoussé, l’offre ne change pas', () => {
    for (const plan of ['pro', 'business']) {
      const r = recompenseParrain({ plan, subscription_status: 'active', subscription_ends_at: '2026-12-05T00:00:00.000Z' }, NOW)
      expect(r).toEqual({ forme: 'abonnement', colonnes: { subscription_ends_at: '2027-01-05T00:00:00.000Z' } })
    }
  })
  it('abonné dont la fin payée est déjà passée : le mois part d’aujourd’hui, jamais dans le passé', () => {
    const r = recompenseParrain({ plan: 'pro', subscription_status: 'active', subscription_ends_at: '2026-10-02T00:00:00.000Z' }, NOW)
    expect(r).toEqual({ forme: 'abonnement', colonnes: { subscription_ends_at: '2026-12-20T10:00:00.000Z' } })
    const starter = recompenseParrain({ plan: 'starter', subscription_status: 'active', subscription_ends_at: '2026-10-02T00:00:00.000Z' }, NOW)
    expect(starter.colonnes.subscription_ends_at).toBe('2026-12-20T10:00:00.000Z')
    expect(phraseRecompense(r)).toBe('Votre prochain paiement est repoussé au 20 décembre.')
  })
  it('abonné sans date de fin connue : l’équipe reporte le paiement à la main', () => {
    expect(recompenseParrain({ plan: 'pro', subscription_status: 'active' }, NOW)).toEqual({ forme: 'abonnement_a_la_main', colonnes: {} })
  })
  it('en essai Pro : l’essai dure un mois de plus', () => {
    const r = recompenseParrain({ plan: 'pro', subscription_status: 'trial', trial_ends_at: '2026-11-25T00:00:00.000Z' }, NOW)
    expect(r).toEqual({ forme: 'essai', colonnes: { trial_ends_at: '2026-12-25T00:00:00.000Z' } })
  })
  it('Découverte ou essai fini : 1 mois de Pro', () => {
    const fini = recompenseParrain({ plan: 'pro', subscription_status: 'trial', trial_ends_at: '2026-11-01T00:00:00.000Z' }, NOW)
    expect(fini).toEqual({ forme: 'pro_offert', colonnes: { pro_offert_jusqu_au: '2026-12-20T10:00:00.000Z' } })
    const arrete = recompenseParrain({ plan: 'starter', subscription_status: 'expired', subscription_ends_at: '2026-10-01T00:00:00Z' }, NOW)
    expect(arrete.forme).toBe('pro_offert')
  })
  it('deux filleuls : le second mois s’ajoute au bout du premier', () => {
    const r = recompenseParrain({ plan: 'decouverte', subscription_status: 'trial', trial_ends_at: '2026-10-01T00:00:00Z', pro_offert_jusqu_au: '2026-12-20T10:00:00.000Z' }, NOW)
    expect(r.colonnes.pro_offert_jusqu_au).toBe('2027-01-20T10:00:00.000Z')
  })
  it('client historique : gagne comme les autres', () => {
    const r = recompenseParrain({ grandfathered: true, plan: 'pro', subscription_status: 'active', subscription_ends_at: '2026-12-15T00:00:00Z' }, NOW)
    expect(r.forme).toBe('abonnement')
    expect(r.colonnes.subscription_ends_at).toBe('2027-01-15T00:00:00.000Z')
  })
})

describe('Pro offert dans l’offre effective', () => {
  const finiDepuisLongtemps = { plan: 'pro', subscription_status: 'trial', trial_ends_at: '2026-10-01T00:00:00Z', created_at: '2026-09-15T00:00:00Z' }
  it('un compte retombé sur Découverte repasse en Pro pendant son mois offert', () => {
    expect(planEffectif(finiDepuisLongtemps, NOW)).toBe('decouverte')
    const offert = { ...finiDepuisLongtemps, pro_offert_jusqu_au: '2026-12-01T00:00:00Z' }
    expect(planEffectif(offert, NOW)).toBe('pro')
    expect(hasFeature(offert, 'creneaux_intelligents')).toBe(true)
    expect(doitChoisirFormule(offert, NOW)).toBe(false)
  })
  it('un Starter passe en Pro, un Business reste Business', () => {
    expect(planEffectif({ plan: 'starter', subscription_status: 'active', pro_offert_jusqu_au: '2026-12-01T00:00:00Z' }, NOW)).toBe('pro')
    expect(planEffectif({ plan: 'business', subscription_status: 'active', pro_offert_jusqu_au: '2026-12-01T00:00:00Z' }, NOW)).toBe('business')
  })
  it('le mois passé, l’offre revient toute seule', () => {
    expect(planEffectif({ plan: 'starter', subscription_status: 'active', pro_offert_jusqu_au: '2026-11-01T00:00:00Z' }, NOW)).toBe('starter')
  })
})

describe('lienParrainage', () => {
  it('lien d’inscription avec le code', () => {
    expect(lienParrainage('https://www.washboard.fr/', 'BELLAUTO-K7P2')).toBe('https://www.washboard.fr/signup?parrain=BELLAUTO-K7P2')
  })
})

describe('phraseRecompense', () => {
  it('dit en clair ce qui a été appliqué', async () => {
    const { phraseRecompense } = await import('./parrainage')
    expect(phraseRecompense({ forme: 'abonnement', colonnes: { subscription_ends_at: '2027-01-05T12:00:00Z', pro_offert_jusqu_au: '2026-12-20T12:00:00Z' } }))
      .toBe('Votre prochain paiement est repoussé au 5 janvier. Vous profitez de l’offre Pro jusqu’au 20 décembre.')
    expect(phraseRecompense({ forme: 'essai', colonnes: { trial_ends_at: '2026-12-25T12:00:00Z' } })).toBe('Votre essai gratuit est prolongé jusqu’au 25 décembre.')
    expect(phraseRecompense({ forme: 'pro_offert', colonnes: { pro_offert_jusqu_au: '2026-12-20T12:00:00Z' } })).toBe('Vous profitez de l’offre Pro jusqu’au 20 décembre.')
  })
})

describe('carte de rappel', () => {
  const base = { createdAt: '2026-11-01T00:00:00Z', revoirLe: null, aDesFilleuls: false, aUneReservation: false }
  const NOW_C = new Date('2026-11-20T10:00:00Z')
  it('visible après 7 jours de compte, ou dès la première réservation', () => {
    expect(carteParrainageVisible(base, NOW_C)).toBe(true)
    expect(carteParrainageVisible({ ...base, createdAt: '2026-11-18T00:00:00Z' }, NOW_C)).toBe(false)
    expect(carteParrainageVisible({ ...base, createdAt: '2026-11-18T00:00:00Z', aUneReservation: true }, NOW_C)).toBe(true)
  })
  it('cachée pour un parrain qui a déjà un filleul, ou avant sa date de retour', () => {
    expect(carteParrainageVisible({ ...base, aDesFilleuls: true }, NOW_C)).toBe(false)
    expect(carteParrainageVisible({ ...base, revoirLe: '2026-12-01T00:00:00Z' }, NOW_C)).toBe(false)
    expect(carteParrainageVisible({ ...base, revoirLe: '2026-11-19T00:00:00Z' }, NOW_C)).toBe(true)
  })
  it('revient entre 14 et 28 jours plus tard', () => {
    expect(dateRetourCarte(NOW_C, () => 0)).toBe('2026-12-04T10:00:00.000Z')
    expect(dateRetourCarte(NOW_C, max => max - 1)).toBe('2026-12-18T10:00:00.000Z')
    for (let i = 0; i < 50; i++) {
      const j = (new Date(dateRetourCarte(NOW_C)).getTime() - NOW_C.getTime()) / 86_400_000
      expect(j).toBeGreaterThanOrEqual(14)
      expect(j).toBeLessThanOrEqual(28)
    }
  })
})
