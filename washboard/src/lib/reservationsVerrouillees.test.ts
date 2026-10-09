import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  estVerrouillee, masquerVerrouillees, jourSeul, seuilsDepuisDates,
  bornesPeriodes, montantVerrouille, seuilsVerrouillage, compterReservationsDeLaPeriode, type Periode,
} from './reservationsVerrouillees'
import { logger } from './logger'
import { PLAFOND_RESERVATIONS_APPLIQUE_DES, debutPeriodeQuota, finPeriodeQuota } from './plan'

// ─────────────────────────────────────────────────────────────────────────────
// Au-delà du quota de sa période, la réservation est acceptée mais le laveur
// n'en voit rien. C'est la règle qui décide ce qu'il a le droit de lire — une
// erreur dans un sens lui cache un vrai rendez-vous, dans l'autre elle offre
// gratuitement ce qu'on vend.
//
// La période n'est PAS le mois calendaire : elle court d'une date anniversaire
// d'inscription à la suivante. Un laveur inscrit le 22 a son mois du 22 au 21.
// ─────────────────────────────────────────────────────────────────────────────

/** Une période d'un mois qui commence après l'entrée en vigueur du plafond. */
const PERIODE: Periode = {
  debut: '2026-09-22T00:00:00.000Z',
  fin:   '2026-10-22T00:00:00.000Z',
  seuil: '2026-09-25T10:00:00.000Z',
}
const PERIODES = [PERIODE]

