import { describe, it, expect } from 'vitest'
import { validerAppel, relanceDue, aujourdhuiParis, tableAbsente, type Appel } from './suiviAppels'

const NOW = new Date('2026-11-05T23:30:00Z') // déjà le 6 novembre à Paris (UTC+1)

const appel = (p: Partial<Appel>): Appel => ({
  id: 'a', washer_id: 'w', appele_le: '2026-11-01T10:00:00Z', resultat: 'Rappeler', notes: null, prochaine_action: null, relancer_le: null, ...p,
})

describe('validerAppel', () => {
  it('exige un résultat connu', () => {
    expect(validerAppel({ resultat: 'Bof' })).toEqual({ erreur: 'Choisissez le résultat de l’appel.' })
    expect(validerAppel(null)).toHaveProperty('erreur')
  })
  it('nettoie les textes et accepte une relance vide', () => {
    expect(validerAppel({ resultat: 'Intéressé', notes: '  ok  ', prochaine_action: '', relancer_le: '' })).toEqual({
      appel: { resultat: 'Intéressé', notes: 'ok', prochaine_action: null, relancer_le: null },
    })
  })
  it('refuse une date mal formée', () => {
    expect(validerAppel({ resultat: 'Rappeler', relancer_le: '06/11/2026' })).toHaveProperty('erreur')
  })
})

describe('relanceDue', () => {
  it('suit la date de Paris', () => {
    expect(aujourdhuiParis(NOW)).toBe('2026-11-06')
  })
  it('ne regarde que le dernier appel', () => {
    const ancien = appel({ id: '1', appele_le: '2026-11-01T10:00:00Z', relancer_le: '2026-11-02' })
    const recent = appel({ id: '2', appele_le: '2026-11-04T10:00:00Z', relancer_le: '2026-11-20' })
    expect(relanceDue([ancien, recent], NOW)).toBeNull()
    expect(relanceDue([ancien], NOW)?.id).toBe('1')
  })
  it('due le jour même', () => {
    expect(relanceDue([appel({ relancer_le: '2026-11-06' })], NOW)).not.toBeNull()
  })
})

describe('tableAbsente', () => {
  it('reconnaît une table pas encore créée', () => {
    expect(tableAbsente({ code: 'PGRST205' })).toBe(true)
    expect(tableAbsente({ code: '42501' })).toBe(false)
  })
})
