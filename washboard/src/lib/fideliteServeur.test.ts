import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// « Votre tampon est arrivé » (option C, 2026-10-18) : au passage en « Terminé », le client
// reçoit le lien qui fait frapper le tampon sur sa carte.

vi.mock('@/lib/email', () => ({ sendTamponFidelite: vi.fn(async () => ({})) }))
const { sendTamponFidelite } = await import('@/lib/email')
const { apparenceCarte, prevenirTampon } = await import('./fideliteServeur')

const JETON = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234'
const REGLAGES = { actif: true, tampons: 10, recompense: 'offerte', valeur: 0, couleur: '#0F7A55' }

function admin({ carte = { jeton: JETON, ajustement: 0 } as Record<string, unknown> | null, terminees = 7 } = {}) {
  const reservations = Array.from({ length: terminees }, () => ({ status: 'done', fidelite_remise: null, client_email: 'nadia@example.com', client_phone: null }))
  return {
    from: () => {
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self, eq: self, ilike: self, or: self,
        limit: async () => ({ data: reservations, error: null }),
        maybeSingle: async () => ({ data: carte, error: null }),
        upsert: async () => ({ error: null }),
      })
      return b
    },
  } as unknown as SupabaseClient
}

const LAVEUR = { id: 'w1', name: 'Éclat Mobile', brand_color: '#1D4ED8', plan: 'pro', fidelite: REGLAGES }
const RESA = { client_email: 'Nadia@example.com', client_phone: null, client_name: 'Nadia' }

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

describe('apparenceCarte', () => {
  const r = { ...REGLAGES, recompense: 'offerte' as const, offre_options: true, offre_deplacement: false, finition: 'holo' as const }
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
