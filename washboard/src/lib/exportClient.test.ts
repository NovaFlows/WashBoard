import { describe, it, expect } from 'vitest'
import { texteExportClient, nomFichierExportClient } from './exportClient'
import type { ClientProfile } from './clientProfile'

const profil: ClientProfile = {
  cle: 'claire@example.com', email: 'claire@example.com', name: 'Claire Martin', phone: '0612345678',
  isProfessional: false, companyName: null, addresses: ['3 rue des Lilas, Lyon'],
  bookings: [{
    id: 'b1', client_name: 'Claire Martin', client_email: 'claire@example.com', client_phone: '0612345678',
    address: '3 rue des Lilas, Lyon', scheduled_at: '2026-08-01T09:00:00Z', status: 'done', closed_late: false,
    booked_price: 60, is_professional: false, company_name: null,
    services: { name: 'Lavage complet', price: 60, duration_minutes: 90 },
  }],
  documents: [{
    id: 'd1', genre: 'facture', numero: 'F-00001', statut: 'emis', emis_le: '2026-07-01T09:00:00Z', created_at: '2026-07-01T09:00:00Z',
    contenu: { client: { nom: 'Claire Martin', email: 'claire@example.com', professionnel: false, entreprise: null, adresseFacturation: '' }, totaux: { ttc: 120 } },
    paye_le: '2026-07-05T09:00:00Z',
  }],
  totalRevenue: 180, honoredCount: 2, cancelledCount: 0, averageBasket: 90,
  firstVisit: '2026-07-01T09:00:00Z', lastVisit: '2026-08-01T09:00:00Z', daysSinceLastVisit: 10,
  nePlusContacter: false, rythmeJours: null, notes: 'Portail à code 1234', vehicules: 'Peugeot 208 grise',
  vehiculesReserves: ['Renault Clio'],
}

describe('texteExportClient', () => {
  it('couvre identité, réservations, documents et notes', () => {
    const t = texteExportClient(profil, 'AutoNettoyage')
    expect(t).toContain('Claire Martin')
    expect(t).toContain('claire@example.com')
    expect(t).toContain('Lavage complet')
    expect(t).toContain('F-00001')
    expect(t).toContain('120 €')
    expect(t).toContain('encaissée')
    expect(t).toContain('Portail à code 1234')
    expect(t).toContain('Renault Clio')
    expect(t).toContain('article 15 du RGPD')
  })

  it('dit « Aucune »/« Aucun » sans réservation ni document, plutôt qu’une section vide', () => {
    const t = texteExportClient({ ...profil, bookings: [], documents: [] }, 'AutoNettoyage')
    expect(t).toContain('Aucune.')
    expect(t).toContain('Aucun.')
  })
})

describe('nomFichierExportClient', () => {
  it('donne un nom de fichier propre, sans accent ni espace', () => {
    expect(nomFichierExportClient(profil)).toBe('donnees-claire-martin.txt')
  })

  it('reprend le nom de l’entreprise pour un pro', () => {
    expect(nomFichierExportClient({ ...profil, isProfessional: true, companyName: 'Garage Renault Mérignac' }))
      .toBe('donnees-garage-renault-merignac.txt')
  })
})
