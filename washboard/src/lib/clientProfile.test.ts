import { describe, it, expect } from 'vitest'
import { buildClientProfile, type ClientBooking, type ClientDocument } from './clientProfile'

const base: ClientBooking = {
  id: '1',
  client_name: 'Alex',
  client_email: 'alex@example.com',
  client_phone: '0600000000',
  address: '8 Rue des Lilas',
  scheduled_at: '2026-06-01T09:00:00Z',
  created_at: '2026-05-30T09:00:00Z',
  status: 'done',
  closed_late: false,
  booked_price: 60,
  is_professional: false,
  company_name: null,
  services: { name: 'Lavage complet', price: 55, duration_minutes: 90 },
} as ClientBooking & { created_at: string }

const mk = (o: Partial<ClientBooking>): ClientBooking => ({ ...base, ...o })

describe('buildClientProfile', () => {
  it('renvoie null si le client n’a aucune réservation', () => {
    expect(buildClientProfile([base], 'inconnu@example.com')).toBeNull()
  })

  it('regroupe sur l’email sans tenir compte de la casse ni des espaces', () => {
    const p = buildClientProfile(
      [mk({ id: 'a', client_email: 'Alex@Example.com ' }), mk({ id: 'b' })],
      'alex@example.com',
    )!
    expect(p.bookings).toHaveLength(2)
  })

  it('ne mélange pas deux clients distincts', () => {
    const p = buildClientProfile(
      [mk({ id: 'a' }), mk({ id: 'b', client_email: 'autre@example.com', booked_price: 999 })],
      'alex@example.com',
    )!
    expect(p.bookings).toHaveLength(1)
    expect(p.totalRevenue).toBe(60)
  })

  it('trie l’historique du plus récent au plus ancien', () => {
    const p = buildClientProfile([
      mk({ id: 'vieux', scheduled_at: '2026-01-01T09:00:00Z' }),
      mk({ id: 'recent', scheduled_at: '2026-08-01T09:00:00Z' }),
    ], 'alex@example.com')!
    expect(p.bookings.map(b => b.id)).toEqual(['recent', 'vieux'])
  })

  it('retient le nom de la réservation la plus récente', () => {
    const p = buildClientProfile([
      mk({ id: 'a', client_name: 'Alex', scheduled_at: '2026-01-01T09:00:00Z' }),
      mk({ id: 'b', client_name: 'Alexandre B.', scheduled_at: '2026-08-01T09:00:00Z' }),
    ], 'alex@example.com')!
    expect(p.name).toBe('Alexandre B.')
  })

  it('exclut les rendez-vous annulés du chiffre d’affaires', () => {
    const p = buildClientProfile([
      mk({ id: 'a', status: 'done', booked_price: 60 }),
      mk({ id: 'b', status: 'cancelled', booked_price: 100 }),
      mk({ id: 'c', status: 'confirmed', booked_price: 40 }),
    ], 'alex@example.com')!
    expect(p.totalRevenue).toBe(100)
    expect(p.honoredCount).toBe(2)
    expect(p.cancelledCount).toBe(1)
    expect(p.averageBasket).toBe(50)
  })

  it('retombe sur le prix du service quand le prix facturé manque', () => {
    const p = buildClientProfile([mk({ booked_price: null })], 'alex@example.com')!
    expect(p.totalRevenue).toBe(55)
  })

  it('ne compte pas une annulation comme une visite', () => {
    const p = buildClientProfile([
      mk({ id: 'a', status: 'done', scheduled_at: '2026-06-01T09:00:00Z' }),
      mk({ id: 'b', status: 'cancelled', scheduled_at: '2026-08-20T09:00:00Z' }),
    ], 'alex@example.com', new Date('2026-08-26T00:00:00Z'))!
    expect(p.lastVisit).toBe('2026-06-01T09:00:00Z')
    expect(p.daysSinceLastVisit).toBe(85)
  })

  it('laisse daysSinceLastVisit à null si aucun RDV honoré', () => {
    const p = buildClientProfile([mk({ status: 'cancelled' })], 'alex@example.com')!
    expect(p.lastVisit).toBeNull()
    expect(p.daysSinceLastVisit).toBeNull()
    expect(p.averageBasket).toBe(0)
  })

  it('dédoublonne les adresses, la plus récente en premier', () => {
    const p = buildClientProfile([
      mk({ id: 'a', address: 'Ancienne', scheduled_at: '2026-01-01T09:00:00Z' }),
      mk({ id: 'b', address: 'Nouvelle', scheduled_at: '2026-08-01T09:00:00Z' }),
      mk({ id: 'c', address: 'Nouvelle', scheduled_at: '2026-07-01T09:00:00Z' }),
    ], 'alex@example.com')!
    expect(p.addresses).toEqual(['Nouvelle', 'Ancienne'])
  })

  it('rythmeJours : l’écart moyen entre visites, pas leur nombre', () => {
    // Trois visites honorées, régulièrement espacées de 30 jours : 1er mai, 31 mai, 30 juin.
    const p = buildClientProfile([
      mk({ id: 'a', scheduled_at: '2026-05-01T09:00:00Z' }),
      mk({ id: 'b', scheduled_at: '2026-05-31T09:00:00Z' }),
      mk({ id: 'c', scheduled_at: '2026-06-30T09:00:00Z' }),
    ], 'alex@example.com')!
    expect(p.rythmeJours).toBe(30)
  })

  it('rythmeJours reste null avec moins de deux visites honorées', () => {
    expect(buildClientProfile([mk({})], 'alex@example.com')!.rythmeJours).toBeNull()
    expect(buildClientProfile([mk({ status: 'cancelled' })], 'alex@example.com')!.rythmeJours).toBeNull()
  })

  it('nePlusContacter vaut faux par défaut, et suit le réglage écrit pour cette clé', () => {
    const sansReglage = buildClientProfile([mk({})], 'alex@example.com')!
    expect(sansReglage.nePlusContacter).toBe(false)
    expect(sansReglage.cle).toBe('alex@example.com')

    const avecReglage = buildClientProfile(
      [mk({})], 'alex@example.com', new Date(), [],
      [{ cle: 'alex@example.com', nePlusContacter: true, masque: false, notes: null, vehicules: null }],
    )!
    expect(avecReglage.nePlusContacter).toBe(true)

    // Un réglage sur UN AUTRE client ne déteint pas.
    const autreClient = buildClientProfile(
      [mk({})], 'alex@example.com', new Date(), [],
      [{ cle: 'quelqu-un-d-autre@example.com', nePlusContacter: true, masque: false, notes: null, vehicules: null }],
    )!
    expect(autreClient.nePlusContacter).toBe(false)
  })

  it('notes et véhicules valent null par défaut, et suivent le réglage écrit pour cette clé', () => {
    const sansReglage = buildClientProfile([mk({})], 'alex@example.com')!
    expect(sansReglage.notes).toBeNull()
    expect(sansReglage.vehicules).toBeNull()

    const avecReglage = buildClientProfile(
      [mk({})], 'alex@example.com', new Date(), [],
      [{ cle: 'alex@example.com', nePlusContacter: false, masque: false, notes: 'Portail à code 1234', vehicules: 'Peugeot 208 grise' }],
    )!
    expect(avecReglage.notes).toBe('Portail à code 1234')
    expect(avecReglage.vehicules).toBe('Peugeot 208 grise')
  })

  it('vehiculesReserves reprend les modèles tapés par le client en réservant, du plus récent, sans doublon', () => {
    const p = buildClientProfile([
      mk({ id: 'recent', scheduled_at: '2026-08-01T09:00:00Z', vehicles_detail: [{ models: ['Peugeot 208'] }] }),
      mk({ id: 'vieux', scheduled_at: '2026-01-01T09:00:00Z', vehicles_detail: [{ models: ['Renault Clio', 'Peugeot 208'] }] }),
    ], 'alex@example.com')!
    expect(p.vehiculesReserves).toEqual(['Peugeot 208', 'Renault Clio'])
  })

  it('vehiculesReserves est vide sans réservation ou sans modèle renseigné', () => {
    expect(buildClientProfile([mk({ vehicles_detail: null })], 'alex@example.com')!.vehiculesReserves).toEqual([])
    expect(buildClientProfile([mk({ vehicles_detail: [{ models: ['  '] }] })], 'alex@example.com')!.vehiculesReserves).toEqual([])
  })

  it('vehiculesReserves reprend aussi le véhicule tapé sur un devis ou une facture écrits à la main, mêlé aux réservations par date', () => {
    const document: ClientDocument = {
      id: 'd1', genre: 'devis', numero: 'D-00001', statut: 'emis',
      emis_le: '2026-07-01T09:00:00Z', created_at: '2026-07-01T09:00:00Z',
      contenu: {
        client: { nom: 'Alex', email: 'alex@example.com', professionnel: false, entreprise: null, adresseFacturation: '', vehicule: 'Renault Kangoo' },
        totaux: { ttc: 90 },
      },
    }
    const p = buildClientProfile(
      [mk({ scheduled_at: '2026-08-01T09:00:00Z', vehicles_detail: [{ models: ['Peugeot 208'] }] })],
      'alex@example.com', new Date(), [document],
    )!
    // Le devis (1er juillet) est plus ancien que la réservation (1er août) : la voiture la plus
    // récente reste en tête, peu importe la source.
    expect(p.vehiculesReserves).toEqual(['Peugeot 208', 'Renault Kangoo'])
  })

  it('récupère un téléphone même absent de la réservation la plus récente', () => {
    const p = buildClientProfile([
      mk({ id: 'recent', client_phone: '', scheduled_at: '2026-08-01T09:00:00Z' }),
      mk({ id: 'vieux', client_phone: '0611223344', scheduled_at: '2026-01-01T09:00:00Z' }),
    ], 'alex@example.com')!
    expect(p.phone).toBe('0611223344')
  })
})
