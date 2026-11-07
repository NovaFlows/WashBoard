import { describe, it, expect } from 'vitest'
import { inscriptionsParSemaine, resumerLaveurs } from './resumeLaveurs'
import type { DonneesLaveur, WasherFiche } from './ficheLaveur'
import type { Appel } from './suiviAppels'

// Jeudi 5 novembre 2026, 23h30 à Paris (22h30 UTC) : semaine du lundi 2 novembre.
const NOW = new Date('2026-11-05T22:30:00Z')

describe('inscriptionsParSemaine', () => {
  it('range par semaine du lundi, à l’heure de Paris, la plus ancienne d’abord', () => {
    const s = inscriptionsParSemaine([
      { creeLe: '2026-11-04T14:14:18Z' }, // cette semaine
      { creeLe: '2026-11-01T23:30:00Z' }, // lundi 2 à 0h30 à Paris : cette semaine
      { creeLe: '2026-11-01T12:00:00Z' }, // dimanche 1er : semaine d'avant
      { creeLe: '2026-09-01T12:00:00Z' }, // hors fenêtre
    ], NOW, 4)
    expect(s.map(x => x.debut)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    expect(s.map(x => x.nombre)).toEqual([0, 0, 1, 2])
  })
})

const ilYaH = (h: number) => new Date(NOW.getTime() - h * 36e5).toISOString()

function laveur(w: Partial<WasherFiche> = {}, d: Partial<DonneesLaveur> = {}): DonneesLaveur {
  return {
    washer: {
      id: 'w1', user_id: 'u1', name: 'Test', slug: 'test-1', phone: '0600000000', created_at: ilYaH(48),
      plan: 'pro', grandfathered: false, subscription_status: 'trialing', trial_ends_at: new Date(NOW.getTime() + 20 * 864e5).toISOString(),
      subscription_ends_at: null, cancels_at: null, zone_config: null, base_address: null, logo_url: null, google_review_url: null,
      website_url: null, sms_sender: null, sms_sender_statut: null, pwa_installee_le: null, derniere_connexion_le: null,
      onboarding_complete_at: null, acquisition_source: null, profil_activite: null, facture_nom_legal: null,
      telephone_verifie_le: null, is_preview: false, ...w,
    },
    email: 'a@b.fr', derniereConnexionAuth: null, prestations: [], joursOuverts: [], reservations: [], evenements: [],
    appareilsNotifies: 0, ...d,
  }
}
const resa = (heures: number, status = 'confirmed', saisie = false) =>
  ({ status, created_at: ilYaH(heures), scheduled_at: null, booked_price: 50, saisie_par_laveur: saisie, review_sms_sent_at: null })
const appel = (a: Partial<Appel>): Appel =>
  ({ id: 'a', washer_id: 'w1', appele_le: ilYaH(1), resultat: 'Rappeler', notes: null, prochaine_action: null, relancer_le: null, ...a })

describe('resumerLaveurs', () => {
  it('écarte les comptes internes et la fiche de l’équipe', () => {
    const r = resumerLaveurs([
      laveur({ id: 'w1' }), laveur({ id: 'w2', slug: 'test-ryan-6ca5' }), laveur({ id: 'w3', slug: 'equipe' }),
    ], [], { now: NOW, exclure: 'w3' })
    expect(r.map(l => l.id)).toEqual(['w1'])
  })

  it('compte les réservations des dernières 24 h, sans les annulées, dont celles prises en ligne', () => {
    const [l] = resumerLaveurs([laveur({}, { reservations: [resa(2), resa(5, 'confirmed', true), resa(3, 'cancelled'), resa(30)] })], [], { now: NOW })
    expect(l.reservations24h).toBe(2)
    expect(l.reservations24hEnLigne).toBe(1)
  })

  it('reprend la relance prévue, le dernier vrai appel et le responsable', () => {
    const appels = [
      appel({ id: 'a1', appele_le: ilYaH(1), resultat: 'À rappeler', relancer_le: '2026-11-07', prochaine_action: 'Montrer la page' }),
      appel({ id: 'a2', appele_le: ilYaH(20), resultat: 'Intéressé' }),
      appel({ id: 'a3', washer_id: 'autre', resultat: 'Pas répondu' }),
    ]
    const [l] = resumerLaveurs([laveur()], appels, { now: NOW, responsables: { w1: 'Alexandre' } })
    expect(l.relance).toEqual({ le: '2026-11-07', action: 'Montrer la page', appelId: 'a1', mise: true })
    expect(l.dernierAppel?.resultat).toBe('Intéressé')
    expect(l.responsable).toBe('Alexandre')
    expect(l.enEssai).toBe(true)
    expect(l.payant).toBe(false)
  })

  it('sans suivi : ni relance, ni appel, ni responsable', () => {
    const [l] = resumerLaveurs([laveur()], [], { now: NOW })
    expect(l).toMatchObject({ relance: null, dernierAppel: null, responsable: null, reservations24h: 0 })
  })

  it('client historique : compté comme payant', () => {
    const [l] = resumerLaveurs([laveur({ grandfathered: true, subscription_status: null, trial_ends_at: null })], [], { now: NOW })
    expect(l.payant).toBe(true)
    expect(l.enEssai).toBe(false)
  })
})
