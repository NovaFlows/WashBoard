import { describe, it, expect } from 'vitest'
import type { ClientBooking } from './clientProfile'
import { listeClients, rechercherClients } from './listeClients'

const MAINTENANT = new Date('2026-09-15T12:00:00Z')
let n = 0

function rdv(extra: Partial<ClientBooking>): ClientBooking {
  n++
  return {
    id: `b${n}`,
    client_name: 'Julie Martin',
    client_email: 'julie@exemple.fr',
    client_phone: '0612345678',
    address: '12 rue de Paris, Lyon',
    scheduled_at: '2026-09-01T10:00:00Z',
    status: 'done',
    closed_late: false,
    booked_price: 60,
    is_professional: false,
    company_name: null,
    services: { name: 'Lavage complet', price: 60, duration_minutes: 90 },
    ...extra,
  }
}

describe('listeClients', () => {
  it('un client par email, casse et espaces compris, avec son nom le plus récent', () => {
    const clients = listeClients([
      rdv({ client_name: 'Julie', scheduled_at: '2026-08-01T10:00:00Z' }),
      rdv({ client_email: ' JULIE@exemple.fr ', client_name: 'Julie Martin', scheduled_at: '2026-09-01T10:00:00Z' }),
    ], MAINTENANT)
    expect(clients).toHaveLength(1)
    expect(clients[0]).toMatchObject({ name: 'Julie Martin', honoredCount: 2, totalRevenue: 120 })
  })

  it('dernière prestation : terminée ou confirmée passée, jamais à venir ni annulée', () => {
    const [c] = listeClients([
      rdv({ scheduled_at: '2026-08-01T10:00:00Z', services: { name: 'Extérieur', price: 35, duration_minutes: 45 } }),
      rdv({ scheduled_at: '2026-09-10T10:00:00Z', status: 'cancelled', services: { name: 'Annulé', price: 1, duration_minutes: 1 } }),
      rdv({ scheduled_at: '2026-09-20T10:00:00Z', status: 'confirmed', services: { name: 'À venir', price: 1, duration_minutes: 1 } }),
    ], MAINTENANT)
    expect(c.derniere).toEqual({ service: 'Extérieur', date: '2026-08-01T10:00:00Z' })
  })

  it('un rendez-vous confirmé et déjà passé compte comme fait', () => {
    const [c] = listeClients([rdv({ scheduled_at: '2026-09-14T10:00:00Z', status: 'confirmed' })], MAINTENANT)
    expect(c.derniere?.date).toBe('2026-09-14T10:00:00Z')
  })

  it('prochain rendez-vous : le plus proche à venir, en attente compris', () => {
    const [c] = listeClients([
      rdv({ scheduled_at: '2026-10-01T10:00:00Z', status: 'confirmed' }),
      rdv({ scheduled_at: '2026-09-20T10:00:00Z', status: 'pending' }),
      rdv({ scheduled_at: '2026-09-18T10:00:00Z', status: 'cancelled' }),
    ], MAINTENANT)
    expect(c.prochain?.date).toBe('2026-09-20T10:00:00Z')
    expect(c.derniere).toBeNull()
  })

  it('le client le plus récemment actif en premier', () => {
    const clients = listeClients([
      rdv({ client_email: 'ancien@exemple.fr', scheduled_at: '2026-03-01T10:00:00Z' }),
      rdv({ client_email: 'recent@exemple.fr', scheduled_at: '2026-09-10T10:00:00Z' }),
      rdv({ client_email: 'futur@exemple.fr', scheduled_at: '2026-09-25T10:00:00Z', status: 'pending' }),
    ], MAINTENANT)
    expect(clients.map(c => c.email)).toEqual(['futur@exemple.fr', 'recent@exemple.fr', 'ancien@exemple.fr'])
  })

  it('ignore une réservation sans email', () => {
    expect(listeClients([rdv({ client_email: '  ' })], MAINTENANT)).toHaveLength(0)
  })
})

describe('rechercherClients', () => {
  const clients = listeClients([
    rdv({ client_name: 'Hélène Dupré', client_email: 'helene@exemple.fr', client_phone: '06 12 34 56 78', address: '3 place Bellecour, Lyon' }),
    rdv({ client_name: 'Marc Petit', client_email: 'marc@garage.fr', client_phone: '+33 7 00 11 22 33', is_professional: true, company_name: 'Garage du Centre', address: '8 avenue Foch, Paris' }),
  ], MAINTENANT)
  const noms = (texte: string) => rechercherClients(clients, texte).map(c => c.name)

  it('sans accents ni majuscules', () => {
    expect(noms('helene')).toEqual(['Hélène Dupré'])
    expect(noms('DUPRE')).toEqual(['Hélène Dupré'])
  })

  it('plusieurs mots doivent tous correspondre', () => {
    expect(noms('marc paris')).toEqual(['Marc Petit'])
    expect(noms('marc lyon')).toEqual([])
  })

  it('par entreprise, email ou adresse', () => {
    expect(noms('garage du centre')).toEqual(['Marc Petit'])
    expect(noms('helene@')).toEqual(['Hélène Dupré'])
    expect(noms('bellecour')).toEqual(['Hélène Dupré'])
  })

  it('par téléphone, quelle que soit son écriture', () => {
    expect(noms('06 12')).toEqual(['Hélène Dupré'])
    expect(noms('0612345678')).toEqual(['Hélène Dupré'])
    expect(noms('07 00 11')).toEqual(['Marc Petit'])
    expect(noms('+33 7 00')).toEqual(['Marc Petit'])
  })

  it('recherche vide : tous les clients', () => {
    expect(rechercherClients(clients, '   ')).toHaveLength(2)
  })
})
