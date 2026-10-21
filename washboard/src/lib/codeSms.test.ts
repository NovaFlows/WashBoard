import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// Code d'inscription par SMS (2026-10-21). Ce qui compte : le code n'est jamais stocké en
// clair, il expire, il se tente 5 fois, il ne sert qu'une fois — et les parades contre la
// fraude aux SMS tiennent (mobiles français, 60 s entre deux envois, 5 envois par compte,
// plafond global).

const { sendSms } = vi.hoisted(() => ({ sendSms: vi.fn() }))
vi.mock('@/lib/sms', () => ({ sendSms, EXPEDITEUR_SMS_DEFAUT: 'WashBoard' }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const { envoyerCodeSms, verifierCodeSms, estMobileFrancais, telephoneMasque, texteSmsCode, phraseEnvoi, LONGUEUR_CODE_SMS } = await import('./codeSms')

type Ligne = Record<string, unknown>
let lignes: Map<string, Ligne>
let enAttente24h: number

/** Une table `codes_sms` en mémoire, juste ce que le module appelle. */
function admin(): SupabaseClient {
  return {
    from: () => {
      let filtreId: string | null = null
      let compte = false
      let maj: Ligne | null = null
      let suppression = false
      const b: Record<string, unknown> = {}
      Object.assign(b, {
        select: (_c: string, opts?: { count?: string }) => { compte = !!opts?.count; return b },
        eq: (_col: string, v: string) => {
          filtreId = v
          if (maj) { lignes.set(v, { ...lignes.get(v), ...maj }); return Promise.resolve({ error: null }) }
          if (suppression) { lignes.delete(v); return Promise.resolve({ error: null }) }
          return b
        },
        gte: () => (compte ? Promise.resolve({ count: enAttente24h, error: null }) : b),
        maybeSingle: async () => ({ data: filtreId ? lignes.get(filtreId) ?? null : null, error: null }),
        upsert: async (l: Ligne) => { lignes.set(l.user_id as string, l); return { error: null } },
        update: (v: Ligne) => { maj = v; return b },
        delete: () => { suppression = true; return b },
      })
      return b
    },
  } as unknown as SupabaseClient
}

const T0 = new Date('2026-10-21T10:00:00Z')
const plus = (ms: number) => new Date(T0.getTime() + ms)
const codeEnvoye = () => /est (\d{6})\./.exec(String(sendSms.mock.calls.at(-1)?.[0]?.content))![1]

beforeEach(() => {
  lignes = new Map()
  enAttente24h = 0
  sendSms.mockReset().mockResolvedValue(undefined)
})

describe('numéro et texte', () => {
  it('n’accepte que les mobiles français', () => {
    expect(estMobileFrancais('0612345678')).toBe(true)
    expect(estMobileFrancais('0712345678')).toBe(true)
    for (const n of ['0123456789', '0912345678', '+33612345678', '061234567', null]) expect(estMobileFrancais(n), String(n)).toBe(false)
  })
  it('masque le numéro et tient en un seul SMS', () => {
    expect(telephoneMasque('0612345678')).toBe('06 •• •• •• 78')
    const texte = texteSmsCode('123456')
    expect(texte.length).toBeLessThan(160)
    expect(texte).toMatch(/123456/)
    expect(texte.endsWith('@www.washboard.fr #123456')).toBe(true)
  })
  it('chaque refus a sa phrase', () => {
    expect(phraseEnvoi({ ok: false, raison: 'attente', secondes: 30 })).toMatch(/^Un SMS vient de partir/)
    expect(phraseEnvoi({ ok: false, raison: 'numero' })).toMatch(/mobile/)
  })
})

describe('envoyerCodeSms', () => {
  it('envoie un code à 6 chiffres, sous le nom WashBoard, sans le garder en clair', async () => {
    expect(await envoyerCodeSms(admin(), { userId: 'u-1', telephone: '0612345678' }, T0)).toEqual({ ok: true })
    expect(sendSms).toHaveBeenCalledWith(expect.objectContaining({ to: '0612345678', sender: 'WashBoard' }))
    const code = codeEnvoye()
    expect(code).toHaveLength(LONGUEUR_CODE_SMS)
    const ligne = lignes.get('u-1')!
    expect(JSON.stringify(ligne)).not.toContain(code)
    expect(ligne).toMatchObject({ telephone: '0612345678', essais: 0, envois: 1 })
  })

  it('refuse un numéro qui n’est pas un mobile français, sans rien envoyer', async () => {
    expect(await envoyerCodeSms(admin(), { userId: 'u-1', telephone: '0123456789' }, T0)).toEqual({ ok: false, raison: 'numero' })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('60 s entre deux envois, puis 5 envois au plus', async () => {
    const a = admin()
    await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, T0)
    expect(await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, plus(20_000))).toEqual({ ok: false, raison: 'attente', secondes: 40 })
    for (let i = 1; i < 5; i++) expect((await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, plus(i * 61_000))).ok).toBe(true)
    expect(await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, plus(10 * 61_000))).toEqual({ ok: false, raison: 'trop_d_envois' })
    expect(sendSms).toHaveBeenCalledTimes(5)
  })

  it('plafond global : au-delà de 30 inscriptions en attente sur 24 h, plus aucun SMS', async () => {
    enAttente24h = 30
    expect(await envoyerCodeSms(admin(), { userId: 'u-neuf', telephone: '0612345678' }, T0)).toEqual({ ok: false, raison: 'plafond' })
    expect(sendSms).not.toHaveBeenCalled()
  })

  it('Brevo en panne : « panne », jamais une exception', async () => {
    sendSms.mockRejectedValue(new Error('Brevo SMS error 402'))
    expect(await envoyerCodeSms(admin(), { userId: 'u-1', telephone: '0612345678' }, T0)).toEqual({ ok: false, raison: 'panne' })
  })
})

