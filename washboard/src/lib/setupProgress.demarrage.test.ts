import { describe, it, expect } from 'vitest'
import { computeSetupProgress, etapeDemarrage, type SetupInput } from './setupProgress'

const compteNeuf: SetupInput = {
  servicesCount: 0,
  availabilitiesCount: 0,
  baseAddress: null,
  phone: null,
  logoUrl: null,
  googleCalendarConnected: false,
  reviewsEnabled: false,
  followupEnabled: false,
  zoneEnabled: false,
  smartSlotEnabled: false,
  welcomeMessage: null,
}

describe('etapeDemarrage', () => {
  it('un compte neuf commence par ses prestations', () => {
    const etape = etapeDemarrage(computeSetupProgress(compteNeuf))
    expect(etape?.key).toBe('services')
    expect(etape?.href).toBe('/dashboard/admin#prestations')
  })

  it('prestations faites : passe aux horaires, puis à l’adresse', () => {
    expect(etapeDemarrage(computeSetupProgress({ ...compteNeuf, servicesCount: 2 }))?.key).toBe('availabilities')
    expect(etapeDemarrage(computeSetupProgress({ ...compteNeuf, servicesCount: 2, availabilitiesCount: 5 }))?.key)
      .toBe('baseAddress')
  })

  it('tout l’indispensable fait : plus rien à réclamer, même sans logo ni avis', () => {
    expect(etapeDemarrage(computeSetupProgress({
      ...compteNeuf, servicesCount: 2, availabilitiesCount: 5, baseAddress: '1 rue de la Démo',
    }))).toBeNull()
  })
})
