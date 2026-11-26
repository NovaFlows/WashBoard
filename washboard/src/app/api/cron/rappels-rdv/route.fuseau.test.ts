import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Rappels de rendez-vous : chaque e-mail part avec le fuseau de SON laveur,
// déduit de son adresse ou de son téléphone (lib/fuseaux.ts). Faux client
// inspiré de route.test.ts, recopié pour ne pas toucher à ce fichier.

type Fiche = Record<string, unknown>

let rdvs: Fiche[]
let laveurs: Record<string, Fiche>
let envois: { to: string; fuseau?: string }[]

function builder(table: string) {
  const etat: { id?: string; maj?: boolean } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  const suite = () => b
  const reponse = () => {
    if (etat.maj) return { data: null, error: null }
    if (table === 'washers') return { data: (etat.id && laveurs[etat.id]) ?? null, error: null }
    return { data: rdvs, error: null }
  }
  b.select = suite; b.not = suite; b.gt = suite; b.lte = suite; b.order = suite; b.limit = suite; b.in = suite
  b.update = () => { etat.maj = true; return b }
  b.eq = (c: string, v: string) => { if (c === 'id') etat.id = v; return b }
  b.maybeSingle = () => Promise.resolve(reponse())
  b.single = () => Promise.resolve(reponse())
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(reponse()).then(ok, ko)
  return b
}

vi.mock('@/lib/cronRequest', () => ({
  isAuthorizedCron: () => true,
  parseTestMode: () => ({ enabled: false }),
  createAdminClient: () => ({ from: (t: string) => builder(t) }),
}))
vi.mock('@/lib/email', () => ({
  sendRappelRdv: async (p: { to: string; fuseau?: string }) => {
    envois.push({ to: p.to, fuseau: p.fuseau })
    return { data: { id: 'x' }, error: null }
  },
}))

const { GET } = await import('./route')

const requete = () => new Request('https://www.washboard.fr/api/cron/rappels-rdv') as never
const dans = (heures: number) => new Date(Date.now() + heures * 3_600_000).toISOString()

const rdv = (id: string, washer: string, email: string) => ({
  id, washer_id: washer, client_name: 'Client', client_email: email,
  scheduled_at: dans(23), created_at: dans(-72), address: '1 rue X', lieu: null,
  rappels_rdv_envoyes: [], services: { name: 'Lavage complet' },
})

const laveur = (champs: Fiche) => ({
  name: 'Laveur', phone: '0612345678', rappel_rdv_actif: true, rappel_rdv_heures: [24],
  account_status: 'active', subscription_status: 'active', subscription_ends_at: null, trial_ends_at: null,
  base_address: '10 rue de Rivoli, 75001 Paris', ...champs,
})

beforeEach(() => {
  envois = []
  laveurs = {
    paris: laveur({}),
    cayenne: laveur({ base_address: 'Place des Palmistes, 97300 Cayenne' }),
    reunion: laveur({ base_address: null, phone: '0692123456' }),
  }
  rdvs = [rdv('b1', 'paris', 'p@test.fr'), rdv('b2', 'cayenne', 'c@test.fr'), rdv('b3', 'reunion', 'r@test.fr')]
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('GET /api/cron/rappels-rdv — fuseau de chaque laveur', () => {
  it('chaque rappel part avec le fuseau de son laveur', async () => {
    const body = await (await GET(requete())).json()
    expect(body).toMatchObject({ ok: true, envoyes: 3 })
    expect(Object.fromEntries(envois.map(e => [e.to, e.fuseau]))).toEqual({
      'p@test.fr': 'Europe/Paris',
      'c@test.fr': 'America/Cayenne',
      'r@test.fr': 'Indian/Reunion',
    })
  })
})
