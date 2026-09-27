import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tests de la création d'un devis ou d'une facture écrits à la main.
//
// Deux promesses tiennent tout le reste, et ce sont elles qu'on vérifie ici :
//
//  1. le CONTENU est construit à partir de la fiche du laveur en base, jamais de ce que le
//     navigateur envoie. Sans ça, n'importe qui pourrait poster un SIRET et un nom légal
//     choisis et fabriquer une facture au nom de quelqu'un d'autre ;
//  2. un document sans NUMÉRO n'existe pas : si l'attribution échoue, la ligne est retirée
//     plutôt que de laisser un document muet, invisible du client et introuvable au contrôle.

type Reponse = { data?: unknown; error?: unknown }

const WASHER = {
  id: 'washer-1',
  name: 'AutoNettoyage',
  phone: '06 12 34 56 78',
  logo_url: null,
  brand_color: null,
  facture_statut: 'ei',
  facture_nom_legal: 'Jean Dupont',
  facture_siret: '73282932000074',
  facture_adresse: '8 rue des Lilas, 95560 Maffliers',
  facture_regime_tva: 'franchise',
  facture_taux_tva: null,
  facture_numero_tva: null,
}

let plan: { utilisateur: unknown; washer: Reponse; insert: Reponse; rpc: Reponse }

const inserts: Record<string, unknown>[] = []
const supprimes: string[] = []

const fauxClient = {
  from: () => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self, eq: self, order: self, limit: self,
      single: () => Promise.resolve(plan.washer),
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
      insert: (valeurs: Record<string, unknown>) => { inserts.push(valeurs); return b },
      select: self,
      delete: () => b,
      eq: (_col: string, valeur: string) => { supprimes.push(valeur); return Promise.resolve({ error: null }) },
      single: () => Promise.resolve(plan.insert),
    })
    return b
  },
  rpc: async () => plan.rpc,
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))

const { POST } = await import('./route')

const SAISIE = {
  genre: 'facture' as const,
  clientNom: 'Marie Martin',
  clientEmail: 'marie@example.com',
  clientTelephone: '06 12 34 56 78',
  clientAdresse: '3 allée des Roses, 95000 Cergy',
  professionnel: false,
  entreprise: '',
  siret: '',
  date: '2026-09-27',
  lieu: '3 allée des Roses, 95000 Cergy',
  lignes: [{ designation: 'Nettoyage canapé', quantite: 1, prixUnitaireTtc: 120 }],
  remiseTtc: 0,
  valableJusquau: null,
  note: '',
}

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}

beforeEach(() => {
  inserts.length = 0
  supprimes.length = 0
  plan = {
    utilisateur: { id: 'user-1' },
    washer: { data: WASHER, error: null },
    insert: { data: { id: 'doc-1' }, error: null },
    rpc: { data: [{ numero: 'F-00015' }], error: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('POST /api/documents — chemin nominal', () => {
  it('émet la facture et rend son numéro', async () => {
    const res = await POST(requete({ saisie: SAISIE }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'doc-1', numero: 'F-00015' })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ washer_id: 'washer-1', genre: 'facture', statut: 'emis' })
  })

  it('fige le total et les mentions du laveur dans le contenu', async () => {
    await POST(requete({ saisie: SAISIE }))
    const contenu = inserts[0].contenu as { vendeur: Record<string, unknown>; totaux: Record<string, number> }
    expect(contenu.totaux).toEqual({ ht: 120, tva: 0, ttc: 120 })
    expect(contenu.vendeur.nomLegal).toBe('Jean Dupont EI')
    expect(contenu.vendeur.siret).toBe('73282932000074')
  })

  it('porte la validité d’un devis jusque dans sa colonne', async () => {
    const devis = { ...SAISIE, genre: 'devis' as const, date: null, valableJusquau: '2099-01-31' }
    await POST(requete({ saisie: devis }))
    expect(inserts[0]).toMatchObject({ genre: 'devis', valable_jusquau: '2099-01-31' })
  })
})

describe('POST /api/documents — ce que le navigateur ne décide pas', () => {
  it('ignore un vendeur envoyé par le client : les mentions viennent de la base', async () => {
    await POST(requete({
      saisie: {
        ...SAISIE,
        // Champs hostiles, tels qu'un bundle modifié pourrait les poster.
        vendeur: { nomLegal: 'Quelqu’un d’autre', siret: '00000000000000' },
      },
    }))
    const contenu = inserts[0].contenu as { vendeur: Record<string, unknown> }
    expect(contenu.vendeur.nomLegal).toBe('Jean Dupont EI')
    expect(contenu.vendeur.siret).toBe('73282932000074')
  })

  it('n’attribue jamais le numéro lui-même : il vient de la fonction SQL', async () => {
    await POST(requete({ saisie: { ...SAISIE, numero: 'F-99999' } }))
    expect(inserts[0].numero).toBeUndefined()
  })

  it('un corps incomplet donne un refus clair, pas une panne', async () => {
    // Un ancien bundle après une mise en ligne, ou un curieux : la route ne doit pas
    // répondre 500 parce qu'il manque une clé.
    for (const saisie of [{}, { genre: 'devis' }, { clientNom: 'Marie', lignes: 'pas un tableau' }]) {
      const res = await POST(requete({ saisie }))
      expect(res.status).toBe(400)
    }
    expect(inserts).toHaveLength(0)
  })

  it('ne garde que ce que le domaine connaît', async () => {
    await POST(requete({ saisie: { ...SAISIE, statut: 'transforme', washer_id: 'un-autre' } }))
    expect(inserts[0]).toMatchObject({ washer_id: 'washer-1', statut: 'emis' })
  })
})

describe('POST /api/documents — refus', () => {
  it('refuse une saisie invalide, avec la phrase du domaine', async () => {
    const res = await POST(requete({ saisie: { ...SAISIE, clientNom: '' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/nom du client/)
    expect(inserts).toHaveLength(0)
  })

  it('refuse un genre inconnu', async () => {
    const res = await POST(requete({ saisie: { ...SAISIE, genre: 'avoir' } }))
    expect(res.status).toBe(400)
  })

  it('refuse tant que les informations de facturation du laveur manquent', async () => {
    plan.washer = { data: { ...WASHER, facture_siret: null }, error: null }
    const res = await POST(requete({ saisie: SAISIE }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/SIRET/)
    expect(inserts).toHaveLength(0)
  })

  it('refuse un visiteur non connecté', async () => {
    plan.utilisateur = null
    expect((await POST(requete({ saisie: SAISIE }))).status).toBe(401)
  })
})

describe('POST /api/documents — l’émission échoue', () => {
  it('retire la ligne plutôt que de laisser un document sans numéro', async () => {
    plan.rpc = { data: null, error: { message: 'deadlock' } }
    const res = await POST(requete({ saisie: SAISIE }))
    expect(res.status).toBeGreaterThanOrEqual(500)
    expect(supprimes).toContain('doc-1')
  })
})
