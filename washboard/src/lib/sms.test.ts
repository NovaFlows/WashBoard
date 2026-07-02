import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizePhone, sendSms } from './sms'

describe('normalizePhone', () => {
  it('accepte un numéro local 06', () => expect(normalizePhone('0612345678')).toBe('+33612345678'))
  it('accepte un numéro local 07', () => expect(normalizePhone('0712345678')).toBe('+33712345678'))
  it('accepte avec espaces', () => expect(normalizePhone('06 12 34 56 78')).toBe('+33612345678'))
  it('accepte avec tirets', () => expect(normalizePhone('06-12-34-56-78')).toBe('+33612345678'))
  it('accepte déjà en E.164 sans +', () => expect(normalizePhone('33612345678')).toBe('+33612345678'))
  it('accepte déjà en E.164 avec +', () => expect(normalizePhone('+33612345678')).toBe('+33612345678'))
  it('rejette un numéro trop court', () => expect(normalizePhone('0612')).toBeNull())
  it('rejette un numéro étranger inconnu', () => expect(normalizePhone('0044712345678')).toBeNull())
  it('rejette une chaîne vide', () => expect(normalizePhone('')).toBeNull())
})

describe('sendSms', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    process.env.BREVO_API_KEY = 'test-key'
  })

  it("appelle l'API Brevo avec les bons paramètres", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await sendSms({ to: '0612345678', content: 'Bonjour test', sender: 'KookiClean' })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/transactionalSMS/sms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sender: 'KookiClean', recipient: '+33612345678', content: 'Bonjour test' }),
      }),
    )
  })

  it('tronque le sender à 11 caractères', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await sendSms({ to: '0612345678', content: 'Test', sender: 'NomTropLongPourBrevo' })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.sender).toBe('NomTropLong')
    expect(body.sender.length).toBeLessThanOrEqual(11)
  })

  it('utilise WashBoard comme sender par défaut', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await sendSms({ to: '0612345678', content: 'Test' })

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.sender).toBe('WashBoard')
  })

  it('lève une erreur si BREVO_API_KEY manquant', async () => {
    delete process.env.BREVO_API_KEY
    await expect(sendSms({ to: '0612345678', content: 'Test' })).rejects.toThrow('BREVO_API_KEY manquant')
  })

  it('lève une erreur si numéro invalide', async () => {
    await expect(sendSms({ to: '123', content: 'Test' })).rejects.toThrow('Numéro de téléphone invalide')
  })

  it("lève une erreur si l'API Brevo répond en erreur", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' } as Response)
    await expect(sendSms({ to: '0612345678', content: 'Test' })).rejects.toThrow('Brevo SMS error 400')
  })
})
