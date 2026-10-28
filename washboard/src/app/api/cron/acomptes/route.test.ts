import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Cron des acomptes : annulation à l'échéance, rappel au client avant.
//
// La base est simulée en mémoire et APPLIQUE les filtres (eq, is, gt…), lecture comme écriture :
// c'est ce qui permet de vérifier qu'un rappel ne part qu'une fois, et qu'une réservation
// confirmée ou un acompte reçu entre la lecture et l'écriture ne reçoit rien.

type Ligne = Record<string, unknown>

let bookings: Ligne[]
let washers: Ligne[]
/** La colonne `acompte_rappel_le` n'existe pas encore (SQL pas encore exécuté). */
let sansColonneRappel: boolean
/** Ce qui se passe juste avant chaque écriture sur `bookings` (changement concurrent simulé). */
let avantEcriture: ((valeurs: Ligne) => void) | null
/** Erreur renvoyée par Resend pour le rappel (null : envoi réussi). */
let erreurRappel: { name: string; message: string } | null
let tentativesRappel: number

type Filtre = (l: Ligne) => boolean

function builder(table: string) {
  const filtres: Filtre[] = []
  const colonnes: string[] = []
  let valeurs: Ligne | null = null
  let unique = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}

  const lignes = () => (table === 'bookings' ? bookings : washers)
  const date = (v: unknown) => new Date(v as string).getTime()

  b.select = (cols = '*') => { colonnes.push(...cols.split(',').map(c => c.trim())); return b }
  b.update = (v: Ligne) => { valeurs = v; colonnes.push(...Object.keys(v)); return b }
  b.eq = (c: string, v: unknown) => { colonnes.push(c); filtres.push(l => l[c] === v); return b }
  b.is = (c: string, v: unknown) => { colonnes.push(c); filtres.push(l => (l[c] ?? null) === v); return b }
  b.not = (c: string, op: string, v: unknown) => { colonnes.push(c); filtres.push(l => !(op === 'is' && (l[c] ?? null) === v)); return b }
  b.lt = (c: string, v: unknown) => { colonnes.push(c); filtres.push(l => l[c] != null && date(l[c]) < date(v)); return b }
  b.gt = (c: string, v: unknown) => { colonnes.push(c); filtres.push(l => l[c] != null && date(l[c]) > date(v)); return b }
  b.lte = (c: string, v: unknown) => { colonnes.push(c); filtres.push(l => l[c] != null && date(l[c]) <= date(v)); return b }
  b.order = () => b
  b.limit = () => b
  b.maybeSingle = () => { unique = true; return b }

  function reponse() {
    if (table === 'bookings' && sansColonneRappel && colonnes.includes('acompte_rappel_le')) {
      return { data: null, error: { code: '42703', message: 'column bookings.acompte_rappel_le does not exist' } }
    }
    if (valeurs) {
      avantEcriture?.(valeurs)
      const touchees = lignes().filter(l => filtres.every(f => f(l)))
      for (const l of touchees) Object.assign(l, valeurs)
      return { data: touchees.map(l => ({ id: l.id })), error: null }
    }
    const trouvees = lignes().filter(l => filtres.every(f => f(l))).map(l => ({ ...l }))
    return { data: unique ? trouvees[0] ?? null : trouvees, error: null }
  }
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve().then(reponse).then(ok, ko)
  return b
}

vi.mock('@/lib/cronRequest', () => ({
  isAuthorizedCron: () => true,
  parseTestMode: (req: { nextUrl: URL }) => {
    const p = req.nextUrl.searchParams
    return p.get('test') === '1' ? { enabled: true, washerId: p.get('washer') } : { enabled: false }
  },
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}))

const annulations: Ligne[] = []
const rappels: Ligne[] = []
const notifications: Ligne[] = []
vi.mock('@/lib/email', () => ({
  sendAnnulationAcompte: async (p: Ligne) => { annulations.push(p); return { data: { id: 'e' }, error: null } },
  sendRappelAcompte: async (p: Ligne) => {
    tentativesRappel++
    if (erreurRappel) return { data: null, error: erreurRappel }
    rappels.push(p)
    return { data: { id: 'e' }, error: null }
  },
}))
vi.mock('@/lib/push', () => ({
  notifierLaveur: async (_id: string, p: Ligne) => { notifications.push(p) },
}))

const { GET } = await import('./route')

const H = 3600_000
const dans = (h: number) => new Date(Date.now() + h * H).toISOString()
const appel = async (query = '') => (await GET({ nextUrl: new URL(`https://www.washboard.fr/api/cron/acomptes${query}`) } as never)).json()

