import { describe, it, expect, vi, beforeEach } from 'vitest'

// Tests de la route de création d'une prestation.
//
// Point d'origine : une prestation « ez » enregistrée à 800 minutes sur le
// compte de test Kooki Clean alors que le plafond (`DUREE_MAX_MINUTES` =
// 480 min, voir `lib/prestation.ts`) est censé la refuser. L'écran (`canSave`
// dans `PrestationsManager`) bloquait déjà bien le bouton Enregistrer : le
// trou n'était pas dans le formulaire, mais rien ne garantissait que CETTE
// route-ci, appelée en direct (ou par un ancien bundle client), refuse
// vraiment 800 précisément — pas juste une valeur ronde comme 5000.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: unknown
  washer: Reponse
  insert: Reponse
  /** Nombre de prestations déjà au catalogue (plafond de l'offre). */
  catalogue: { count: number | null; error: unknown }
}

const inserts: Record<string, unknown>[] = []

function nouveauBuilder(table: string) {
  let comptage = false
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    // Le comptage du catalogue se reconnaît à son option `count` : c'est la
    // seule requête du fichier qu'on attend sans `.single()`.
    select: (_cols?: string, opts?: { count?: string }) => { if (opts?.count) comptage = true; return b },
    eq: self,
    insert: (valeurs: Record<string, unknown>) => { inserts.push(valeurs); return b },
    single: () => Promise.resolve(table === 'washers' ? plan.washer : plan.insert),
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(comptage ? plan.catalogue : { data: null, error: null }).then(ok, ko),
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))

const { POST } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/services', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0]
}

const COMPLETE = {
  name: 'ez',
  price: 80,
  duration_minutes: 90,
  vehicle_types: ['SUV'],
}

beforeEach(() => {
  inserts.length = 0
  plan = {
    utilisateur: { id: 'user-1' },
    washer: { data: { id: 'washer-1', plan: 'pro', grandfathered: false }, error: null },
    insert: { data: { id: 'service-1', ...COMPLETE }, error: null },
    catalogue: { count: 0, error: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('POST /api/services — chemin nominal', () => {
  it('accepte une prestation complète et sous le plafond', async () => {
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(1)
  })
})

describe('POST /api/services — plafond de durée', () => {
  it('refuse 800 minutes précisément, le cas constaté sur Kooki Clean', async () => {
    const res = await POST(requete({ ...COMPLETE, duration_minutes: 800 }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/480/)
    expect(inserts).toHaveLength(0)
  })

  it('refuse 800 minutes envoyées en chaîne, comme le fait le formulaire', async () => {
    // Le formulaire envoie des champs texte (`duration_minutes: '800'`) : la
    // route doit comparer un nombre, pas une chaîne (`'800' > '480'` serait
    // pourtant vrai lexicographiquement, donc ce test ne distinguerait pas un
    // bug de comparaison de chaînes d'une comparaison numérique correcte —
    // c'est `dureeValide` qui fait le `Number(...)`, vérifié séparément dans
    // `lib/prestation.test.ts`).
    const res = await POST(requete({ ...COMPLETE, duration_minutes: '800' }))
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('accepte le plafond exact de 480 minutes', async () => {
    const res = await POST(requete({ ...COMPLETE, duration_minutes: 480 }))
    expect(res.status).toBe(200)
  })

  it('refuse 481 minutes, juste au-dessus du plafond', async () => {
    const res = await POST(requete({ ...COMPLETE, duration_minutes: 481 }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/services — autres validations', () => {
  it('refuse sans utilisateur authentifié', async () => {
    plan.utilisateur = null
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(401)
    expect(inserts).toHaveLength(0)
  })

  it('refuse si le profil laveur est introuvable', async () => {
    plan.washer = { data: null, error: null }
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(404)
  })

  it('refuse sans type de véhicule', async () => {
    const res = await POST(requete({ ...COMPLETE, vehicle_types: [] }))
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('refuse des champs requis manquants', async () => {
    const res = await POST(requete({ name: '', price: 80, duration_minutes: 90, vehicle_types: ['SUV'] }))
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Plafond de catalogue (grille 2026)
//
// L'offre Découverte est limitée à 3 prestations. C'est une des deux limites
// qui la séparent des offres payantes — l'autre étant les 5 réservations par
// mois. Sans ce contrôle côté serveur, la limite n'existe que sur la page de
// vente.
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/services — plafond de catalogue selon l’offre', () => {
  function decouverte(dejaAuCatalogue: number) {
    plan.washer = { data: { id: 'washer-1', plan: 'decouverte', grandfathered: false }, error: null }
    plan.catalogue = { count: dejaAuCatalogue, error: null }
  }

  it('accepte les trois premières prestations d’un compte Découverte', async () => {
    for (const deja of [0, 1, 2]) {
      inserts.length = 0
      decouverte(deja)
      const res = await POST(requete(COMPLETE))
      expect(res.status, `avec ${deja} prestations déjà`).toBe(200)
      expect(inserts).toHaveLength(1)
    }
  })

  it('refuse la quatrième', async () => {
    decouverte(3)
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/3 prestations/)
    expect(body.error).toMatch(/Starter/)
    expect(body.quota).toEqual({ plafond: 3, utilisees: 3 })
    expect(inserts).toHaveLength(0)
  })

  it('refuse aussi un compte déjà au-dessus du plafond', async () => {
    // Cas d'un laveur qui rétrograde : ses prestations existantes restent,
    // mais il ne peut plus en ajouter.
    decouverte(7)
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(403)
    expect(inserts).toHaveLength(0)
  })

  it('ne plafonne pas les offres payantes', async () => {
    for (const offre of ['starter', 'pro', 'business']) {
      inserts.length = 0
      plan.washer = { data: { id: 'washer-1', plan: offre, grandfathered: false }, error: null }
      plan.catalogue = { count: 250, error: null }
      const res = await POST(requete(COMPLETE))
      expect(res.status, offre).toBe(200)
      expect(inserts).toHaveLength(1)
    }
  })

  it('ne plafonne pas un client historique, même avec « decouverte » en base', async () => {
    plan.washer = { data: { id: 'washer-1', plan: 'decouverte', grandfathered: true }, error: null }
    plan.catalogue = { count: 99, error: null }
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(200)
  })

  it('refuse plutôt que de compter à l’aveugle si la lecture échoue', async () => {
    // Laisser passer reviendrait à supprimer le plafond en silence le jour où
    // cette requête échoue, et personne ne s'en apercevrait.
    plan.washer = { data: { id: 'washer-1', plan: 'decouverte', grandfathered: false }, error: null }
    plan.catalogue = { count: null, error: { message: 'RLS' } }
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(503)
    expect(inserts).toHaveLength(0)
  })

  it('traite un plan inconnu en base comme l’offre gratuite', async () => {
    plan.washer = { data: { id: 'washer-1', plan: 'offre_fantome', grandfathered: false }, error: null }
    plan.catalogue = { count: 3, error: null }
    const res = await POST(requete(COMPLETE))
    expect(res.status).toBe(403)
  })
})