describe('estVerrouillee', () => {
  it('verrouille ce qui arrive APRÈS le seuil de sa période', () => {
    expect(estVerrouillee({ created_at: '2026-09-25T10:00:00.001Z' }, PERIODES)).toBe(true)
    expect(estVerrouillee({ created_at: '2026-10-01T09:00:00.000Z' }, PERIODES)).toBe(true)
  })

  it('laisse passer la réservation qui EST le seuil', () => {
    // Le seuil est la dernière réservation comprise dans le quota : elle est
    // donc visible. La verrouiller reviendrait à en offrir une de moins que ce
    // que la grille annonce.
    expect(estVerrouillee({ created_at: PERIODE.seuil }, PERIODES)).toBe(false)
  })

  it('laisse passer tout ce qui précède dans la période', () => {
    expect(estVerrouillee({ created_at: '2026-09-23T08:00:00.000Z' }, PERIODES)).toBe(false)
  })

  it('ne verrouille rien hors de toute période connue', () => {
    // Avant la fenêtre couverte, ou après : pas de seuil, donc rien de masqué.
    expect(estVerrouillee({ created_at: '2026-10-25T09:00:00.000Z' }, PERIODES)).toBe(false)
    expect(estVerrouillee({ created_at: '2026-09-21T09:00:00.000Z' }, PERIODES)).toBe(false)
  })

  it('ne verrouille rien sans période', () => {
    expect(estVerrouillee({ created_at: '2030-01-01T00:00:00.000Z' }, null)).toBe(false)
    expect(estVerrouillee({ created_at: '2030-01-01T00:00:00.000Z' }, [])).toBe(false)
  })

  it('ne verrouille rien sans date de création', () => {
    // Le doute profite toujours au laveur : lui cacher les coordonnées d'un
    // client auquel il a droit lui ferait rater un vrai rendez-vous.
    expect(estVerrouillee({}, PERIODES)).toBe(false)
    expect(estVerrouillee({ created_at: null }, PERIODES)).toBe(false)
    expect(estVerrouillee(null, PERIODES)).toBe(false)
  })

  it('ne verrouille rien sur une date illisible', () => {
    expect(estVerrouillee({ created_at: 'pas une date' }, PERIODES)).toBe(false)
    expect(estVerrouillee(
      { created_at: '2026-10-01T09:00:00Z' },
      [{ ...PERIODE, seuil: 'pas une date' }],
    )).toBe(false)
  })

  it('compare des INSTANTS, pas des chaînes', () => {
    // Postgres rend ses dates avec un nombre variable de décimales et un
    // décalage explicite : « 2026-09-25T12:00:00+02:00 » est le même instant
    // que le seuil, écrit autrement. Une comparaison caractère par caractère
    // l'aurait cru postérieur (« 2 » > « 1 ») et l'aurait verrouillé à tort.
    expect(estVerrouillee({ created_at: '2026-09-25T12:00:00+02:00' }, PERIODES)).toBe(false)
    expect(estVerrouillee({ created_at: '2026-09-25T10:00:00.000000+00:00' }, PERIODES)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// La faille du changement de période. Un seuil unique ne portait que sur la
// période en cours : à la suivante, tout ce qui était masqué redevenait
// lisible. Il suffisait d'attendre pour obtenir gratuitement ce qu'on vend.
// ─────────────────────────────────────────────────────────────────────────────

describe('un rendez-vous saisi par le laveur n’est jamais verrouillé', () => {
  it('reste lisible même arrivé après l’épuisement du quota', () => {
    expect(estVerrouillee({ created_at: '2026-09-25T10:00:00.001Z', saisie_par_laveur: true }, PERIODES)).toBe(false)
  })

  it('reste lisible dans la liste masquée, avec ses coordonnées', () => {
    const [r] = masquerVerrouillees(
      [{ created_at: '2026-09-25T10:00:00.001Z', saisie_par_laveur: true, client_phone: '0612345678' }],
      PERIODES,
    )
    expect(r.verrouillee).toBe(false)
    expect(r.client_phone).toBe('0612345678')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Décision `legal` du 2026-10-04 : une réservation déjà FACTURÉE reste
// toujours lisible, même re-classée au-delà du quota après une rétrogradation
// d'offre (le plafond, plus bas, s'applique rétroactivement sur 12 périodes
// passées). Le laveur a une obligation de conservation de ses factures, et le
// masquage n'a de sens commercial qu'AVANT facturation.
// ─────────────────────────────────────────────────────────────────────────────

describe('un rendez-vous déjà facturé n’est jamais verrouillé', () => {
  it('reste lisible même arrivé après l’épuisement du quota', () => {
    expect(estVerrouillee({ created_at: '2026-09-25T10:00:00.001Z', facture_numero: 'F-2026-0012' }, PERIODES)).toBe(false)
  })

  it('reste lisible dans la liste masquée, avec ses coordonnées', () => {
    const [r] = masquerVerrouillees(
      [{ created_at: '2026-09-25T10:00:00.001Z', facture_numero: 'F-2026-0012', client_phone: '0612345678' }],
      PERIODES,
    )
    expect(r.verrouillee).toBe(false)
    expect(r.client_phone).toBe('0612345678')
  })

  it('reste verrouillé tant qu’aucune facture n’a été émise', () => {
    expect(estVerrouillee({ created_at: '2026-09-25T10:00:00.001Z', facture_numero: null }, PERIODES)).toBe(true)
  })
})

describe('le verrou ne saute pas au changement de période', () => {
  const DEUX: Periode[] = [
    { debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z' },
    { debut: '2026-10-22T00:00:00.000Z', fin: '2026-11-22T00:00:00.000Z', seuil: '2026-10-28T10:00:00.000Z' },
  ]

  it('garde verrouillée une réservation de la période précédente', () => {
    expect(estVerrouillee({ created_at: '2026-10-01T09:00:00.000Z' }, DEUX)).toBe(true)
  })

  it('juge chaque période sur SON propre seuil', () => {
    // La période repart à zéro : les premières réservations du 22 octobre sont
    // dans le quota, même si elles suivent le seuil de septembre dans le temps.
    expect(estVerrouillee({ created_at: '2026-10-25T09:00:00.000Z' }, DEUX)).toBe(false)
    expect(estVerrouillee({ created_at: '2026-10-29T09:00:00.000Z' }, DEUX)).toBe(true)
  })
})

describe('bornesPeriodes', () => {
  it('découpe des périodes qui se touchent sans se chevaucher', () => {
    const bornes = bornesPeriodes('2026-03-22T08:00:00Z', new Date('2026-09-25T10:00:00Z'), 4)
    expect(bornes).toHaveLength(4)
    for (let i = 1; i < bornes.length; i++) {
      // La fin de l'une est exactement le début de la suivante : aucune
      // réservation ne peut tomber dans un trou, ni compter deux fois.
      expect(bornes[i].debut).toBe(bornes[i - 1].fin)
    }
  })

  it('finit sur la période qui contient l’instant demandé', () => {
    const now = new Date('2026-09-25T10:00:00Z')
    const bornes = bornesPeriodes('2026-03-22T08:00:00Z', now, 3)
    const derniere = bornes[bornes.length - 1]
    expect(derniere.debut).toBe(debutPeriodeQuota('2026-03-22T08:00:00Z', now).toISOString())
    expect(derniere.fin).toBe(finPeriodeQuota('2026-03-22T08:00:00Z', now).toISOString())
  })

  it('tient aussi sans date d’inscription — on retombe sur le mois calendaire', () => {
    const bornes = bornesPeriodes(null, new Date('2026-09-25T10:00:00Z'), 3)
    expect(bornes).toHaveLength(3)
    for (let i = 1; i < bornes.length; i++) expect(bornes[i].debut).toBe(bornes[i - 1].fin)
  })
})

describe('seuilsDepuisDates', () => {
  const BORNES = [
    { debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z' },
    { debut: '2026-10-22T00:00:00.000Z', fin: '2026-11-22T00:00:00.000Z' },
  ]

  it('prend la N-ième réservation de CHAQUE période', () => {
    const dates = [
      '2026-09-23T08:00:00.000Z', '2026-09-25T08:00:00.000Z', '2026-09-28T08:00:00.000Z',
      '2026-10-23T08:00:00.000Z', '2026-10-24T08:00:00.000Z',
    ]
    // Quota de 2 : le seuil est la 2ᵉ de chaque période.
    expect(seuilsDepuisDates(dates, 2, BORNES)).toEqual([
      { ...BORNES[0], seuil: '2026-09-25T08:00:00.000Z' },
      { ...BORNES[1], seuil: '2026-10-24T08:00:00.000Z' },
    ])
  })

  it('ne donne pas de seuil à une période qui n’a pas atteint son plafond', () => {
    const dates = ['2026-09-23T08:00:00.000Z', '2026-09-25T08:00:00.000Z']
    expect(seuilsDepuisDates(dates, 5, BORNES)).toEqual([])
  })

  it('rend une liste vide sur un quota nul ou négatif', () => {
    expect(seuilsDepuisDates(['2026-09-23T08:00:00.000Z'], 0, BORNES)).toEqual([])
    expect(seuilsDepuisDates(['2026-09-23T08:00:00.000Z'], -1, BORNES)).toEqual([])
  })

  it('ignore une date illisible sans fausser le comptage', () => {
    const dates = ['2026-09-23T08:00:00.000Z', 'pas une date', '2026-09-25T08:00:00.000Z']
    expect(seuilsDepuisDates(dates, 2, BORNES)).toEqual([{ ...BORNES[0], seuil: '2026-09-25T08:00:00.000Z' }])
  })

  it('ignore ce qui tombe hors de toute période', () => {
    const dates = ['2020-01-01T08:00:00.000Z', '2026-09-23T08:00:00.000Z', '2026-09-25T08:00:00.000Z']
    expect(seuilsDepuisDates(dates, 2, BORNES)).toEqual([{ ...BORNES[0], seuil: '2026-09-25T08:00:00.000Z' }])
  })
})

describe('masquerVerrouillees', () => {
  const liste = [
    { id: 'a', created_at: '2026-09-23T08:00:00.000Z', client_name: 'Claire Martin', client_phone: '0611111111', address: '3 rue Colbert', scheduled_at: '2026-10-01T09:00:00.000Z' },
    { id: 'b', created_at: PERIODE.seuil,              client_name: 'Marc Petit',    client_phone: '0622222222', address: '9 rue Gambetta', scheduled_at: '2026-10-02T09:00:00.000Z' },
    { id: 'c', created_at: '2026-09-28T09:00:00.000Z', client_name: 'Nadia Costa',   client_phone: '0633333333', address: '12 rue du Parc', scheduled_at: '2026-10-03T09:00:00.000Z' },
  ]

  it('laisse intactes les réservations comprises dans le quota', () => {
    const [a, b] = masquerVerrouillees(liste, PERIODES)
    expect(a.client_name).toBe('Claire Martin')
    expect(a.verrouillee).toBe(false)
    expect(b.client_name).toBe('Marc Petit')
    expect(b.verrouillee).toBe(false)
  })

  it('efface de quoi joindre le client, NOM compris', () => {
    // Un nom reconnu suffit au laveur pour rappeler le client avec son propre
    // carnet, sans jamais payer : il part avec le téléphone et l'adresse.
    const c = masquerVerrouillees(liste, PERIODES)[2]
    expect(c.verrouillee).toBe(true)
    expect(c.client_name).toBeNull()
    expect(c.client_phone).toBeNull()
    expect(c.address).toBeNull()
  })

  // Trois oublis trouvés le 2026-10-02 (vérification Playwright en conditions réelles) :
  // `ends_at` + la durée (déjà visible) recalcule l'heure de début malgré le masquage ailleurs ;
  // `lat`/`lng` sont l'équivalent exact de l'adresse déjà masquée ; `travel_fee` trahit la
  // distance, donc indirectement où habite le client.
  it('efface aussi l’heure de fin, la position GPS et les frais de déplacement', () => {
    const [c] = masquerVerrouillees(
      [{ ...liste[2], ends_at: '2026-10-03T10:30:00.000Z', lat: 48.8566, lng: 2.3522, travel_fee: 12 }],
      PERIODES,
    )
    expect(c.verrouillee).toBe(true)
    expect(c.ends_at).toBeNull()
    expect(c.lat).toBeNull()
    expect(c.lng).toBeNull()
    expect(c.travel_fee).toBeNull()
  })
  it('garde la date brute, que les écrans réduisent au jour', () => {
    // `scheduled_at` n'est pas écrasé : il sert encore à trier et au calcul
    // des créneaux. La remplacer ici par un minuit ferait sauter le rendez-vous
    // en tête de journée et fausserait les disponibilités.
    const c = masquerVerrouillees(liste, PERIODES)[2]
    expect(c.scheduled_at).toBe('2026-10-03T09:00:00.000Z')
    expect(c.id).toBe('c')
  })

  it('réduit l’affichage au jour, sans l’heure', () => {
    // L'heure suffirait à honorer le rendez-vous sans jamais payer : il
    // suffirait d'attendre sur place.
    const jour = jourSeul('2026-10-03T09:00:00.000Z')
    expect(jour).toMatch(/3 octobre/)
    expect(jour).not.toMatch(/\d{1,2}:\d{2}|11h|09h/)
  })

  it('ne rend aucun jour pour une date absente ou illisible', () => {
    expect(jourSeul(null)).toBeNull()
    expect(jourSeul('pas une date')).toBeNull()
  })

  it('ne masque rien quand l’offre n’a pas de plafond', () => {
    const tout = masquerVerrouillees(liste, [])
    expect(tout.map(r => r.client_name)).toEqual(['Claire Martin', 'Marc Petit', 'Nadia Costa'])
    expect(tout.every(r => !r.verrouillee)).toBe(true)
  })

  it('ne modifie pas la liste d’origine', () => {
    // Elle sert ailleurs dans la même page — aux comptages, notamment, qui
    // doivent rester entiers.
    masquerVerrouillees(liste, PERIODES)
    expect(liste[2].client_name).toBe('Nadia Costa')
  })

  it('rend une liste vide sur une liste vide', () => {
    expect(masquerVerrouillees([], PERIODES)).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Le plafond ne vaut que pour l'avenir. Un laveur qui avait quarante-neuf
// clients la veille du déploiement les garde tous : ce sont des gens qu'il a
// lavés, appelés, facturés. Les lui cacher pour lui vendre une offre, ce n'est
// pas de la pression commerciale — c'est lui reprendre son propre travail.
// ─────────────────────────────────────────────────────────────────────────────

describe('les clients d’avant restent au laveur', () => {
  const ENTREE = new Date(PLAFOND_RESERVATIONS_APPLIQUE_DES).getTime()
  const avant = new Date(ENTREE - 60_000).toISOString()
  const apres = new Date(ENTREE + 120_000).toISOString()
  // Une période qui enjambe l'entrée en vigueur, avec un seuil antérieur.
  const enjambe: Periode[] = [{
    debut: new Date(ENTREE - 86_400_000).toISOString(),
    fin:   new Date(ENTREE + 86_400_000).toISOString(),
    seuil: new Date(ENTREE - 120_000).toISOString(),
  }]

  it('ne masque jamais une réservation antérieure à l’entrée en vigueur', () => {
    expect(estVerrouillee({ created_at: avant }, enjambe)).toBe(false)
  })

  it('masque bien ce qui arrive après', () => {
    expect(estVerrouillee({ created_at: apres }, enjambe)).toBe(true)
  })

  it('ne compte pas l’historique dans le montant masqué', () => {
    expect(montantVerrouille([{ created_at: avant, booked_price: 90 }], enjambe)).toBe(0)
  })

  it('laisse l’historique intact dans une liste masquée', () => {
    const [r] = masquerVerrouillees(
      [{ created_at: avant, client_name: 'Claire Martin', client_phone: '0611111111' }],
      enjambe,
    )
    expect(r.verrouillee).toBe(false)
    expect(r.client_name).toBe('Claire Martin')
    expect(r.client_phone).toBe('0611111111')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Le montant masqué. « 3 clients » ne dit rien à un laveur ; « 195 € » se
// compare tout seul au prix de l'abonnement. Encore faut-il que le chiffre
// soit juste : un montant gonflé qui se dégonfle au paiement coûte la
// confiance, pas seulement une vente.
// ─────────────────────────────────────────────────────────────────────────────

describe('montantVerrouille', () => {
  it('ne compte QUE les réservations verrouillées', () => {
    const liste = [
      { created_at: '2026-09-23T08:00:00.000Z', booked_price: 40 },  // dans le quota
      { created_at: '2026-09-27T08:00:00.000Z', booked_price: 65 },  // verrouillée
      { created_at: '2026-09-28T08:00:00.000Z', booked_price: 90 },  // verrouillée
    ]
    expect(montantVerrouille(liste, PERIODES)).toBe(155)
  })

  it('retombe sur le prix de la prestation quand le prix réservé manque', () => {
    const liste = [
      { created_at: '2026-09-27T08:00:00.000Z', booked_price: null, services: { price: 50 } },
      // PostgREST rend parfois la jointure sous forme de tableau.
      { created_at: '2026-09-28T08:00:00.000Z', services: [{ price: 30 }] },
    ]
    expect(montantVerrouille(liste, PERIODES)).toBe(80)
  })

  it('compte zéro plutôt que de fausser le total quand aucun prix n’est connu', () => {
    const liste = [
      { created_at: '2026-09-27T08:00:00.000Z', booked_price: null, services: null },
      { created_at: '2026-09-28T08:00:00.000Z', booked_price: 65 },
    ]
    expect(montantVerrouille(liste, PERIODES)).toBe(65)
  })

  it('rend zéro sans période — rien n’est verrouillé, rien n’est dû', () => {
    const liste = [{ created_at: '2026-09-27T08:00:00.000Z', booked_price: 65 }]
    expect(montantVerrouille(liste, null)).toBe(0)
    expect(montantVerrouille([], PERIODES)).toBe(0)
  })

  it('juge chaque réservation sur la période qui est la sienne', () => {
    // Même faille que pour le masquage : la période suivante ne doit pas être
    // jugée avec le seuil de la précédente.
    const liste = [
      { created_at: '2026-09-27T08:00:00.000Z', booked_price: 65 },   // verrouillée
      { created_at: '2026-10-23T08:00:00.000Z', booked_price: 100 },  // période neuve
    ]
    expect(montantVerrouille(liste, PERIODES)).toBe(65)
  })
})

// ── Lecture en base ─────────────────────────────────────────────────────────
//
// Un échec de lecture ne masque rien (le doute profite au laveur) : c'est donc
// tout l'écran qui part en clair. Ce repli ne doit jamais être silencieux — le
// jour où un appelant passe la session au lieu de l'admin, c'est ici qu'on le voit.

type Reponse = { data?: unknown; count?: number | null; error: unknown }

function fauxClient(reponse: Reponse) {
  const filtres: Record<string, unknown> = {}
  const tables: string[] = []
  const client = {
    from: (table: string) => {
      tables.push(table)
      const b: Record<string, unknown> = {}
      const self = () => b
      Object.assign(b, {
        select: self, neq: self, gte: self, order: self, limit: self,
        eq: (colonne: string, valeur: unknown) => { filtres[colonne] = valeur; return b },
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(reponse).then(ok, ko),
      })
      return b
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, filtres, tables }
}

const LAVEUR = { id: 'washer-1', created_at: '2026-01-22T00:00:00.000Z' }
const MAINTENANT = new Date('2026-10-01T12:00:00.000Z')

afterEach(() => vi.restoreAllMocks())

describe('seuilsVerrouillage', () => {
  it('ne lit rien quand l’offre n’a pas de plafond', async () => {
    const { client, tables } = fauxClient({ data: [], error: null })
    expect(await seuilsVerrouillage(client, LAVEUR, null, MAINTENANT)).toEqual([])
    expect(tables).toEqual([])
  })

  it('filtre sur le laveur et pose le seuil sur la N-ième réservation de la période', async () => {
    const { client, filtres } = fauxClient({
      data: [
        { created_at: '2026-09-24T10:00:00.000Z' },
        { created_at: '2026-09-25T10:00:00.000Z' },
        { created_at: '2026-09-26T10:00:00.000Z' },
      ],
      error: null,
    })
    const seuils = await seuilsVerrouillage(client, LAVEUR, 2, MAINTENANT)
    expect(filtres).toMatchObject({ washer_id: 'washer-1', saisie_par_laveur: false })
    expect(seuils.at(-1)?.seuil).toBe('2026-09-25T10:00:00.000Z')
  })

  it('ne masque rien sur une lecture en échec, mais le trace', async () => {
    const trace = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const { client } = fauxClient({ data: null, error: { code: '42501', message: 'permission denied' } })
    expect(await seuilsVerrouillage(client, LAVEUR, 2, MAINTENANT)).toEqual([])
    expect(trace).toHaveBeenCalledWith('verrouillage.seuils.read_failed', { washerId: 'washer-1' }, expect.anything())
  })
})

describe('compterReservationsDeLaPeriode', () => {
  it('rend le compte de la période, filtré sur le laveur', async () => {
    const { client, filtres } = fauxClient({ count: 7, error: null })
    expect(await compterReservationsDeLaPeriode(client, LAVEUR, MAINTENANT)).toBe(7)
    expect(filtres).toMatchObject({ washer_id: 'washer-1', saisie_par_laveur: false })
  })

  it('rend null, jamais zéro, sur une lecture en échec — et le trace', async () => {
    const trace = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const { client } = fauxClient({ count: null, error: { code: '42501', message: 'permission denied' } })
    expect(await compterReservationsDeLaPeriode(client, LAVEUR, MAINTENANT)).toBeNull()
    expect(trace).toHaveBeenCalledWith('verrouillage.compte_periode.read_failed', { washerId: 'washer-1' }, expect.anything())
  })
})
