import { describe, it, expect } from 'vitest'
import { paysOuverts } from './paysInscription'

describe('pays ouverts à l’inscription', () => {
  it('par défaut : France, Belgique, Suisse, Luxembourg, Allemagne, Espagne', () => {
    expect(paysOuverts(undefined)).toEqual(['FR', 'BE', 'CH', 'LU', 'DE', 'ES'])
    expect(paysOuverts('')).toEqual(['FR', 'BE', 'CH', 'LU', 'DE', 'ES'])
  })

  it('une variable choisit les pays ; le Québec reste ignoré', () => {
    expect(paysOuverts('FR,BE,CH,LU')).toEqual(['FR', 'BE', 'CH', 'LU'])
    expect(paysOuverts(' fr , lu , qc ')).toEqual(['FR', 'LU'])
  })

  it('la France y est toujours, les valeurs inconnues sont ignorées', () => {
    expect(paysOuverts('LU')).toEqual(['FR', 'LU'])
    expect(paysOuverts('XX,YY')).toEqual(['FR', 'BE', 'CH', 'LU', 'DE', 'ES'])
    expect(paysOuverts('LU,LU')).toEqual(['FR', 'LU'])
  })
})
