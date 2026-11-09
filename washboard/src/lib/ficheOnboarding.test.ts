import { describe, it, expect } from 'vitest'
import { dureeCourte, resumerOnboarding } from './ficheOnboarding'

const CREE = '2026-10-20T10:00:00.000Z'
const base = { created_at: CREE, onboarding_complete_at: '2026-10-20T10:06:00.000Z', acquisition_source: null, profil_activite: null }

describe('dureeCourte', () => {
  it('minutes, heures puis jours', () => {
    expect(dureeCourte(20_000)).toBe('moins d’une minute')
    expect(dureeCourte(6 * 60_000)).toBe('6 min')
    expect(dureeCourte(3 * 3_600_000)).toBe('3 h')
    expect(dureeCourte(4 * 864e5)).toBe('4 j')
  })
})

describe('resumerOnboarding', () => {
  it('compte antérieur à l’onboarding : marqué terminé à sa création, aucune réponse', () => {
    const o = resumerOnboarding({ ...base, onboarding_complete_at: CREE })
    expect(o.etat).toBe('avant')
    expect(o.resume).toBe('Inscrit avant la mise en place de l’onboarding')
    expect(o.note).toContain('jamais vu')
    expect(o.reponses.every(r => r.reponse === null)).toBe(true)
  })

  it('onboarding jamais terminé', () => {
    expect(resumerOnboarding({ ...base, onboarding_complete_at: null })).toMatchObject({ etat: 'en_cours', resume: 'Onboarding pas terminé' })
  })

  it('terminé avec toutes ses réponses, en clair', () => {
    const o = resumerOnboarding({
      ...base,
      acquisition_source: 'instagram',
      profil_activite: { anciennete: '1_3_ans', equipe: '1', prestations_semaine: '5_15', ca_mois: '1000_3000', clientele: 'les_deux', prise_rdv: ['telephone', 'reseaux'], temps_perdu: ['factures'] },
    })
    expect(o.etat).toBe('termine')
    expect(o.resume).toContain('6 min après l’inscription')
    const r = (q: string) => o.reponses.find(x => x.question.startsWith(q))?.reponse
    expect(r('Comment')).toBe('Instagram')
    expect(r('Depuis')).toBe('1 à 3 ans')
    expect(r('Combien de laveurs')).toBe('Seul')
    expect(r('Aujourd’hui')).toBe('Téléphone, Réseaux sociaux')
    expect(r('Ce qui')).toBe('Faire les factures')
    expect(r('Ton statut')).toBeNull()
  })

  it('« Autre » garde la précision tapée', () => {
    const o = resumerOnboarding({ ...base, acquisition_source: 'autre', profil_activite: { source_precision: 'Un ami garagiste' } })
    expect(o.reponses[0].reponse).toBe('Autre : Un ami garagiste')
  })

  it('source connue mais questions sur l’activité absentes : le dit', () => {
    const o = resumerOnboarding({ ...base, acquisition_source: 'tiktok' })
    expect(o.etat).toBe('termine')
    expect(o.note).toContain('n’existaient pas encore')
  })

  it('terminé plus tard sans aucune réponse : pas pris pour un compte ancien', () => {
    const o = resumerOnboarding(base)
    expect(o.etat).toBe('termine')
    expect(o.note).toContain('Aucune réponse')
  })

  it('une réponse hors liste s’affiche telle quelle plutôt que de disparaître', () => {
    expect(resumerOnboarding({ ...base, profil_activite: { equipe: '12' } }).reponses.find(r => r.question.startsWith('Combien de laveurs'))?.reponse).toBe('12')
  })
})
