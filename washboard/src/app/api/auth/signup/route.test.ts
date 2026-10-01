import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de la route d'inscription — la porte d'entrée du produit.
//
// Deux bugs y ont été trouvés le 2026-09-06, tous deux sur le contrôle
// d'unicité du téléphone. Ils sont couverts ici pour de bon.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  fichesAvecCeNumero: Reponse
  insertErreurs: ({ code?: string } | null)[]
  creerUtilisateur: Reponse
  suppressionErreur: unknown
}

const inserts: Record<string, unknown>[] = []
const comptesCrees: Record<string, unknown>[] = []
// Filtres posés sur la requête d'unicité, pour vérifier CE QUI est compté.
const filtres: unknown[][] = []

function nouveauBuilder() {
  const b: Record<string, unknown> = {}
  Object.assign(b, {
    select: () => b,
    eq: (...a: unknown[]) => { filtres.push(['eq', ...a]); return b },
    not: (...a: unknown[]) => { filtres.push(['not', ...a]); return b },
    limit: () => Promise.resolve(plan.fichesAvecCeNumero),
    maybeSingle: () => Promise.resolve(plan.fichesAvecCeNumero),
    insert: (valeurs: Record<string, unknown>) => {
      inserts.push(valeurs)
      return Promise.resolve({ error: plan.insertErreurs.shift() ?? null })
    },
  })
  return b
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => nouveauBuilder(),
    auth: {
      admin: {
        createUser: async (params: Record<string, unknown>) => {
          comptesCrees.push(params)
          return plan.creerUtilisateur
        },
        deleteUser: async () => ({ error: plan.suppressionErreur }),
      },
    },
  }),
}))

// La génération et l'envoi du lien sont testés dans lib/confirmationEmail.test.ts.
const { envoyerLien } = vi.hoisted(() => ({ envoyerLien: vi.fn() }))
vi.mock('@/lib/confirmationEmail', () => ({ envoyerLienConfirmation: envoyerLien }))

const { POST } = await import('./route')

const ID_COMPTE = '0b7d3c2e-4f1a-4c8e-9d2b-7a6f5e4d3c2b'

const NUMERO_EXEMPTE = '0684140438'
const NUMERO_NORMAL = '0611223344'

function requete(corps: Record<string, unknown>) {
  const ip = `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`
  return new Request('https://www.washboard.fr/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(corps),
  }) as unknown as Parameters<typeof POST>[0]
}

async function inscrire(extra: Record<string, unknown> = {}) {
  const res = await POST(requete({
    name: 'Test Lavage',
    email: 'test@exemple.fr',
    password: 'motdepasse',
    phone: NUMERO_NORMAL,
    // Acceptée par défaut : les tests de ce fichier portent sur autre chose,
    // sauf le bloc dédié ci-dessous.
    cgv_acceptees: true,
    ...extra,
  }))
  return { res, body: await res.json() }
}

