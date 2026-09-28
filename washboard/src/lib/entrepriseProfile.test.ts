import { describe, it, expect } from 'vitest'
import { buildEntrepriseProfile, type ContactEntreprise, type Entreprise } from './entrepriseProfile'
import type { ClientBooking, ClientDocument } from './clientProfile'

const ENTREPRISE: Entreprise = { id: 'e1', nom: 'Garage Renault', delaiPaiementJours: 30 }

let n = 0
const rdv = (o: Partial<ClientBooking>): ClientBooking => {
  n++
  return {
    id: `b${n}`, client_name: 'Karim Benali', client_email: 'karim@garage.fr', client_phone: '0600000000',
    address: '12 av. de la Somme', scheduled_at: '2026-09-22T09:00:00Z', status: 'done', closed_late: false,
    booked_price: 160, is_professional: true, company_name: 'Garage Renault',
    services: { name: '4 véhicules VO', price: 160, duration_minutes: 240 },
    ...o,
  }
}

let m = 0
const doc = (o: Partial<ClientDocument['contenu']['client']> & { genre?: 'devis' | 'facture'; statut?: string; emis_le?: string | null }): ClientDocument => {
  m++
  return {
    id: `d${m}`, genre: o.genre ?? 'devis', numero: `D-0000${m}`, statut: o.statut ?? 'envoye',
    emis_le: o.emis_le ?? '2026-09-20T09:00:00Z', created_at: '2026-09-20T09:00:00Z',
    contenu: {
      client: {
        nom: o.nom ?? 'Karim Benali', email: o.email ?? 'karim@garage.fr', telephone: o.telephone ?? null,
        professionnel: true, entreprise: 'Garage Renault', adresseFacturation: '12 av. de la Somme',
      },
      totaux: { ttc: 5760 },
    },
  }
}

describe('buildEntrepriseProfile', () => {
  it('somme le chiffre d’affaires et les véhicules de tous les contacts', () => {
    const contacts: ContactEntreprise[] = [
      { cle: 'karim@garage.fr', entrepriseId: 'e1', role: 'Chef d’atelier' },
      { cle: 'sophie@garage.fr', entrepriseId: 'e1', role: 'Comptabilité' },
    ]
    const bookings = [
      rdv({ client_email: 'karim@garage.fr', booked_price: 160 }),
      rdv({ client_email: 'sophie@garage.fr', booked_price: 75 }),
    ]
    const p = buildEntrepriseProfile(ENTREPRISE, [], contacts, bookings, [])
    expect(p.totalRevenue).toBe(235)
    expect(p.vehicules).toBe(2)
  })

  it('un contact sans aucune réservation ni document a un profil null, sans planter', () => {
    const contacts: ContactEntreprise[] = [{ cle: 'personne@garage.fr', entrepriseId: 'e1', role: null }]
    const p = buildEntrepriseProfile(ENTREPRISE, [], contacts, [], [])
    expect(p.contacts[0].profile).toBeNull()
    expect(p.totalRevenue).toBe(0)
    expect(p.vehicules).toBe(0)
  })

  it('derniers passages : tous les contacts mélangés, du plus récent au plus ancien', () => {
    const contacts: ContactEntreprise[] = [
      { cle: 'karim@garage.fr', entrepriseId: 'e1', role: null },
      { cle: 'sophie@garage.fr', entrepriseId: 'e1', role: null },
    ]
    const bookings = [
      rdv({ id: 'ancien', client_email: 'karim@garage.fr', scheduled_at: '2026-05-01T09:00:00Z' }),
      rdv({ id: 'recent', client_email: 'sophie@garage.fr', scheduled_at: '2026-09-22T09:00:00Z' }),
    ]
    const p = buildEntrepriseProfile(ENTREPRISE, [], contacts, bookings, [])
    expect(p.derniersPassages.map(b => b.id)).toEqual(['recent', 'ancien'])
  })

  it('devis en attente : seulement ceux envoyés à un contact de CETTE entreprise, sans réponse', () => {
    const contacts: ContactEntreprise[] = [{ cle: 'karim@garage.fr', entrepriseId: 'e1', role: null }]
    const documents = [
      doc({ email: 'karim@garage.fr', statut: 'envoye', emis_le: '2026-09-20T09:00:00Z' }),
      doc({ email: 'karim@garage.fr', statut: 'accepte' }), // déjà répondu : pas « en attente »
      doc({ email: 'quelqu-un-dautre@x.fr', statut: 'envoye' }), // un autre client, pas un contact d'ici
    ]
    const p = buildEntrepriseProfile(ENTREPRISE, [], contacts, [], documents, new Date('2026-09-22T09:00:00Z'))
    expect(p.devisEnAttente).toHaveLength(1)
    expect(p.devisEnAttente[0].jours).toBe(2)
  })

  it('un devis facturé (statut transforme) n’est plus « en attente »', () => {
    const contacts: ContactEntreprise[] = [{ cle: 'karim@garage.fr', entrepriseId: 'e1', role: null }]
    const documents = [doc({ email: 'karim@garage.fr', statut: 'transforme' })]
    const p = buildEntrepriseProfile(ENTREPRISE, [], contacts, [], documents)
    expect(p.devisEnAttente).toHaveLength(0)
  })

  it('les sites passent tels quels : ce module ne les calcule pas, il les porte', () => {
    const sites = [{ id: 's1', entrepriseId: 'e1', adresse: '12 av. de la Somme', note: 'Parking arrière' }]
    const p = buildEntrepriseProfile(ENTREPRISE, sites, [], [], [])
    expect(p.sites).toBe(sites)
  })
})
