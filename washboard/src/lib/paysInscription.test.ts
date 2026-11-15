import { describe, it, expect } from 'vitest'
import { paysOuverts } from './paysInscription'

describe('pays ouverts à l’inscription', () => {
  it('par défaut : France, Belgique, Suisse', () => {
    expect(paysOuverts(undefined)).toEqual(['FR', 'BE', 'CH'])
    expect(paysOuverts('')).toEqual(['FR', 'BE', 'CH'])
  })

  it('une variable allume le Luxembourg et le Québec', () => {
    expect(paysOuverts('FR,BE,CH,LU')).toEqual(['FR', 'BE', 'CH', 'LU'])
    expect(paysOuverts(' fr , lu , qc ')).toEqual(['FR', 'LU'])
  })

  it('la France y est toujours, les valeurs inconnues sont ignorées', () => {
    expect(paysOuverts('LU')).toEqual(['FR', 'LU'])
    expect(paysOuverts('XX,YY')).toEqual(['FR', 'BE', 'CH'])
    expect(paysOuverts('LU,LU')).toEqual(['FR', 'LU'])
  })
})
