import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { logoUrlAutorisee, logoPourPdf } from './logoFacture'

beforeEach(() => vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.co'))
afterEach(() => vi.unstubAllEnvs())

describe('logoUrlAutorisee', () => {
  it('accepte un logo de notre stockage', () => {
    expect(logoUrlAutorisee('https://projet.supabase.co/storage/v1/object/public/logos/abc.webp')).toBe(true)
  })

  it('refuse toute autre machine, même déguisée', () => {
    expect(logoUrlAutorisee('https://exemple.com/storage/v1/object/public/logos/abc.webp')).toBe(false)
    expect(logoUrlAutorisee('https://projet.supabase.co.exemple.com/storage/v1/object/public/logos/a.png')).toBe(false)
    expect(logoUrlAutorisee('http://169.254.169.254/latest/meta-data')).toBe(false)
  })

  it('refuse un autre dossier du stockage ou un protocole non chiffré', () => {
    expect(logoUrlAutorisee('https://projet.supabase.co/storage/v1/object/public/backgrounds/a.png')).toBe(false)
    expect(logoUrlAutorisee('http://projet.supabase.co/storage/v1/object/public/logos/a.png')).toBe(false)
  })

  it('refuse tout si l’adresse du stockage n’est pas configurée', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    expect(logoUrlAutorisee('https://projet.supabase.co/storage/v1/object/public/logos/abc.webp')).toBe(false)
  })
})

describe('logoPourPdf', () => {
  it('sans logo ou avec une adresse refusée, ne contacte personne', async () => {
    const espion = vi.spyOn(globalThis, 'fetch')
    expect(await logoPourPdf(null)).toBeNull()
    expect(await logoPourPdf('https://exemple.com/logo.png')).toBeNull()
    expect(espion).not.toHaveBeenCalled()
    espion.mockRestore()
  })
})
