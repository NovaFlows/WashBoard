import { describe, it, expect } from 'vitest'
import { validerAppel, relanceDue, relancePrevue, aujourdhuiParis, tableAbsente, estAppel, MISE_A_RAPPELER, RESULTATS_APPEL, type Appel } from './suiviAppels'

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

describe('mise « À rappeler » depuis la fiche', () => {
  it('est acceptée sans être un résultat d’appel, à aujourd’hui par défaut', () => {
    const r = validerAppel({ resultat: MISE_A_RAPPELER, prochaine_action: 'Vérifier ses prix' })
    expect(r).toEqual({ appel: { resultat: MISE_A_RAPPELER, notes: null, prochaine_action: 'Vérifier ses prix', relancer_le: aujourdhuiParis() } })
    expect(RESULTATS_APPEL).not.toContain(MISE_A_RAPPELER)
  })
  it('n’est pas un appel', () => {
    expect(estAppel(appel({ resultat: MISE_A_RAPPELER }))).toBe(false)
    expect(estAppel(appel({ resultat: 'Pas répondu' }))).toBe(true)
  })
  it('met le laveur dans « À rappeler » à la date choisie, puis un appel la remplace', () => {
    const mise = appel({ id: 'm', resultat: MISE_A_RAPPELER, appele_le: '2026-11-05T09:00:00Z', relancer_le: '2026-11-06' })
    expect(relanceDue([mise], NOW)?.id).toBe('m')
    expect(relanceDue([mise], new Date('2026-11-05T09:00:00Z'))).toBeNull()
    expect(relancePrevue([mise])?.id).toBe('m')
    const appelEnsuite = appel({ id: 'x', resultat: 'Intéressé', appele_le: '2026-11-05T20:00:00Z' })
    expect(relancePrevue([mise, appelEnsuite])).toBeNull()
  })
})

describe('tableAbsente', () => {
  it('reconnaît une table pas encore créée', () => {
    expect(tableAbsente({ code: 'PGRST205' })).toBe(true)
    expect(tableAbsente({ code: '42501' })).toBe(false)
  })
})
