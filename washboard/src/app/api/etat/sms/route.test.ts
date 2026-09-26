import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Solde SMS lu par la réunion du matin.
//
// Ce qui compte ici : « 0 crédit » et « je ne sais pas » ne doivent JAMAIS se
// confondre. Le premier est une panne en cours, le second un signal manquant —
// les mélanger ferait écrire un chiffre faux dans le rapport.

let solde: number | null = 900
vi.mock('@/lib/sms', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sms')>()),
  soldeSms: async () => solde,
}))

const { GET } = await import('./route')

function appel(jeton?: string) {
  const headers: Record<string, string> = {}
  if (jeton) headers.authorization = `Bearer ${jeton}`
  return GET(new Request('https://www.washboard.fr/api/etat/sms', { headers }) as never)
}

beforeEach(() => {
  solde = 900
  vi.stubEnv('ETAT_TOKEN', 'jeton-de-test')
})

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('GET /api/etat/sms', () => {
  it('traduit les crédits en MESSAGES, ce qui n est pas la même chose', async () => {
    // 900 crédits = 50 SMS, pas 900. Un crédit est une unité de facturation.
    const res = await appel('jeton-de-test')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.credits).toBe(900)
    expect(body.sms).toBe(50)
    expect(body.bas).toBe(false)
  })

  it('signale un solde bas sur le nombre de messages, pas sur les crédits', async () => {
    // 200 crédits paraissent confortables, mais ne valent que 11 SMS.
    solde = 200
    const body = await (await appel('jeton-de-test')).json()
    expect(body.credits).toBe(200)
    expect(body.sms).toBe(11)
    expect(body.bas).toBe(false)

    solde = 150
    const bas = await (await appel('jeton-de-test')).json()
    expect(bas.sms).toBe(8)
    expect(bas.bas).toBe(true)
  })

  it('rend 0 comme un vrai chiffre, pas comme une erreur', async () => {
    // Zéro crédit est la panne qu'on cherche justement à voir venir.
    solde = 0
    const res = await appel('jeton-de-test')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.credits).toBe(0)
    expect(body.sms).toBe(0)
    expect(body.bas).toBe(true)
  })

  it('distingue un solde illisible d un solde nul', async () => {
    solde = null
    const res = await appel('jeton-de-test')
    expect(res.status).toBe(502)
    expect((await res.json()).credits).toBeNull()
  })

  it('refuse sans jeton, ou avec le mauvais', async () => {
    expect((await appel()).status).toBe(401)
    expect((await appel('pas-le-bon')).status).toBe(401)
  })

  it('le dit quand le serveur n est pas configuré, au lieu de laisser passer', async () => {
    vi.stubEnv('ETAT_TOKEN', '')
    const res = await appel('jeton-de-test')
    expect(res.status).toBe(503)
  })
})
