import { describe, it, expect } from 'vitest'
import { repartirParClient, decisionPlusRecents } from './relances'

describe('repartirParClient', () => {
  it('un seul porteur par client, le plus récent ; les plus anciens sont clos', () => {
    const { porteurs, aClore } = repartirParClient([
      { id: 'j3', client_email: 'julie@exemple.fr' },
      { id: 'm1', client_email: 'marc@exemple.fr' },
      { id: 'j2', client_email: 'julie@exemple.fr' },
      { id: 'j1', client_email: 'julie@exemple.fr' },
    ])
    expect(porteurs.map(p => p.id)).toEqual(['j3', 'm1'])
    expect(aClore).toEqual(['j2', 'j1'])
  })

  it('lot vide : rien à faire', () => {
    expect(repartirParClient([])).toEqual({ porteurs: [], aClore: [] })
  })
})

describe('decisionPlusRecents', () => {
  const maintenant = new Date('2026-09-15T12:00:00Z')

  it('aucun rendez-vous plus récent : on relance', () => {
    expect(decisionPlusRecents([], maintenant)).toBe('relancer')
  })

  it('le client est revenu (rendez-vous passé, terminé ou confirmé) : on clôt', () => {
    expect(decisionPlusRecents([{ status: 'done', scheduled_at: '2026-08-01T10:00:00Z' }], maintenant)).toBe('clore')
    expect(decisionPlusRecents([{ status: 'confirmed', scheduled_at: '2026-09-15T09:00:00Z' }], maintenant)).toBe('clore')
  })

  it('seulement un rendez-vous à venir : on attend, il peut encore être annulé', () => {
    expect(decisionPlusRecents([{ status: 'confirmed', scheduled_at: '2026-10-01T10:00:00Z' }], maintenant)).toBe('attendre')
  })

  it('un rendez-vous passé resté en attente ne prouve pas la visite : on attend', () => {
    // Il ne porterait jamais la relance lui-même (seuls confirmés et terminés
    // sont candidats) : clore l'ancien priverait le client de toute relance.
    expect(decisionPlusRecents([{ status: 'pending', scheduled_at: '2026-08-01T10:00:00Z' }], maintenant)).toBe('attendre')
  })
})