describe('verifierCodeSms', () => {
  async function avecCode() {
    const a = admin()
    await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, T0)
    return { a, code: codeEnvoye() }
  }

  it('bon code : ok, et il ne sert qu’une fois', async () => {
    const { a, code } = await avecCode()
    expect(await verifierCodeSms(a, 'u-1', code, plus(60_000))).toBe('ok')
    expect(await verifierCodeSms(a, 'u-1', code, plus(61_000))).toBe('absent')
  })

  it('le code d’un compte ne vaut pas pour un autre', async () => {
    const { a, code } = await avecCode()
    lignes.set('u-2', { ...lignes.get('u-1'), user_id: 'u-2' })
    expect(await verifierCodeSms(a, 'u-2', code, plus(1000))).toBe('invalide')
  })

  it('expiré au bout de 10 minutes', async () => {
    const { a, code } = await avecCode()
    expect(await verifierCodeSms(a, 'u-1', code, plus(10 * 60_000 + 1))).toBe('expire')
  })

  it('5 essais, puis bloqué même avec le bon code', async () => {
    const { a, code } = await avecCode()
    const faux = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) expect(await verifierCodeSms(a, 'u-1', faux, plus(1000))).toBe('invalide')
    expect(await verifierCodeSms(a, 'u-1', faux, plus(1000))).toBe('bloque')
    expect(await verifierCodeSms(a, 'u-1', code, plus(1000))).toBe('bloque')
  })

  it('un nouveau code remet les essais à zéro et remplace l’ancien', async () => {
    const { a, code: ancien } = await avecCode()
    for (let i = 0; i < 5; i++) await verifierCodeSms(a, 'u-1', '999999', plus(1000))
    await envoyerCodeSms(a, { userId: 'u-1', telephone: '0612345678' }, plus(61_000))
    const nouveau = codeEnvoye()
    if (nouveau !== ancien) expect(await verifierCodeSms(a, 'u-1', ancien, plus(62_000))).toBe('invalide')
    expect(await verifierCodeSms(a, 'u-1', nouveau, plus(62_000))).toBe('ok')
  })
})