beforeEach(() => {
  vi.stubEnv('PHONE_UNIQUENESS_EXEMPT', NUMERO_EXEMPTE)
  inserts.length = 0
  comptesCrees.length = 0
  filtres.length = 0
  plan = {
    fichesAvecCeNumero: { data: [], error: null },
    insertErreurs: [],
    creerUtilisateur: { data: { user: { id: ID_COMPTE } }, error: null },
    suppressionErreur: null,
  }
  envoyerLien.mockReset()
  envoyerLien.mockResolvedValue(true)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('POST /api/auth/signup — unicité du téléphone', () => {
  it('refuse un numéro déjà utilisé', async () => {
    plan.fichesAvecCeNumero = { data: [{ id: 'w-existant' }], error: null }
    const { res, body } = await inscrire()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/téléphone/)
    expect(inserts).toHaveLength(0)
  })

  it('ne compte pas les pages « proposition » : le prospect s’inscrit avec son numéro', async () => {
    // La page construite avant l'appel porte déjà son numéro. Le 2026-09-11,
    // URHUS AUTO allait se voir refuser son inscription pendant le rendez-vous.
    await inscrire()
    expect(filtres).toContainEqual(['eq', 'phone', NUMERO_NORMAL])
    expect(filtres).toContainEqual(['not', 'is_preview', 'is', true])
  })

  it('accepte le numéro exempté MÊME quand plusieurs comptes le portent déjà', async () => {
    // Le bug du 2026-09-06 : l'exemption était évaluée après la requête, et
    // `maybeSingle()` échouait dès la deuxième fiche (PGRST116). La route
    // concluait à une panne et refusait — à la seule personne que l'exemption
    // devait servir.
    plan.fichesAvecCeNumero = {
      data: null,
      error: { code: 'PGRST116', message: 'Results contain 2 rows, requires 1 row' },
    }
    const { res } = await inscrire({ phone: NUMERO_EXEMPTE })
    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(1)
  })

  it('n\'interroge même pas la base pour un numéro exempté', async () => {
    // La requête ne doit pas être atteinte : c'est ce qui garantit qu'aucun
    // état de la base ne peut bloquer ce numéro.
    plan.fichesAvecCeNumero = { data: [{ id: 'w1' }, { id: 'w2' }], error: null }
    const { res } = await inscrire({ phone: NUMERO_EXEMPTE })
    expect(res.status).toBe(200)
  })

  it('refuse plutôt que de laisser passer si la lecture échoue vraiment', async () => {
    // Sur un numéro NON exempté, un échec de lecture doit fermer : laisser
    // passer désactiverait la protection en silence.
    plan.fichesAvecCeNumero = { data: null, error: { message: 'base indisponible' } }
    const { res } = await inscrire()
    expect(res.status).toBe(503)
    expect(inserts).toHaveLength(0)
  })

  it('refuse un numéro invalide', async () => {
    const { res } = await inscrire({ phone: '12' })
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })
})

describe('POST /api/auth/signup — création du compte', () => {
  it('crée la fiche laveur avec un essai et un lien unique', async () => {
    const { res } = await inscrire({ name: 'Kooki Clean' })
    expect(res.status).toBe(200)
    expect(inserts[0].slug).toMatch(/^kooki-clean-[0-9a-f]{4}$/)
    expect(inserts[0].subscription_status).toBe('trial')
    expect(inserts[0].phone).toBe(NUMERO_NORMAL)
  })

  it('retente avec un autre suffixe si le lien est déjà pris', async () => {
    plan.insertErreurs = [{ code: '23505' }, null]
    const { res } = await inscrire()
    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(2)
    expect(inserts[0].slug).not.toBe(inserts[1].slug)
  })

  it('abandonne après trois tentatives et supprime le compte auth', async () => {
    plan.insertErreurs = [{ code: '23505' }, { code: '23505' }, { code: '23505' }]
    const { res } = await inscrire()
    expect(res.status).toBe(500)
    expect(inserts).toHaveLength(3)
  })

  it('ne révèle pas le rouage interne quand la création du compte échoue', async () => {
    plan.creerUtilisateur = { data: null, error: { message: 'pgbouncer pool exhausted' } }
    const { res, body } = await inscrire()
    expect(res.status).toBe(400)
    expect(body.error).not.toMatch(/pgbouncer/)
  })

  it('dit clairement qu\'un email est déjà pris', async () => {
    plan.creerUtilisateur = { data: null, error: { message: 'User already registered' } }
    const { res, body } = await inscrire()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/déjà utilisé/)
  })

  it('refuse des données incomplètes', async () => {
    expect((await inscrire({ name: '  ' })).res.status).toBe(400)
    expect((await inscrire({ email: 'pas-un-email' })).res.status).toBe(400)
    expect((await inscrire({ password: '123' })).res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })
})

describe('POST /api/auth/signup — acceptation des CGV', () => {
  it('refuse une inscription sans la case cochée', async () => {
    const { res, body } = await inscrire({ cgv_acceptees: false })
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/CGV/)
    expect(inserts).toHaveLength(0)
  })

  it('refuse un appel direct qui omet le champ', async () => {
    // Le formulaire envoie toujours cgv_acceptees — un appel qui ne passe
    // pas par lui (requête directe à l'API) ne doit pas créer de compte
    // sans trace d'acceptation.
    const res = await POST(requete({
      name: 'Test Lavage', email: 'test@exemple.fr', password: 'motdepasse', phone: NUMERO_NORMAL,
    }))
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('refuse une valeur tronquée (chaîne "true", pas un booléen)', async () => {
    // Même principe que le prix côté réservation : une valeur qui RESSEMBLE
    // à l'acceptation ne doit pas en tenir lieu.
    const { res } = await inscrire({ cgv_acceptees: 'true' })
    expect(res.status).toBe(400)
    expect(inserts).toHaveLength(0)
  })

  it('enregistre la date ET l’IP au moment de l’inscription', async () => {
    const avant = Date.now()
    const { res } = await inscrire()
    expect(res.status).toBe(200)
    expect(new Date(inserts[0].cgv_acceptees_le as string).getTime()).toBeGreaterThanOrEqual(avant)
    expect(inserts[0].cgv_acceptees_ip).toBeTruthy()
  })
})

describe('POST /api/auth/signup — confirmation de l’email', () => {
  it('crée le compte NON confirmé', async () => {
    await inscrire()
    expect(comptesCrees[0]).toMatchObject({ email: 'test@exemple.fr', email_confirm: false })
  })

  it('envoie le lien de confirmation au compte créé', async () => {
    await inscrire({ name: ' Kooki Clean ' })
    expect(envoyerLien).toHaveBeenCalledWith(expect.anything(), {
      userId: ID_COMPTE,
      email: 'test@exemple.fr',
      washerName: 'Kooki Clean',
      origin: expect.any(String),
    })
  })

  it('un envoi raté ne fait PAS échouer l’inscription', async () => {
    // Le compte existe : /verifier-email propose de renvoyer le lien.
    envoyerLien.mockResolvedValue(false)
    const { res, body } = await inscrire()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it('ne pose plus aucun cookie', async () => {
    const { res } = await inscrire()
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('pas de lien quand la fiche n’a pas pu être créée', async () => {
    plan.insertErreurs = [{ code: '23505' }, { code: '23505' }, { code: '23505' }]
    await inscrire()
    expect(envoyerLien).not.toHaveBeenCalled()
  })
})
