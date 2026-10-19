import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// « Votre tampon est arrivé » (option C, 2026-10-18) : au passage en « Terminé », le client
// reçoit le lien qui fait frapper le tampon sur sa carte.

vi.mock('@/lib/email', () => ({ sendTamponFidelite: vi.fn(async () => ({})) }))
const { sendTamponFidelite } = await import('@/lib/email')
const { apparenceCarte, cleFideliteDepuisCrm, prevenirTampon } = await import('./fideliteServeur')

const JETON = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234'
const REGLAGES = { actif: true, tampons: 10, recompense: 'offerte', valeur: 0, couleur: '#0F7A55' }

function admin({ carte = { jeton: JETON, ajustement: 0 } as Record<string, unknown> | null, terminees = 7, telephone = null as string | null, vehicules = 1, email = 'nadia@example.com' } = {}) {
  const reservations = Array.from({ length: terminees }, (_, i) => ({ id: `r${i}`, status: 'done', fidelite_remise: null, vehicle_count: vehicules, client_email: email, client_phone: telephone }))
  return {
    from: () => {
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self, eq: self, ilike: self, or: self, order: self,
        limit: async () => ({ data: reservations, error: null }),
        maybeSingle: async () => ({ data: carte, error: null }),
        upsert: async () => ({ error: null }),
      })
      return b
    },
  } as unknown as SupabaseClient
}

const LAVEUR = { id: 'w1', name: 'Éclat Mobile', brand_color: '#1D4ED8', plan: 'pro', fidelite: REGLAGES }
const RESA = { id: 'r-actuelle', client_email: 'Nadia@example.com', client_phone: null, client_name: 'Nadia' }

beforeEach(() => { vi.clearAllMocks() })

describe('prevenirTampon', () => {
  it('envoie le lien qui fait frapper le tampon, aux couleurs choisies par le laveur', async () => {
    expect(await prevenirTampon(admin(), LAVEUR, RESA)).toBe(true)
    expect(sendTamponFidelite).toHaveBeenCalledWith(expect.objectContaining({
      to: 'Nadia@example.com',
      url: `https://www.washboard.fr/fidelite/${JETON}?tampon=1`,
      tampons: 7, requis: 10, complete: false, couleur: '#0F7A55',
    }))
  })
  it('reconnaît le client par son téléphone, écrit autrement, avec le même email', async () => {
    await prevenirTampon(admin({ telephone: '06 12 34 56 78' }), LAVEUR, { ...RESA, client_phone: '+33612345678' })
    expect(sendTamponFidelite).toHaveBeenCalledWith(expect.objectContaining({ to: 'Nadia@example.com', tampons: 7 }))
  })
  it('un email jamais vu sur ce numéro : rien ne part (ce seraient les tampons d’un autre)', async () => {
    expect(await prevenirTampon(admin({ telephone: '06 12 34 56 78' }), LAVEUR, { ...RESA, client_email: 'nouvelle@adresse.fr', client_phone: '+33612345678' })).toBe(false)
    expect(sendTamponFidelite).not.toHaveBeenCalled()
  })
  it('première prestation sur un numéro neuf : le lien part', async () => {
    expect(await prevenirTampon(admin({ terminees: 0 }), LAVEUR, RESA)).toBe(true)
  })
  it('un tampon par véhicule : le lien fait frapper autant de tampons', async () => {
    const laveur = { ...LAVEUR, fidelite: { ...REGLAGES, tampon_par_vehicule: true } }
    await prevenirTampon(admin({ terminees: 3, vehicules: 2 }), laveur, { ...RESA, vehicle_count: 2 })
    expect(sendTamponFidelite).toHaveBeenCalledWith(expect.objectContaining({ nouveaux: 2, tampons: 6, url: `https://www.washboard.fr/fidelite/${JETON}?tampon=2` }))
  })
  it('la carte complète : tous les tampons et la récompense débloquée', async () => {
    await prevenirTampon(admin({ terminees: 10 }), LAVEUR, RESA)
    expect(sendTamponFidelite).toHaveBeenCalledWith(expect.objectContaining({ tampons: 10, complete: true }))
  })
  it('rien sans carte de fidélité active, ni sans email du client', async () => {
    expect(await prevenirTampon(admin(), { ...LAVEUR, fidelite: { ...REGLAGES, actif: false } }, RESA)).toBe(false)
    expect(await prevenirTampon(admin(), LAVEUR, { ...RESA, client_email: null, client_phone: '0633333333' })).toBe(false)
    expect(sendTamponFidelite).not.toHaveBeenCalled()
  })
  it('ne fait jamais échouer la clôture du rendez-vous', async () => {
    vi.mocked(sendTamponFidelite).mockRejectedValueOnce(new Error('Resend en panne'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await prevenirTampon(admin(), LAVEUR, RESA)).toBe(false)
  })
})

describe('cleFideliteDepuisCrm', () => {
  it('la fiche rangée par email retrouve le téléphone du client dans ses réservations', async () => {
    expect(await cleFideliteDepuisCrm(admin({ telephone: '06 12 34 56 78' }), 'w1', 'nadia@example.com')).toBe('tel:33612345678')
  })
  it('sans téléphone connu, la carte reste celle de l’email ; une fiche par téléphone le garde', async () => {
    expect(await cleFideliteDepuisCrm(admin(), 'w1', 'nadia@example.com')).toBe('nadia@example.com')
    expect(await cleFideliteDepuisCrm(admin(), 'w1', 'tel:0612345678')).toBe('tel:33612345678')
  })
})

describe('apparenceCarte', () => {
  const r = { ...REGLAGES, recompense: 'offerte' as const, offre_options: true, offre_deplacement: false, tampon_par_vehicule: false, finition: 'holo' as const }
  const avecLogo = { ...LAVEUR, logo_url: 'https://x.supabase.co/logo.png', grandfathered: true }
  it('le logo par défaut s’il y en a un, l’initiale si le laveur la préfère', () => {
    expect(apparenceCarte(avecLogo, r, JETON)).toMatchObject({ logo: 'https://x.supabase.co/logo.png', numero: 'A1B2', recompense: 'Prestation offerte' })
    expect(apparenceCarte(avecLogo, { ...r, embleme: 'initiale' }, JETON).logo).toBeNull()
  })
  it('pas de logo sans l’offre qui permet la page personnalisée', () => {
    expect(apparenceCarte({ ...avecLogo, grandfathered: false, plan: 'decouverte' }, r).logo).toBeNull()
  })
  it('la couleur de marque quand le laveur n’en a pas choisi', () => {
    expect(apparenceCarte(LAVEUR, { ...r, couleur: undefined }).couleur).toBe('#1D4ED8')
  })
})
