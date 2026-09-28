import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de la route de création de réservation — la seule porte d'entrée
// publique en écriture du produit, et donc celle qui concentre les correctifs
// de l'audit du 2026-09-05 : prix recalculé, prestation cloisonnée, date et
// créneau contrôlés, zone respectée, capacité vérifiée sans course.
//
// La couche Supabase est remplacée par un faux client : on vérifie ce que la
// route DÉCIDE, pas ce que la base répond.

const rpcAppels: { nom: string; args: Record<string, unknown> }[] = []

type Reponse = { data?: unknown; error?: unknown; count?: number }

let plan: {
  tables: Record<string, Reponse>
  countJour: number
  /** Réservations déjà prises ce mois-ci (quota de l'offre). */
  countMois: number
  /** Panne de lecture sur le comptage mensuel. */
  erreurCountMois: unknown
  rpc: Reponse
  utilisateur: unknown
}

function nouveauBuilder(table: string) {
  let head = false
  // Les deux comptages de cette route portent sur la même table. Celui du
  // quota mensuel se distingue par son `.neq('status', 'cancelled')` : un
  // rendez-vous annulé ne consomme pas le quota du laveur, alors que le
  // plafond anti-spam du jour compte tout.
  let mensuel = false
  const b: Record<string, unknown> = {}
  const self = () => b
  Object.assign(b, {
    select: (_cols?: string, opts?: { head?: boolean }) => { head = !!opts?.head; return b },
    eq: self, gte: self, lte: self, in: self, order: self, limit: self,
    neq: () => { mensuel = true; return b },
    single:      () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    maybeSingle: () => Promise.resolve(plan.tables[table] ?? { data: null, error: null }),
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(
        head
          ? (mensuel
              ? { count: plan.countMois, error: plan.erreurCountMois }
              : { count: plan.countJour, error: null })
          : (plan.tables[table] ?? { data: [], error: null }),
      ).then(ok, ko),
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  rpc: (nom: string, args: Record<string, unknown>) => {
    rpcAppels.push({ nom, args })
    return Promise.resolve(plan.rpc)
  },
  auth: {
    getUser: async () => ({ data: { user: plan.utilisateur } }),
    admin: { getUserById: async () => ({ data: { user: { email: 'laveur@test.fr' } } }) },
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxClient }))
vi.mock('@/lib/email', () => ({
  sendBookingRequest: vi.fn(async () => {}),
  sendWasherNotification: vi.fn(async () => {}),
  sendWasherBookingLocked: vi.fn(async () => {}),
}))
vi.mock('@/lib/push', () => ({ notifierLaveur: vi.fn(async () => {}) }))
vi.mock('@/lib/travelFee', () => ({ computeTravelFee: vi.fn(async () => 0) }))
vi.mock('@/lib/googleMaps', () => ({ getMapsApiKey: () => 'cle-test' }))

// Recuperes apres les `vi.mock` : ce que le laveur RECOIT est au coeur du
// verrouillage, un test qui ne lirait que le code HTTP passerait a cote.
const { notifierLaveur } = vi.mocked(await import('@/lib/push'))
const { sendWasherNotification, sendWasherBookingLocked } = vi.mocked(await import('@/lib/email'))

const { RETOUR_GRATUIT_POUR_COMPTES_CREES_DES } = await import('@/lib/plan')
const { POST } = await import('./route')

// Vendredi 11 septembre 2026, 08:00 UTC = 10:00 à Paris (heure d'été).
const CRENEAU = '2026-09-11T08:00:00Z'
const WASHER  = '11111111-1111-4111-8111-111111111111'
const SERVICE = '22222222-2222-4222-8222-222222222222'

const SERVICE_DEFAUT = {
  name: 'Lavage complet', price: 60, vehicle_price_overrides: null,
  duration_minutes: 60, addons: [], washer_id: WASHER,
}

function corps(extra: Record<string, unknown> = {}) {
  return {
    washer_id: WASHER, service_id: SERVICE,
    vehicle_type: 'citadine', vehicle_count: 1,
    address: '3 rue Colbert, 89000 Auxerre',
    scheduled_at: CRENEAU,
    client_name: 'Jean Test', client_email: 'jean@test.fr', client_phone: '0612345678',
    ...extra,
  }
}

function requete(body: Record<string, unknown>) {
  const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`
  return new Request('https://www.washboard.fr/api/bookings', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  rpcAppels.length = 0
  notifierLaveur.mockClear()
  sendWasherNotification.mockClear()
  sendWasherBookingLocked.mockClear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-09-09T09:00:00Z'))
  plan = {
    countJour: 0,
    countMois: 0,
    erreurCountMois: null,
    utilisateur: null,
    rpc: { data: { id: 'ok' }, error: null },
    tables: {
      washers: { data: {
        name: 'Kooki Clean', phone: '0600000000', user_id: 'user-1',
        google_refresh_token: null, team_size: 1,
        subscription_status: 'active', trial_ends_at: null, subscription_ends_at: null,
        plan: 'pro', grandfathered: false, zone_config: { enabled: false },
        created_at: '2026-01-15T00:00:00.000Z',
      }, error: null },
      services: { data: SERVICE_DEFAUT, error: null },
      unavailabilities: { data: [], error: null },
      availabilities:   { data: [{ day_of_week: 5, start_time: '09:00', end_time: '18:00' }], error: null },
      bookings: { data: [], error: null },
    },
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

async function poster(extra: Record<string, unknown> = {}) {
  const res = await POST(requete(corps(extra)))
  return { res, body: await res.json() }
}

function avecWasher(champs: Record<string, unknown>) {
  plan.tables.washers = {
    data: { ...(plan.tables.washers.data as Record<string, unknown>), ...champs },
    error: null,
  }
}

describe('POST /api/bookings — chemin nominal', () => {
  it('accepte une réservation valide et la confie à la fonction atomique', async () => {
    const { res } = await poster()
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(1)
    expect(rpcAppels[0].nom).toBe('create_booking_atomic')
  })

  it('transmet la fin du créneau, sans quoi la base ne peut rien vérifier', async () => {
    await poster()
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    // 60 minutes de prestation à partir de 08:00 UTC.
    expect(reserv.ends_at).toBe('2026-09-11T09:00:00.000Z')
  })

  it('multiplie la durée par le nombre de véhicules', async () => {
    await poster({ vehicle_count: 3 })
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.ends_at).toBe('2026-09-11T11:00:00.000Z')
  })
})

describe('POST /api/bookings — le prix ne vient jamais du navigateur (H1)', () => {
  it('ignore un prix soufflé par le client', async () => {
    // Le cas signalé : `booked_price: 0.01` était enregistré tel quel, reçu
    // PDF et comptabilité du laveur compris.
    await poster({ booked_price: 0.01 })
    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.booked_price).toBe(60)
  })

  it('ignore une option inventée et retarife celles du catalogue', async () => {
    plan.tables.services = { data: {
      ...SERVICE_DEFAUT,
      addons: [{ id: 'cire', label: 'Cire', price: 15, category: 'exterieur' }],
    }, error: null }

    await poster({ selected_addons: [
      { id: 'cire',  label: 'Cire',   price: 1,    category: 'exterieur' },
      { id: 'bidon', label: 'Cadeau', price: -500, category: 'exterieur' },
    ] })

    const reserv = rpcAppels[0].args.p_booking as Record<string, unknown>
    expect(reserv.booked_price).toBe(75) // 60 + 15, l'option inventée vaut 0
  })
})

describe('POST /api/bookings — page « proposition »', () => {
  it('refuse toute réservation sur une page d\'aperçu', async () => {
    // Ces pages sont construites avant que le laveur ait un compte. Accepter
    // une réservation l'engagerait sur un rendez-vous qu'il n'a jamais accepté.
    avecWasher({ is_preview: true })
    const { res, body } = await poster()
    expect(res.status).toBe(403)
    expect(body.error).toMatch(/aperçu/)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse même au laveur lui-même', async () => {
    // Le bouton n'existe pas dans l'interface, mais la route reste appelable
    // directement : le refus doit tenir sans dépendre du navigateur.
    plan.utilisateur = { id: 'user-1' }
    avecWasher({ is_preview: true })
    const { res } = await poster()
    expect(res.status).toBe(403)
    expect(rpcAppels).toHaveLength(0)
  })

  it('laisse passer une page normale', async () => {
    avecWasher({ is_preview: false })
    expect((await poster()).res.status).toBe(201)
  })
})

describe('POST /api/bookings — cloisonnement entre laveurs (H2)', () => {
  it('refuse une prestation qui appartient à un autre laveur', async () => {
    plan.tables.services = { data: { ...SERVICE_DEFAUT, washer_id: 'un-autre-laveur' }, error: null }
    const { res, body } = await poster()
    expect(res.status).toBe(404)
    expect(body.error).toBe('Prestation introuvable')
    expect(rpcAppels).toHaveLength(0)
  })
})

describe('POST /api/bookings — le moment demandé (H3)', () => {
  it('refuse une date déjà passée', async () => {
    const { res } = await poster({ scheduled_at: '2020-06-01T08:00:00Z' })
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse une date au-delà de l horizon de réservation', async () => {
    const { res } = await poster({ scheduled_at: '2030-06-01T08:00:00Z' })
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un créneau hors des horaires du laveur', async () => {
    // 01:00 UTC = 03:00 à Paris, un vendredi : jamais proposé par l'interface.
    const { res, body } = await poster({ scheduled_at: '2026-09-11T01:00:00Z' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/horaires/)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un créneau un jour de fermeture', async () => {
    plan.tables.availabilities = { data: [{ day_of_week: 1, start_time: '09:00', end_time: '18:00' }], error: null }
    const { res } = await poster()
    expect(res.status).toBe(409)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse une prestation qui déborderait après la fermeture', async () => {
    plan.tables.services = { data: { ...SERVICE_DEFAUT, duration_minutes: 600 }, error: null }
    const { res } = await poster()
    expect(res.status).toBe(409)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse plutôt que de réserver à l aveugle si les horaires sont illisibles', async () => {
    plan.tables.availabilities = { data: null, error: { message: 'GRANT manquant' } }
    const { res } = await poster()
    expect(res.status).toBe(503)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse plutôt que de réserver à l aveugle si les congés sont illisibles', async () => {
    plan.tables.unavailabilities = { data: null, error: { message: 'GRANT manquant' } }
    const { res } = await poster()
    expect(res.status).toBe(503)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un jour de congé complet, avec un message qui l explique', async () => {
    plan.tables.unavailabilities = { data: [
      { start_date: '2026-09-10', end_date: '2026-09-12', team_members_off: 1 },
    ], error: null }
    const { res, body } = await poster()
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/absent/)
    expect(rpcAppels).toHaveLength(0)
  })
})

describe('POST /api/bookings — zone desservie (H3)', () => {
  it('refuse une adresse hors zone', async () => {
    avecWasher({ zone_config: { enabled: true, type: 'departments', departments: ['89'] } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ features: [{ properties: { context: '13, Bouches-du-Rhône, PACA' } }] }),
    } as unknown as Response)))

    const { res, body } = await poster({ address: '1 rue X, 13001 Marseille' })
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/zone/)
    expect(rpcAppels).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it('laisse passer une adresse dans la zone', async () => {
    avecWasher({ zone_config: { enabled: true, type: 'departments', departments: ['89'] } })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ features: [{ properties: { context: '89, Yonne, Bourgogne' } }] }),
    } as unknown as Response)))

    const { res } = await poster()
    expect(res.status).toBe(201)
    vi.unstubAllGlobals()
  })
})

describe('POST /api/bookings — capacité et concurrence (H4)', () => {
  it('transmet la capacité du jour à la fonction atomique', async () => {
    avecWasher({ team_size: 3 })
    await poster()
    expect(rpcAppels[0].args.p_capacity).toBe(3)
  })

  it('déduit les absences de la capacité du jour', async () => {
    avecWasher({ team_size: 3 })
    plan.tables.unavailabilities = { data: [
      { start_date: '2026-09-11', end_date: '2026-09-11', team_members_off: 2 },
    ], error: null }
    await poster()
    expect(rpcAppels[0].args.p_capacity).toBe(1)
  })

  it('traduit un créneau plein en refus clair, pas en erreur serveur', async () => {
    plan.rpc = { data: null, error: { message: 'SLOT_TAKEN' } }
    const { res, body } = await poster()
    expect(res.status).toBe(409)
    expect(body.error).toMatch(/réservé/)
  })

  it('remonte une vraie panne d écriture comme une erreur serveur', async () => {
    plan.rpc = { data: null, error: { message: 'connexion perdue' } }
    const { res } = await poster()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/bookings — garde-fous existants', () => {
  it('refuse un abonnement expiré au-delà du délai de grâce', async () => {
    avecWasher({ subscription_status: 'past_due', subscription_ends_at: '2026-01-01T00:00:00Z' })
    const { res } = await poster()
    expect(res.status).toBe(403)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse au-delà du plafond quotidien du laveur', async () => {
    plan.countJour = 60
    const { res } = await poster()
    expect(res.status).toBe(429)
    expect(rpcAppels).toHaveLength(0)
  })

  it('avale silencieusement une soumission de robot', async () => {
    const { res } = await poster({ hp: 'rempli par un bot' })
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(0)
  })

  it('refuse un corps de requête invalide', async () => {
    const res = await POST(requete({ washer_id: 'pas-un-uuid' }))
    expect(res.status).toBe(400)
    expect(rpcAppels).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Quota mensuel de réservations (grille 2026)
//
// C'est LA limite qui sépare les offres : Découverte 5, Starter 15, Pro et
// Business sans plafond. Elle est vérifiée ici, côté serveur, parce que la
// page de réservation est publique — le formulaire du navigateur ne protège
// rien du tout.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Quota mensuel : au-delà, on accepte quand même (grille 2026)
//
// Le refus faisait payer au client la limite d'un logiciel qu'il n'a pas
// choisi : il repartait, et le laveur perdait un lavage sans savoir qu'on
// l'avait sollicité. Désormais la réservation est enregistrée ; ce qui est
// plafonné, c'est ce que le laveur en VOIT.
//
// Ces tests portent donc sur deux choses : la réservation existe bel et bien,
// et le laveur est prévenu SANS rien apprendre.
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/bookings — au-delà du quota mensuel', () => {
  describe('offre Découverte — 5 par mois', () => {
    beforeEach(() => { avecWasher({ plan: 'decouverte' }) })

    it('accepte la cinquième réservation du mois', async () => {
      plan.countMois = 4
      const { res } = await poster()
      expect(res.status).toBe(201)
      expect(rpcAppels).toHaveLength(1)
    })

    it('ACCEPTE AUSSI la sixième — le client ne doit jamais être refusé', async () => {
      plan.countMois = 5
      const { res } = await poster()
      expect(res.status).toBe(201)
      expect(rpcAppels).toHaveLength(1)
    })

    it('accepte la centième', async () => {
      plan.countMois = 99
      expect((await poster()).res.status).toBe(201)
    })

    it('ne dit rien au client de la situation du prestataire', async () => {
      // Le visiteur d'une page publique n'a pas à savoir sur quelle offre est
      // le laveur : ce serait une information commerciale sur son dos.
      plan.countMois = 5
      const { body } = await poster()
      expect(JSON.stringify(body)).not.toMatch(/offre|abonnement|quota|bloqu/i)
    })

    it('accepte aussi une saisie manuelle du laveur', async () => {
      plan.countMois = 5
      plan.utilisateur = { id: 'user-1' }   // le propriétaire de la fiche
      const { res } = await poster()
      expect(res.status).toBe(201)
    })
  })

  describe('ce que le laveur apprend', () => {
    it('nomme le client mais tait l’heure, au-delà du quota', async () => {
      // Le nom rend la demande réelle ; l'heure permettrait d'honorer le
      // rendez-vous sans jamais payer — il suffirait d'attendre sur place.
      avecWasher({ plan: 'decouverte' })
      plan.countMois = 5
      await poster()
      const envoi = notifierLaveur.mock.calls.at(-1)![1]
      expect(envoi.body).toMatch(/Jean Test/)
      expect(envoi.body).toMatch(/vendredi 11 septembre/)
      expect(envoi.body).not.toMatch(/\d{1,2}:\d{2}/)
      expect(envoi.body).not.toMatch(/Auxerre|Colbert/)
      expect(envoi.url).toBe('/dashboard/abonnement')
    })

    it('reçoit une notification COMPLÈTE dans le quota', async () => {
      avecWasher({ plan: 'decouverte' })
      plan.countMois = 2
      await poster()
      const envoi = notifierLaveur.mock.calls.at(-1)![1]
      expect(envoi.body).toMatch(/Jean Test/)
      expect(envoi.url).toMatch(/calendrier/)
    })

    it('reçoit un email dédié, sans adresse ni téléphone', async () => {
      // Gabarit à part : l'email complet compose le téléphone, l'adresse et le
      // montant à une dizaine d'endroits, un seul oubli révélerait tout.
      avecWasher({ plan: 'decouverte' })
      plan.countMois = 5
      await poster()
      expect(sendWasherNotification).not.toHaveBeenCalled()
      const envoi = sendWasherBookingLocked.mock.calls.at(-1)![0]
      expect(envoi.clientName).toBe('Jean Test')
      expect(Object.keys(envoi)).not.toContain('clientPhone')
      expect(Object.keys(envoi)).not.toContain('address')
    })

    it('reçoit un email COMPLET dans le quota', async () => {
      avecWasher({ plan: 'decouverte' })
      plan.countMois = 0
      await poster()
      const envoi = sendWasherNotification.mock.calls.at(-1)![0]
      expect(envoi.clientName).toBe('Jean Test')
      expect(envoi.clientPhone).toBe('0612345678')
    })
  })

  describe('offre Starter — 15 par mois', () => {
    beforeEach(() => { avecWasher({ plan: 'starter' }) })

    it('accepte la quinzième, en clair', async () => {
      plan.countMois = 14
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toMatch(/calendrier/)
    })

    it('accepte la seizième, masquée', async () => {
      plan.countMois = 15
      const { res } = await poster()
      expect(res.status).toBe(201)
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toBe('/dashboard/abonnement')
    })

    it('n’est pas plafonné à 30 — c’est bien 15 qui a été retenu', async () => {
      plan.countMois = 20
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toBe('/dashboard/abonnement')
    })
  })

  describe('offres sans plafond', () => {
    it('ne masque jamais rien au Pro ni au Business', async () => {
      for (const offre of ['pro', 'business']) {
        avecWasher({ plan: offre })
        plan.countMois = 5000
        await poster()
        expect(notifierLaveur.mock.calls.at(-1)![1].url, offre).toMatch(/calendrier/)
      }
    })

    it('ne masque rien à un client historique avec « decouverte » en base', async () => {
      avecWasher({ plan: 'decouverte', grandfathered: true })
      plan.countMois = 5000
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toMatch(/calendrier/)
    })

    it('traite un ancien plan « essentiel » comme le Pro', async () => {
      avecWasher({ plan: 'essentiel' })
      plan.countMois = 5000
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toMatch(/calendrier/)
    })
  })

  describe('lecture du compteur', () => {
    it('accepte EN CLAIR si le comptage échoue', async () => {
      // Il n'y a plus rien à bloquer, donc plus rien à protéger par un refus.
      // Au pire la réservation s'affiche chez un laveur qui aurait dû la voir
      // masquée : on préfère cette erreur à l'inverse, qui lui cacherait un
      // vrai rendez-vous.
      avecWasher({ plan: 'decouverte' })
      plan.countMois = 0
      plan.erreurCountMois = { message: 'RLS' }
      const { res } = await poster()
      expect(res.status).toBe(201)
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toMatch(/calendrier/)
    })

    it('n’interroge pas le compteur mensuel pour une offre sans plafond', async () => {
      // Le comptage coûte une requête à chaque réservation : inutile de la
      // payer pour les offres qui n'ont rien à plafonner.
      avecWasher({ plan: 'pro' })
      plan.erreurCountMois = { message: 'si cette lecture avait lieu, elle masquerait' }
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toMatch(/calendrier/)
    })

    it('traite un plan inconnu en base comme l’offre gratuite', async () => {
      avecWasher({ plan: 'offre_fantome' })
      plan.countMois = 5
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toBe('/dashboard/abonnement')
    })
  })

  describe('ordre des contrôles', () => {
    it('refuse toujours une page « proposition »', async () => {
      avecWasher({ plan: 'pro', is_preview: true })
      const { res } = await poster()
      expect(res.status).toBe(403)
      expect(rpcAppels).toHaveLength(0)
    })

    it('masque même chez un laveur dont l’abonnement est actif', async () => {
      // Le statut d'abonnement dit qu'on a payé ; le plan dit ce qu'on a payé.
      // Les confondre rendrait le plafond inopérant sur tous les comptes actifs.
      avecWasher({ plan: 'decouverte', subscription_status: 'active' })
      plan.countMois = 5
      await poster()
      expect(notifierLaveur.mock.calls.at(-1)![1].url).toBe('/dashboard/abonnement')
    })
  })
})

describe('POST /api/bookings — fin d’essai selon l’âge du compte', () => {
  const BASCULE = new Date(RETOUR_GRATUIT_POUR_COMPTES_CREES_DES).getTime()
  const JOUR = 24 * 60 * 60 * 1000
  // L'horloge des tests est figée au 2026-09-09 (voir beforeEach) : on prend
  // des échéances très antérieures pour que la grâce de 30 jours soit dépassée.
  const ESSAI_FINI_DEPUIS_LONGTEMPS = '2026-01-01T00:00:00.000Z'

  it('coupe encore la page d’un client existant — aucun changement pour lui', () => {
    // L'exigence numéro un de cette livraison : les comptes déjà en place ne
    // changent pas de comportement du jour au lendemain.
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE - 30 * JOUR).toISOString(),
      subscription_status: 'trial',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
      subscription_ends_at: null,
    })
    return poster().then(({ res, body }) => {
      expect(res.status).toBe(403)
      expect(body.error).toMatch(/ne sont plus disponibles/)
      expect(rpcAppels).toHaveLength(0)
    })
  })

  it('laisse tourner la page d’un compte neuf, plafonnée à 5 par mois', async () => {
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'trial',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
      subscription_ends_at: null,
    })
    plan.countMois = 2
    const { res } = await poster()
    expect(res.status).toBe(201)
    expect(rpcAppels).toHaveLength(1)
  })

  it('accepte la sixième, masquée, sur ce même compte neuf', async () => {
    // Retombé sur Découverte, il garde une page qui prend des réservations —
    // il n'en voit simplement plus le détail au-delà de cinq.
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'trial',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
      subscription_ends_at: null,
    })
    plan.countMois = 5
    const { res } = await poster()
    expect(res.status).toBe(201)
    expect(notifierLaveur.mock.calls.at(-1)![1].url).toBe('/dashboard/abonnement')
  })

  it('ne coupe RIEN à un compte neuf, quel que soit son statut', async () => {
    // Couper la page ET masquer serait punir deux fois — et couper punirait
    // surtout le client, qui n'a rien demandé. Un compte neuf, essai fini,
    // au-delà du quota : sa page réserve quand même.
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'expired',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
      subscription_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
    })
    plan.countMois = 5
    const { res, body } = await poster()
    expect(res.status).toBe(201)
    expect(JSON.stringify(body)).not.toMatch(/ne sont plus disponibles/)
  })

  it('ne touche pas un compte neuf qui paie', async () => {
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'active',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
    })
    plan.countMois = 500
    expect((await poster()).res.status).toBe(201)
  })

  it('ne touche pas un compte neuf pendant son essai', async () => {
    avecWasher({
      plan: 'pro',
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'trial',
      trial_ends_at: '2027-01-01T00:00:00.000Z',
    })
    plan.countMois = 500
    expect((await poster()).res.status).toBe(201)
  })

  it('ne touche pas un client historique créé après la bascule', async () => {
    avecWasher({
      plan: 'pro', grandfathered: true,
      created_at: new Date(BASCULE + 30 * JOUR).toISOString(),
      subscription_status: 'expired',
      trial_ends_at: ESSAI_FINI_DEPUIS_LONGTEMPS,
    })
    plan.countMois = 500
    expect((await poster()).res.status).toBe(201)
  })
})
