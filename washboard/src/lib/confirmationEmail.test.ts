import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const traces = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
vi.mock('@/lib/logger', () => ({ logger: traces }))

const { envoyer } = vi.hoisted(() => ({ envoyer: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmailConfirmation: envoyer }))

const { envoyerLienConfirmation } = await import('./confirmationEmail')

let lien: { data: unknown; error: unknown }
const generateLink = vi.fn(async () => lien)
const admin = { auth: { admin: { generateLink } } } as unknown as SupabaseClient

const PARAMS = { userId: 'u-1', email: 'test@exemple.fr', washerName: 'Kooki Clean', origin: 'https://www.washboard.fr' }

beforeEach(() => {
  vi.clearAllMocks()
  lien = { data: { properties: { hashed_token: 'abc+/=', action_link: 'https://supabase/verify' } }, error: null }
  envoyer.mockResolvedValue({ data: { id: 'm-1' }, error: null })
})

describe('envoyerLienConfirmation', () => {
  it('envoie un lien vers notre route /auth/confirm, jamais l’action_link Supabase', async () => {
    expect(await envoyerLienConfirmation(admin, PARAMS)).toBe(true)
    expect(envoyer).toHaveBeenCalledWith({
      to: 'test@exemple.fr',
      washerName: 'Kooki Clean',
      confirmUrl: 'https://www.washboard.fr/auth/confirm?token_hash=abc%2B%2F%3D&type=signup',
    })
  })

  it('demande un lien de type signup avec un mot de passe jetable différent à chaque fois', async () => {
    await envoyerLienConfirmation(admin, PARAMS)
    await envoyerLienConfirmation(admin, PARAMS)
    const [a, b] = generateLink.mock.calls.map(c => (c as unknown[])[0] as { type: string; password: string })
    expect(a.type).toBe('signup')
    expect(a.password.length).toBeGreaterThanOrEqual(32)
    expect(a.password).not.toBe(b.password)
  })

  it('trace et renvoie false si le lien ne peut pas être généré', async () => {
    lien = { data: null, error: { message: 'boom' } }
    expect(await envoyerLienConfirmation(admin, PARAMS)).toBe(false)
    expect(envoyer).not.toHaveBeenCalled()
    expect(traces.error).toHaveBeenCalledWith('auth.confirmation.generate_link_failed', { userId: 'u-1' }, { message: 'boom' })
  })

  it('traite un refus Resend sans exception comme un échec', async () => {
    // Le piège relevé par la revue sécurité : Resend renvoie `{ error }` sans
    // lever. Ne regarder que les exceptions ferait croire que l'email est parti.
    envoyer.mockResolvedValue({ data: null, error: { message: 'domaine non vérifié' } })
    expect(await envoyerLienConfirmation(admin, PARAMS)).toBe(false)
    expect(traces.error).toHaveBeenCalledWith('auth.confirmation.send_failed', { userId: 'u-1' }, { message: 'domaine non vérifié' })
  })

  it('ne lève pas si Resend lève', async () => {
    envoyer.mockRejectedValue(new Error('réseau'))
    expect(await envoyerLienConfirmation(admin, PARAMS)).toBe(false)
    expect(traces.error).toHaveBeenCalled()
  })
})
