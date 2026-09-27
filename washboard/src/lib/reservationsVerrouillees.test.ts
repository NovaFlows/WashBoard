import { describe, it, expect } from 'vitest'
import { estVerrouillee, masquerVerrouillees, jourSeul } from './reservationsVerrouillees'

// ─────────────────────────────────────────────────────────────────────────────
// Au-delà du quota mensuel, la réservation est acceptée mais le laveur n'en
// voit rien. C'est la règle qui décide ce qu'il a le droit de lire — une erreur
// dans un sens lui cache un vrai rendez-vous, dans l'autre elle offre
// gratuitement ce qu'on vend.
// ─────────────────────────────────────────────────────────────────────────────

const SEUIL = '2026-09-20T10:00:00.000Z'

describe('estVerrouillee', () => {
  it('verrouille ce qui arrive APRÈS le seuil', () => {
    expect(estVerrouillee({ created_at: '2026-09-20T10:00:00.001Z' }, SEUIL)).toBe(true)
    expect(estVerrouillee({ created_at: '2026-09-25T09:00:00.000Z' }, SEUIL)).toBe(true)
  })

  it('laisse passer la réservation qui EST le seuil', () => {
    // Le seuil est la dernière réservation comprise dans le quota : elle est
    // donc visible. La verrouiller reviendrait à en offrir une de moins que ce
    // que la grille annonce.
    expect(estVerrouillee({ created_at: SEUIL }, SEUIL)).toBe(false)
  })

  it('laisse passer tout ce qui précède', () => {
    expect(estVerrouillee({ created_at: '2026-09-01T08:00:00.000Z' }, SEUIL)).toBe(false)
  })

  it('ne verrouille rien quand il n’y a pas de seuil', () => {
    // Offre sans plafond, ou mois pas encore rempli.
    expect(estVerrouillee({ created_at: '2030-01-01T00:00:00.000Z' }, null)).toBe(false)
  })

  it('ne verrouille rien sans date de création', () => {
    // Le doute profite toujours au laveur : lui cacher les coordonnées d'un
    // client auquel il a droit lui ferait rater un vrai rendez-vous.
    expect(estVerrouillee({}, SEUIL)).toBe(false)
    expect(estVerrouillee({ created_at: null }, SEUIL)).toBe(false)
    expect(estVerrouillee(null, SEUIL)).toBe(false)
  })

  it('ne verrouille rien sur une date illisible', () => {
    expect(estVerrouillee({ created_at: 'pas une date' }, SEUIL)).toBe(false)
    expect(estVerrouillee({ created_at: SEUIL }, 'pas une date')).toBe(false)
  })

  it('compare des INSTANTS, pas des chaînes', () => {
    // Postgres rend ses dates avec un nombre variable de décimales et un
    // décalage explicite : « 2026-09-20T12:00:00+02:00 » est le même instant
    // que le seuil, écrit autrement. Une comparaison caractère par caractère
    // l'aurait cru postérieur (« 2 » > « 1 ») et l'aurait verrouillé à tort.
    expect(estVerrouillee({ created_at: '2026-09-20T12:00:00+02:00' }, SEUIL)).toBe(false)
    expect(estVerrouillee({ created_at: '2026-09-20T10:00:00.000000+00:00' }, SEUIL)).toBe(false)
  })
})

describe('masquerVerrouillees', () => {
  const liste = [
    { id: 'a', created_at: '2026-09-01T08:00:00.000Z', client_name: 'Claire Martin', client_phone: '0611111111', address: '3 rue Colbert', scheduled_at: '2026-10-01T09:00:00.000Z' },
    { id: 'b', created_at: SEUIL,                      client_name: 'Marc Petit',    client_phone: '0622222222', address: '9 rue Gambetta', scheduled_at: '2026-10-02T09:00:00.000Z' },
    { id: 'c', created_at: '2026-09-25T09:00:00.000Z', client_name: 'Nadia Costa',   client_phone: '0633333333', address: '12 rue du Parc', scheduled_at: '2026-10-03T09:00:00.000Z' },
  ]

  it('laisse intactes les réservations comprises dans le quota', () => {
    const [a, b] = masquerVerrouillees(liste, SEUIL)
    expect(a.client_name).toBe('Claire Martin')
    expect(a.verrouillee).toBe(false)
    expect(b.client_name).toBe('Marc Petit')
    expect(b.verrouillee).toBe(false)
  })

  it('efface de quoi joindre le client, mais garde son NOM', () => {
    // Le nom reste : c'est ce qui rend la demande réelle. « Réservation
    // bloquée » ne donne envie de rien, « Nadia Costa » si.
    const c = masquerVerrouillees(liste, SEUIL)[2]
    expect(c.verrouillee).toBe(true)
    expect(c.client_name).toBe('Nadia Costa')
    expect(c.client_phone).toBeNull()
    expect(c.address).toBeNull()
  })

  it('garde la date brute, que les écrans réduisent au jour', () => {
    // `scheduled_at` n'est pas écrasé : il sert encore à trier et au calcul
    // des créneaux. C'est `jourSeul` qui retire l'heure à l'affichage — la
    // remplacer ici par un minuit ferait sauter le rendez-vous en tête de
    // journée et fausserait les disponibilités.
    const c = masquerVerrouillees(liste, SEUIL)[2]
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
    const tout = masquerVerrouillees(liste, null)
    expect(tout.map(r => r.client_name)).toEqual(['Claire Martin', 'Marc Petit', 'Nadia Costa'])
    expect(tout.every(r => !r.verrouillee)).toBe(true)
  })

  it('ne modifie pas la liste d’origine', () => {
    // Elle sert ailleurs dans la même page — aux comptages, notamment, qui
    // doivent rester entiers.
    masquerVerrouillees(liste, SEUIL)
    expect(liste[2].client_name).toBe('Nadia Costa')
  })

  it('rend une liste vide sur une liste vide', () => {
    expect(masquerVerrouillees([], SEUIL)).toEqual([])
  })
})
