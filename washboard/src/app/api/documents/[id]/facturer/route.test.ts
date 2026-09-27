import { describe, it, expect, vi, beforeEach } from 'vitest'
import { construireDocument, saisieNeuve } from '@/lib/documents'
import type { VendeurFacturable } from '@/lib/facture'

// Tests de « Transformer en facture ».
//
// Le risque propre à ce geste : consommer deux numéros de facture pour un même devis (deux
// taps, une connexion lente), et facturer autre chose que ce que le client a accepté. La
// facture est donc reconstruite depuis le contenu FIGÉ du devis, en base — jamais depuis ce
// que renvoie le navigateur — et un devis déjà transformé rend sa facture existante.

type Reponse = { data?: unknown; error?: unknown }

const WASHER = {
  id: 'washer-1', name: 'AutoNettoyage', phone: null, logo_url: null, brand_color: null,
  facture_statut: 'ei', facture_nom_legal: 'Jean Dupont', facture_siret: '73282932000074',
  facture_adresse: '8 rue des Lilas, 95560 Maffliers', facture_regime_tva: 'franchise',
}

const CONTENU_DEVIS = construireDocument({
  ...saisieNeuve('devis', '2026-09-27'),
  clientNom: 'Marie Martin',
  clientEmail: 'marie@example.com',
  clientAdresse: '3 allée des Roses, 95000 Cergy',
  lieu: '3 allée des Roses, 95000 Cergy',
  lignes: [
    { designation: 'Nettoyage canapé', quantite: 1, prixUnitaireTtc: 120 },
    { designation: 'Tapis', quantite: 3, prixUnitaireTtc: 16.1 },
  ],
  remiseTtc: 8.3,
  note: 'Prévoir un point d’eau.',
}, WASHER as unknown as VendeurFacturable)

let plan: { utilisateur: unknown; washer: Reponse; devis: Reponse; insert: Reponse; rpc: Reponse }

const inserts: Record<string, unknown>[] = []
const majs: Record<string, unknown>[] = []
let appelsRpc = 0

const fauxClient = {
  from: (table: string) => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self, eq: self,
      single: () => Promise.resolve(plan.washer),
      maybeSingle: () => Promise.resolve(table === 'documents' ? plan.devis : plan.washer),
    })
    return b
  },
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

const fauxAdmin = {
  from: () => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      insert: (v: Record<string, unknown>) => { inserts.push(v); return b },
      update: (v: Record<string, unknown>) => { majs.push(v); return b },
      delete: () => b,
      select: self,
      eq: () => Promise.resolve({ error: null }),
      single: () => Promise.resolve(plan.insert),
    })
    return b
  },
  rpc: async () => { appelsRpc++; return plan.rpc },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))

const { POST } = await import('./route')

const appel = () => POST(
  new Request('https://www.washboard.fr/api/documents/devis-1/facturer', { method: 'POST' }) as never,
  { params: Promise.resolve({ id: 'devis-1' }) },
)

beforeEach(() => {
  inserts.length = 0
  majs.length = 0
  appelsRpc = 0
  plan = {
    utilisateur: { id: 'user-1' },
    washer: { data: WASHER, error: null },
    devis: { data: { id: 'devis-1', genre: 'devis', statut: 'accepte', numero: 'D-2026-0002', contenu: CONTENU_DEVIS, facture_id: null }, error: null },
    insert: { data: { id: 'facture-1' }, error: null },
    rpc: { data: [{ numero: 'F-2026-0004' }], error: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('POST /api/documents/[id]/facturer', () => {
  it('crée la facture et rend son numéro', async () => {
    const res = await appel()
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'facture-1', numero: 'F-2026-0004' })
    expect(inserts[0]).toMatchObject({ genre: 'facture', statut: 'emis', devis_id: 'devis-1' })
  })

  it('facture exactement ce que le client a accepté — lignes, remise, total', async () => {
    await appel()
    const contenu = inserts[0].contenu as typeof CONTENU_DEVIS
    expect(contenu.lignes).toEqual(CONTENU_DEVIS.lignes)
    expect(contenu.remiseTtc).toBe(CONTENU_DEVIS.remiseTtc)
    expect(contenu.totaux.ttc).toBe(CONTENU_DEVIS.totaux.ttc)
    expect(contenu.note).toBe('Prévoir un point d’eau.')
  })

  it('la facture n’hérite pas de la date de validité du devis', async () => {
    await appel()
    const contenu = inserts[0].contenu as typeof CONTENU_DEVIS
    expect(contenu.genre).toBe('facture')
    expect(contenu.valableJusquau).toBeNull()
  })

  it('marque le devis « facturé » et le relie à sa facture', async () => {
    await appel()
    expect(majs).toContainEqual({ statut: 'transforme', facture_id: 'facture-1' })
  })

  it('un devis déjà transformé rend sa facture sans en consommer une seconde', async () => {
    plan.devis = { data: { id: 'devis-1', genre: 'devis', statut: 'transforme', numero: 'D-2026-0002', contenu: CONTENU_DEVIS, facture_id: 'facture-1' }, error: null }
    const res = await appel()
    expect(await res.json()).toEqual({ id: 'facture-1', deja: true })
    expect(inserts).toHaveLength(0)
    expect(appelsRpc).toBe(0)
  })

  it('refuse de facturer une facture', async () => {
    plan.devis = { data: { id: 'f-1', genre: 'facture', statut: 'emis', numero: 'F-2026-0003', contenu: CONTENU_DEVIS, facture_id: null }, error: null }
    const res = await appel()
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('refuse tant que les informations de facturation manquent', async () => {
    plan.washer = { data: { ...WASHER, facture_adresse: null }, error: null }
    const res = await appel()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/adresse professionnelle/)
  })

  it('ne marque pas le devis « facturé » si la facture n’a pas pu être numérotée', async () => {
    plan.rpc = { data: null, error: { message: 'deadlock' } }
    const res = await appel()
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(majs).toHaveLength(0)
  })

  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await appel()).status).toBe(401)
  })
})
