import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Rappels de rendez-vous par email : qui reçoit quoi, et à quel moment.

type Fiche = Record<string, unknown>

let rdvs: Fiche[]
let laveur: Fiche | null
let emailEchoue: false | { name: string }
let envois: { to: string; heures: number }[]
let prestationsEnvoyees: string[]
let ecritures: { id?: string; valeurs: Record<string, unknown> }[]

function builder(table: string) {
  const etat: { valeurs?: Record<string, unknown>; id?: string } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  const suite = () => b
  const reponse = () => {
    if (etat.valeurs) { ecritures.push({ id: etat.id, valeurs: etat.valeurs }); return { data: null, error: null } }
    return table === 'washers' ? { data: laveur, error: null } : { data: rdvs, error: null }
  }
  b.select = suite; b.not = suite; b.gt = suite; b.lte = suite; b.order = suite; b.limit = suite
  b.update = (v: Record<string, unknown>) => { etat.valeurs = v; return b }
  b.eq = (c: string, v: string) => { if (c === 'id') etat.id = v; return b }
  b.maybeSingle = () => Promise.resolve(reponse())
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(reponse()).then(ok, ko)
  return b
}

vi.mock('@/lib/cronRequest', () => ({
  isAuthorizedCron: () => true,
  parseTestMode: () => ({ enabled: false }),
  createAdminClient: () => ({ from: (t: string) => builder(t) }),
}))
vi.mock('@/lib/email', () => ({
  sendRappelRdv: async (p: { to: string; heures: number; serviceName: string }) => {
    if (emailEchoue) return { data: null, error: emailEchoue }
    envois.push({ to: p.to, heures: p.heures })
    prestationsEnvoyees.push(p.serviceName)
    return { data: { id: 'x' }, error: null }
  },
}))

const { GET } = await import('./route')

const requete = () => new Request('https://www.washboard.fr/api/cron/rappels-rdv') as never
const dans = (heures: number) => new Date(Date.now() + heures * 3_600_000).toISOString()
const ilYA = (heures: number) => dans(-heures)

const RDV = () => ({
  id: 'b1', washer_id: 'w1', client_name: 'Julie', client_email: 'julie@example.fr',
  scheduled_at: dans(23), created_at: ilYA(72), address: '1 rue de Paris', lieu: null,
  rappels_rdv_envoyes: [], services: { name: 'Lavage complet' },
})

beforeEach(() => {
  rdvs = [RDV()]
  laveur = {
    name: 'Kooki Clean', phone: '0612345678', rappel_rdv_actif: true, rappel_rdv_heures: [24, 3],
    account_status: 'active', subscription_status: 'active', subscription_ends_at: null, trial_ends_at: null,
  }
  emailEchoue = false
  envois = []
  prestationsEnvoyees = []
  ecritures = []
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('GET /api/cron/rappels-rdv', () => {
  it('envoie le rappel « 24 h avant » et le note', async () => {
    const body = await (await GET(requete())).json()
    expect(body).toMatchObject({ ok: true, envoyes: 1, echecs: 0 })
    expect(envois).toEqual([{ to: 'julie@example.fr', heures: 24 }])
    expect(ecritures).toEqual([{ id: 'b1', valeurs: { rappels_rdv_envoyes: [24] } }])
    expect(prestationsEnvoyees).toEqual(['Lavage complet'])
  })

  it('nomme toutes les prestations, y compris celles ajoutées au rendez-vous', async () => {
    const ajoutee = { id: 'prestation:p2', label: 'Lavage intérieur', price: 30, category: 'prestation' }
    rdvs = [{ ...RDV(), vehicles_detail: [{ type: 'voiture', count: 1, unit_price: 40, addons: [ajoutee] }], selected_addons: [ajoutee] }]
    await GET(requete())
    expect(prestationsEnvoyees).toEqual(['Lavage complet + Lavage intérieur'])
  })

  it('n\'envoie rien avant l\'heure du rappel', async () => {
    rdvs = [{ ...RDV(), scheduled_at: dans(30) }]
    const body = await (await GET(requete())).json()
    expect(body.envoyes).toBe(0)
    expect(ecritures).toEqual([])
  })

  it('ne renvoie pas un rappel déjà parti', async () => {
    rdvs = [{ ...RDV(), rappels_rdv_envoyes: [24] }]
    expect((await (await GET(requete())).json()).envoyes).toBe(0)
  })

  it('envoie le second rappel quand son heure vient', async () => {
    rdvs = [{ ...RDV(), scheduled_at: dans(2.5), rappels_rdv_envoyes: [24] }]
    await GET(requete())
    expect(envois).toEqual([{ to: 'julie@example.fr', heures: 3 }])
    expect(ecritures[0].valeurs).toEqual({ rappels_rdv_envoyes: [24, 3] })
  })

  it('rien si le laveur a coupé les rappels', async () => {
    laveur = { ...laveur, rappel_rdv_actif: false }
    expect((await (await GET(requete())).json()).envoyes).toBe(0)
  })

  it('allumé par défaut quand la colonne n\'est pas renseignée', async () => {
    laveur = { ...laveur, rappel_rdv_actif: null, rappel_rdv_heures: null }
    expect((await (await GET(requete())).json()).envoyes).toBe(1)
  })

  it('respecte les heures choisies par le laveur', async () => {
    laveur = { ...laveur, rappel_rdv_heures: [48] }
    // à 23 h du rendez-vous, le rappel « 48 h avant » est échu mais le rendez-vous a été pris il y a 72 h : il part
    await GET(requete())
    expect(envois[0].heures).toBe(48)
  })

  it('pas de rappel pour un rendez-vous pris après l\'heure du rappel', async () => {
    rdvs = [{ ...RDV(), created_at: ilYA(0.5) }]
    expect((await (await GET(requete())).json()).envoyes).toBe(0)
  })

  it('rien pour un compte désactivé', async () => {
    laveur = { ...laveur, account_status: 'deactivated' }
    expect((await (await GET(requete())).json()).envoyes).toBe(0)
  })

  it('un échec d\'envoi n\'est pas noté : il sera rejoué', async () => {
    emailEchoue = { name: 'application_error' }
    const body = await (await GET(requete())).json()
    expect(body).toMatchObject({ ok: false, envoyes: 0, echecs: 1 })
    expect(ecritures).toEqual([])
  })

  it('un refus définitif est noté, sinon il reviendrait toutes les 15 minutes', async () => {
    emailEchoue = { name: 'validation_error' }
    await GET(requete())
    expect(ecritures).toHaveLength(1)
  })
})
