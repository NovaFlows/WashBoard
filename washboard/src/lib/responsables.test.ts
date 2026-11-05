import { describe, it, expect } from 'vitest'
import { validerResponsable } from './responsables'

describe('validerResponsable', () => {
  it('accepte un membre de l’équipe, ou personne', () => {
    expect(validerResponsable({ responsable: 'Yanis' })).toEqual({ responsable: 'Yanis' })
    expect(validerResponsable({ responsable: null })).toEqual({ responsable: null })
    expect(validerResponsable({ responsable: '' })).toEqual({ responsable: null })
  })
  it('refuse un inconnu', () => {
    expect(validerResponsable({ responsable: 'Bob' })).toHaveProperty('erreur')
    expect(validerResponsable(null)).toHaveProperty('erreur')
  })
})