const REGLAGES = {
  actif: true, type: 'montant', valeur: 12, delai_heures: 24, remboursable: false, remboursement_heures: null,
  liens: { paypal: 'https://paypal.me/malolavage' },
  virement: { titulaire: 'Malo Durand', iban: 'FR7630006000011234567890189' },
  wero: { telephone: '0612345678', lien: null },
}

/** Réservation de 24 h dont l'échéance tombe dans 3 h : le rappel (6 h avant) est dû. */
const aRappeler = (extra: Ligne = {}): Ligne => ({
  id: '6f1c2a4e-0000-4000-8000-00000000000a', washer_id: 'w1', client_name: 'Julie M.', client_email: 'julie@example.fr',
  scheduled_at: dans(48), created_at: dans(-21), status: 'pending', acompte_statut: 'en_attente',
  acompte_montant: 12, acompte_echeance: dans(3), acompte_rappel_le: null, ...extra,
})
/** Réservation dont l'échéance est passée : à annuler. */
const expiree = (extra: Ligne = {}): Ligne => ({
  ...aRappeler(), id: 'b-expiree', created_at: dans(-25), acompte_echeance: dans(-1), ...extra,
})

beforeEach(() => {
  bookings = []
  washers = [{ id: 'w1', name: 'Malo Lavage', slug: 'malo-lavage', acompte: REGLAGES }]
  sansColonneRappel = false
  avantEcriture = null
  erreurRappel = null
  tentativesRappel = 0
  annulations.length = 0
  rappels.length = 0
  notifications.length = 0
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('GET /api/cron/acomptes — rappel avant l’échéance', () => {
  it('envoie le rappel une seule fois, avec les moyens de paiement actuels du laveur', async () => {
    bookings = [aRappeler()]
    const premier = await appel()
    expect(premier).toMatchObject({ ok: true, annulees: 0, rappels: 1, echecs: 0 })
    expect(bookings[0].acompte_rappel_le).toEqual(expect.any(String))

    const second = await appel()
    expect(second.rappels).toBe(0)
    expect(rappels).toHaveLength(1)

    const r = rappels[0] as { to: string; washerName: string; echeance: string; acompte: { montant: number; liens: { url: string }[]; virement: { reference: string }; wero: { telephone: string } } }
    expect(r.to).toBe('julie@example.fr')
    expect(r.washerName).toBe('Malo Lavage')
    expect(r.echeance).toBe(bookings[0].acompte_echeance)
    expect(r.acompte.montant).toBe(12)
    // Même logique PayPal que « Demande reçue » : le montant exact dans le lien.
    expect(r.acompte.liens[0].url).toBe('https://paypal.me/malolavage/12.00EUR')
    expect(r.acompte.virement.reference).toBe('WB-6F1C2A4E')
    expect(r.acompte.wero.telephone).toBe('06 12 34 56 78')
    // Le laveur n'est pas prévenu d'un simple rappel.
    expect(notifications).toHaveLength(0)
  })

  it('n’envoie rien avant l’heure du rappel', async () => {
    bookings = [aRappeler({ created_at: dans(-1), acompte_echeance: dans(23) })]
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(bookings[0].acompte_rappel_le).toBeNull()
  })

  it('aucun rappel sans email client', async () => {
    bookings = [aRappeler({ client_email: null }), aRappeler({ id: 'b2', client_email: '  ' })]
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
  })

  it('aucun rappel pour une réservation confirmée ou un acompte reçu', async () => {
    bookings = [aRappeler({ status: 'confirmed' }), aRappeler({ id: 'b2', acompte_statut: 'recu' })]
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
  })

  it('aucun rappel si l’acompte est noté reçu entre la lecture et l’écriture', async () => {
    bookings = [aRappeler()]
    avantEcriture = () => { bookings[0].acompte_statut = 'recu' }
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(bookings[0].acompte_rappel_le).toBeNull()
  })

  it('pas encore l’heure : réservation lue (échéance sous 12 h) mais rappel pas dû', async () => {
    // Délai de 12 h, rappel 3 h avant : à 11 h de l'échéance, rien ne part.
    bookings = [aRappeler({ created_at: dans(-1), acompte_echeance: dans(11) })]
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(bookings[0].acompte_rappel_le).toBeNull()
  })

  it('passage concurrent : un rappel déjà marqué entre la lecture et l’écriture ne repart pas', async () => {
    bookings = [aRappeler()]
    const autrePassage = dans(-0.01)
    avantEcriture = (v) => { if ('acompte_rappel_le' in v) bookings[0].acompte_rappel_le = autrePassage }
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(bookings[0].acompte_rappel_le).toBe(autrePassage)
  })

  it('rendez-vous passé : aucun rappel, écarté dès la lecture', async () => {
    bookings = [aRappeler({ scheduled_at: dans(-1) })]
    let ecritures = 0
    avantEcriture = () => { ecritures++ }
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(ecritures).toBe(0)
  })

  it('rendez-vous passé entre la lecture et l’écriture : aucun rappel', async () => {
    bookings = [aRappeler()]
    avantEcriture = () => { bookings[0].scheduled_at = dans(-1) }
    expect((await appel()).rappels).toBe(0)
    expect(rappels).toHaveLength(0)
    expect(bookings[0].acompte_rappel_le).toBeNull()
  })

  it('un envoi raté n’est pas compté comme envoyé : le passage suivant réessaie', async () => {
    bookings = [aRappeler()]
    erreurRappel = { name: 'application_error', message: 'Resend indisponible' }
    const rate = await appel()
    expect(rate).toMatchObject({ ok: false, rappels: 0, echecs: 1 })
    expect(bookings[0].acompte_rappel_le).toBeNull()

    erreurRappel = null
    expect((await appel()).rappels).toBe(1)
    expect(rappels).toHaveLength(1)
  })

  it('adresse refusée par Resend : la marque reste, pas de nouvel essai au passage suivant', async () => {
    bookings = [aRappeler()]
    erreurRappel = { name: 'validation_error', message: 'Invalid `to` field.' }
    expect(await appel()).toMatchObject({ ok: false, rappels: 0, echecs: 1 })
    expect(bookings[0].acompte_rappel_le).toEqual(expect.any(String))

    expect(await appel()).toMatchObject({ ok: true, rappels: 0, echecs: 0 })
    expect(tentativesRappel).toBe(1)
  })

  it('colonne absente : l’annulation fonctionne, aucun rappel', async () => {
    sansColonneRappel = true
    bookings = [expiree(), aRappeler()]
    const body = await appel()
    expect(body).toMatchObject({ ok: true, annulees: 1, rappels: 0, rappelsEnAttente: true })
    expect(bookings[0].status).toBe('cancelled')
    expect(annulations).toHaveLength(1)
    expect(notifications).toHaveLength(1)
    expect(rappels).toHaveLength(0)
  })

  it('colonne absente : l’arrêt des rappels laisse une trace dans les logs', async () => {
    sansColonneRappel = true
    bookings = [aRappeler()]
    await appel()
    const logs = vi.mocked(console.error).mock.calls.map(c => JSON.parse(c[0] as string) as { level: string; event: string })
    expect(logs).toContainEqual(expect.objectContaining({ level: 'warn', event: 'cron.acomptes.rappel_migration_en_attente' }))
  })

  it('mode test : le rappel ne part que pour la réservation désignée, sans attendre son heure, une seule fois', async () => {
    washers.push({ id: 'w2', name: 'Autre', slug: 'autre', acompte: REGLAGES })
    bookings = [
      aRappeler({ created_at: dans(-1), acompte_echeance: dans(23) }),
      aRappeler({ id: 'b-meme-laveur' }),
      aRappeler({ id: 'b-autre', washer_id: 'w2' }),
    ]
    const cible = `?test=1&washer=w1&booking=${bookings[0].id}`
    expect((await appel(cible)).rappels).toBe(1)
    expect((await appel(cible)).rappels).toBe(0)
    expect(rappels).toHaveLength(1)
    expect(bookings[1].acompte_rappel_le).toBeNull()
    expect(bookings[2].acompte_rappel_le).toBeNull()
  })

  it('mode test sans réservation désignée : annulation du laveur seulement, aucun rappel', async () => {
    bookings = [expiree(), aRappeler()]
    expect(await appel('?test=1&washer=w1')).toMatchObject({ annulees: 1, rappels: 0 })
    expect(rappels).toHaveLength(0)
    expect(bookings[1].acompte_rappel_le).toBeNull()
  })
})

describe('GET /api/cron/acomptes — email d’annulation', () => {
  it('donne le lien vers la page de réservation du laveur', async () => {
    bookings = [expiree()]
    expect((await appel()).annulees).toBe(1)
    expect(annulations[0].lienReservation).toBe('https://www.washboard.fr/book/malo-lavage')
  })

  it('sans slug, pas de lien', async () => {
    washers[0].slug = null
    bookings = [expiree()]
    await appel()
    expect(annulations).toHaveLength(1)
    expect(annulations[0].lienReservation).toBeNull()
  })

  it('n’annule pas une réservation confirmée entre la lecture et l’écriture', async () => {
    bookings = [expiree()]
    avantEcriture = () => { bookings[0].status = 'confirmed' }
    expect((await appel()).annulees).toBe(0)
    expect(annulations).toHaveLength(0)
  })
})
