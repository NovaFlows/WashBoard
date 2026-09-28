import { describe, it, expect } from 'vitest'
import { trouverDoublon } from './doublons'
import type { ResumeClient } from './listeClients'

const client = (p: Partial<ResumeClient> & { cle: string }): ResumeClient => ({
  email: '', name: 'Quelqu’un', phone: '', isProfessional: false, companyName: null,
  addresses: [], derniere: null, prochain: null, honoredCount: 0, totalRevenue: 0,
  activite: '2026-09-01T00:00:00Z', documentsCount: 0, nePlusContacter: false,
  ...p,
})

describe('trouverDoublon', () => {
  it('repère un même téléphone, écrit différemment', () => {
    const autre = client({ cle: 'claire.m@outlook.fr', email: 'claire.m@outlook.fr', name: 'Claire M.', phone: '+33 6 12 34 56 78' })
    const d = trouverDoublon({ cle: 'claire@example.com', name: 'Claire Martin', phone: '06 12 34 56 78' }, [autre])
    expect(d).toEqual({ cle: 'claire.m@outlook.fr', identifiant: 'claire.m@outlook.fr', motif: 'Même téléphone que « claire.m@outlook.fr »' })
  })

  it('à défaut, repère un même nom, sans accent ni casse', () => {
    const autre = client({ cle: 'claire.m@outlook.fr', email: 'claire.m@outlook.fr', name: 'CLAIRE MARTIN', phone: '' })
    const d = trouverDoublon({ cle: 'claire@example.com', name: 'claire martin', phone: '' }, [autre])
    expect(d?.motif).toBe('claire.m@outlook.fr ressemble à cette fiche')
  })

  it('ignore la fiche elle-même', () => {
    const soi = client({ cle: 'claire@example.com', name: 'Claire Martin', phone: '0612345678' })
    const d = trouverDoublon({ cle: 'claire@example.com', name: 'Claire Martin', phone: '0612345678' }, [soi])
    expect(d).toBeNull()
  })

  it('rien ne ressemble : null', () => {
    const autre = client({ cle: 'marc@garage.fr', name: 'Marc Petit', phone: '0700000000' })
    const d = trouverDoublon({ cle: 'claire@example.com', name: 'Claire Martin', phone: '0612345678' }, [autre])
    expect(d).toBeNull()
  })

  it('un téléphone trop court (moins de 6 chiffres) ne sert pas de signal', () => {
    const autre = client({ cle: 'x@example.com', name: 'Autre Personne', phone: '01234' })
    const d = trouverDoublon({ cle: 'claire@example.com', name: 'Claire Martin', phone: '01234' }, [autre])
    expect(d).toBeNull()
  })
})
