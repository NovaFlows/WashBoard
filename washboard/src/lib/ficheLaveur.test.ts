import { describe, it, expect } from 'vitest'
import { analyserLaveur, sourceVisite, ilYa, type DonneesLaveur, type WasherFiche } from './ficheLaveur'

const NOW = new Date('2026-11-05T12:00:00Z')
const ilYaJours = (j: number) => new Date(NOW.getTime() - j * 864e5).toISOString()

function laveur(w: Partial<WasherFiche> = {}, d: Partial<DonneesLaveur> = {}): DonneesLaveur {
  return {
    washer: {
      id: 'w1', user_id: 'u1', name: 'Test', slug: 'test-1', phone: '0600000000', created_at: ilYaJours(2),
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
const visites = (n: number, etape: string, hote: string | null = null) =>
  Array.from({ length: n }, (_, i) => ({ session_id: `s${i}`, step: etape, referrer_host: hote, created_at: ilYaJours(1) }))

describe('analyserLaveur', () => {
  it('nouvel inscrit sans rien : page à configurer, proposer de la remplir ensemble', () => {
    const t = analyserLaveur(laveur(), NOW)
    expect(t.pagePrete).toBe(false)
    expect(t.statut.libelle).toBe('En essai Pro')
    expect(t.pourquoi).toMatch(/pas configurée/)
    expect(t.aDire.some(x => x.includes('remplir sa page ensemble'))).toBe(true)
    expect(t.problemes).toContain('Aucune prestation : personne ne peut réserver')
    expect(t.priorite).toBe(2)
  })

  it('essai fini sans paiement (compte récent) : Découverte (essai fini)', () => {
    const t = analyserLaveur(laveur({ trial_ends_at: ilYaJours(3), created_at: ilYaJours(40) }), NOW)
    expect(t.statut.libelle).toBe('Découverte (essai fini)')
    expect(t.priorite).toBe(3)
  })

  it('page prête mais invisible : conseiller le lien en bio', () => {
    const t = analyserLaveur(laveur({}, { prestations: [{ name: 'Intérieur', price: 50, en_veille: false }], joursOuverts: [1, 2] }), NOW)
    expect(t.pagePrete).toBe(true)
    expect(t.pourquoi).toMatch(/Presque personne/)
    expect(t.aDire.some(x => x.includes('washboard.fr/book/test-1'))).toBe(true)
  })

  it('repère l’étape où les visiteurs abandonnent', () => {
    const t = analyserLaveur(laveur({}, {
      prestations: [{ name: 'Intérieur', price: 50, en_veille: false }], joursOuverts: [1],
      evenements: [...visites(10, 'prestation', 'l.instagram.com'), ...visites(8, 'creneau'), ...visites(1, 'coordonnees')],
    }), NOW)
    expect(t.activite.parcours).toEqual([10, 8, 1, 0])
    expect(t.pourquoi).toMatch(/au choix du créneau/)
    expect(t.activite.lienReseaux).toMatch(/^Oui : visites venues de Instagram/)
    expect(t.priorite).toBe(1)
    expect(t.aDire.some(x => x.includes('horaires'))).toBe(true)
  })

  it('perte avant les créneaux : pas de conseil sur les horaires', () => {
    const t = analyserLaveur(laveur({}, {
      prestations: [{ name: 'Intérieur', price: 50, en_veille: false }], joursOuverts: [1],
      evenements: [...visites(22, 'prestation'), ...visites(3, 'creneau')],
    }), NOW)
    expect(t.pourquoi).toMatch(/sans rien choisir/)
    expect(t.aDire.some(x => x.includes('horaires'))).toBe(false)
    expect(t.aDire.some(x => x.includes('Regarder sa page avec lui'))).toBe(true)
  })

  it('les prestations en veille ne comptent pas', () => {
    const t = analyserLaveur(laveur({}, { prestations: [{ name: 'X', price: 10, en_veille: true }], joursOuverts: [1] }), NOW)
    expect(t.pagePrete).toBe(false)
  })

  it('ignore les réservations annulées et compte le chiffre sur 30 jours', () => {
    const r = (j: number, status = 'confirmed', prix = 60) => ({ status, created_at: ilYaJours(j), scheduled_at: null, booked_price: prix, saisie_par_laveur: false, review_sms_sent_at: null })
    const t = analyserLaveur(laveur({}, { reservations: [r(2), r(5), r(3, 'cancelled'), r(45)] }), NOW)
    expect(t.activite.reservations).toBe(3)
    expect(t.activite.reservations30).toBe(2)
    expect(t.activite.chiffre30).toBe(120)
  })

  it('préfère derniere_connexion_le à la date de connexion Supabase', () => {
    const t = analyserLaveur(laveur({ derniere_connexion_le: ilYaJours(1) }, { derniereConnexionAuth: ilYaJours(20) }), NOW)
    expect(t.activite.derniereConnexion).toBe(ilYaJours(1))
    expect(t.problemes.some(p => p.startsWith('Pas connecté'))).toBe(false)
  })
})

describe('sourceVisite', () => {
  it('classe les provenances', () => {
    expect(sourceVisite(null)).toBe('Direct')
    expect(sourceVisite('l.instagram.com')).toBe('Instagram')
    expect(sourceVisite('www.washboard.fr')).toBe('Direct')
    expect(sourceVisite('www.monsite.fr')).toBe('Site monsite.fr')
  })
})

describe('ilYa', () => {
  it('formate court', () => {
    expect(ilYa(new Date(NOW.getTime() - 5 * 60000).toISOString(), NOW)).toBe('il y a 5 min')
    expect(ilYa(ilYaJours(3), NOW)).toBe('il y a 3 j')
  })
})
