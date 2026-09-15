import { describe, it, expect } from 'vitest'
import { journeeParis, rendezVousNonTermines, messageRappel } from './rappelTerminer'

describe('journeeParis', () => {
  it('en été (UTC+2) : la journée va de 22 h UTC la veille à 22 h UTC', () => {
    expect(journeeParis(new Date('2026-09-15T20:00:00Z'))).toEqual({
      jour: '2026-09-15', debut: '2026-09-14T22:00:00.000Z', fin: '2026-09-15T22:00:00.000Z',
    })
  })

  it('en hiver (UTC+1) : de 23 h UTC la veille à 23 h UTC', () => {
    expect(journeeParis(new Date('2026-12-10T21:00:00Z'))).toEqual({
      jour: '2026-12-10', debut: '2026-12-09T23:00:00.000Z', fin: '2026-12-10T23:00:00.000Z',
    })
  })

  it('juste après minuit à Paris, c’est déjà le lendemain', () => {
    expect(journeeParis(new Date('2026-09-15T22:30:00Z')).jour).toBe('2026-09-16')
  })

  it('le jour du passage à l’heure d’hiver dure 25 heures', () => {
    const { debut, fin } = journeeParis(new Date('2026-10-25T12:00:00Z'))
    expect((Date.parse(fin) - Date.parse(debut)) / 3_600_000).toBe(25)
  })
})

describe('rendezVousNonTermines', () => {
  it('compte les rendez-vous confirmés ET en attente, par laveur', () => {
    const r = rendezVousNonTermines([
      { washer_id: 'a', status: 'confirmed' },
      { washer_id: 'a', status: 'pending' },
      { washer_id: 'a', status: 'done' },
      { washer_id: 'b', status: 'cancelled' },
      { washer_id: 'c', status: 'pending' },
    ])
    expect([...r]).toEqual([['a', 2], ['c', 1]])
  })

  it('tout est terminé ou annulé : personne à rappeler', () => {
    expect(rendezVousNonTermines([{ washer_id: 'a', status: 'done' }]).size).toBe(0)
  })
})

describe('messageRappel', () => {
  it('singulier et pluriel, un seul rappel par jour', () => {
    expect(messageRappel(1, '2026-09-15').body).toMatch(/^Un rendez-vous n’est pas encore/)
    expect(messageRappel(3, '2026-09-15')).toMatchObject({
      body: expect.stringMatching(/^3 rendez-vous ne sont pas encore/),
      url: '/dashboard/calendrier',
      tag: 'rappel-terminer-2026-09-15',
    })
  })
})
