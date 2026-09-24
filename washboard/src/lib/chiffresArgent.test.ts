import { describe, it, expect } from 'vitest'
import { finitAvant, premierJourDeDonnee, serieArgent, totauxArgent, type FraisArgent, type ReservationArgent } from './chiffresArgent'
import { plageDe, type PeriodeChiffres } from './chiffresPeriode'
import { revenuNet } from './pricing'

const P = (type: PeriodeChiffres['type'], ref: string): PeriodeChiffres => ({ type, ref })
const somme = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const rdv = (scheduled_at: string, booked_price: number | null, extra: Partial<ReservationArgent> = {}): ReservationArgent => ({
  status: 'done', scheduled_at, booked_price, ...extra,
})

// Une semaine réaliste : lundi 21 → dimanche 27 septembre 2026 (heure d'été, UTC+2).
const SEMAINE: ReservationArgent[] = [
  rdv('2026-09-21T07:00:00Z', 60),                                       // lundi 9 h
  rdv('2026-09-22T08:00:00Z', 80, { is_smart_slot: true, smart_discount: 10 }), // mardi 10 h, net 70
  rdv('2026-09-22T12:00:00Z', 40),                                       // mardi 14 h
  rdv('2026-09-24T09:00:00Z', 100),                                      // jeudi 11 h
  { ...rdv('2026-09-24T10:00:00Z', 999), status: 'confirmed' },          // pas encore terminé : ne compte pas
  { ...rdv('2026-09-25T10:00:00Z', 999), status: 'cancelled' },
  { ...rdv('2026-09-26T10:00:00Z', 999), status: 'pending' },
  rdv('2026-09-14T10:00:00Z', 500),                                      // semaine d'avant
  rdv('2026-10-01T10:00:00Z', 500),                                      // semaine d'après
]

describe('serieArgent — la somme des barres est le chiffre « Encaissé »', () => {
  const MAINTENANT = Date.parse('2026-09-24T12:00:00Z') // jeudi 14 h à Paris

  it('semaine : 7 barres, net de remise, seulement les rendez-vous terminés', () => {
    const s = serieArgent(P('semaine', '2026-09-24'), SEMAINE, [], MAINTENANT)
    expect(s.points).toHaveLength(7)
    expect(s.points.map(p => p.encaisse)).toEqual([60, 110, 0, 100, 0, 0, 0])
    expect(s.encaisse).toBe(270)
    expect(s.nbTermines).toBe(4)
    expect(somme(s.points.map(p => p.encaisse))).toBe(s.encaisse)
  })

  it('même définition que la route Compta : revenuNet sur les rendez-vous terminés de la période', () => {
    const termines = SEMAINE.filter(b => b.status === 'done' && b.scheduled_at >= '2026-09-21' && b.scheduled_at < '2026-09-28')
    const s = serieArgent(P('semaine', '2026-09-24'), SEMAINE, [], MAINTENANT)
    expect(s.encaisse).toBe(revenuNet(termines.map(b => ({ booked_price: b.booked_price, smart_discount: b.smart_discount ?? null, is_smart_slot: b.is_smart_slot ?? null }))))
  })

  it('la remise « créneau optimisé » ne se déduit que si le créneau l\'est', () => {
    const s = serieArgent(P('jour', '2026-09-22'), [
      rdv('2026-09-22T08:00:00Z', 80, { is_smart_slot: false, smart_discount: 10 }),
    ], [], MAINTENANT)
    expect(s.encaisse).toBe(80)
  })

  it('résultat = encaissé − frais, barre par barre, et frais rangés au bon jour', () => {
    const frais: FraisArgent[] = [
      { date: '2026-09-22', amount: 30 },
      { date: '2026-09-22', amount: '20.5' }, // montant en chaîne
      { date: '2026-09-27', amount: 15 },
      { date: '2026-09-20', amount: 999 },     // dimanche d'avant : hors période
    ]
    const s = serieArgent(P('semaine', '2026-09-24'), SEMAINE, frais, MAINTENANT)
    expect(s.depense).toBe(65.5)
    expect(s.resultat).toBe(270 - 65.5)
    expect(s.points[1]).toMatchObject({ encaisse: 110, depense: 50.5, resultat: 59.5 })
    expect(somme(s.points.map(p => p.resultat))).toBeCloseTo(s.resultat, 9)
  })

  it('résultat négatif : plus de frais que d\'encaissé', () => {
    const s = serieArgent(P('semaine', '2026-09-24'), SEMAINE, [{ date: '2026-09-23', amount: 500 }], MAINTENANT)
    expect(s.points[2].resultat).toBe(-500)
    expect(s.resultat).toBe(-230)
  })

  it('mois : une barre par jour (30 en septembre), la somme égale le total du mois', () => {
    const s = serieArgent(P('mois', '2026-09-24'), SEMAINE, [], MAINTENANT)
    expect(s.points).toHaveLength(30)
    expect(s.encaisse).toBe(270 + 500) // la semaine d'avant (14 sept.) est dans le mois
    expect(somme(s.points.map(p => p.encaisse))).toBe(s.encaisse)
  })

  it('année : 12 barres, la somme égale la somme des 12 mois pris un à un', () => {
    const an = serieArgent(P('annee', '2026-09-24'), SEMAINE, [{ date: '2026-03-05', amount: 100 }], MAINTENANT)
    expect(an.points).toHaveLength(12)
    let total = 0
    for (let m = 1; m <= 12; m++) {
      total += serieArgent(P('mois', `2026-${String(m).padStart(2, '0')}-10`), SEMAINE, [], MAINTENANT).encaisse
    }
    expect(an.encaisse).toBe(total)
    expect(an.points[8].encaisse).toBe(770)   // septembre
    expect(an.points[9].encaisse).toBe(500)   // octobre
    expect(an.points[2].depense).toBe(100)    // mars
  })

  it('jour : rangé par heure de Paris, frais hors barres mais dans le total', () => {
    const s = serieArgent(P('jour', '2026-09-22'), SEMAINE, [{ date: '2026-09-22', amount: 30 }], MAINTENANT)
    expect(s.fraisParCreneau).toBe(false)
    const parHeure = Object.fromEntries(s.points.filter(p => p.encaisse).map(p => [p.cle, p.encaisse]))
    expect(parHeure).toEqual({ '10': 70, '14': 40 })
    expect(s.encaisse).toBe(110)
    expect(s.depense).toBe(30)
    expect(s.resultat).toBe(80)
    expect(s.points.every(p => p.depense === 0)).toBe(true)
  })

  it('jour : montre 6 h – 21 h au minimum, et s\'élargit à une réservation de nuit', () => {
    const calme = serieArgent(P('jour', '2026-09-22'), SEMAINE, [], MAINTENANT)
    expect(calme.points[0].cle).toBe('06')
    expect(calme.points[calme.points.length - 1].cle).toBe('21')
    const nuit = serieArgent(P('jour', '2026-09-23'), [rdv('2026-09-22T22:30:00Z', 50)], [], MAINTENANT) // 00 h 30 le 23
    expect(nuit.points[0].cle).toBe('00')
    expect(nuit.encaisse).toBe(50)
  })
})

describe('serieArgent — fuseau Europe/Paris', () => {
  const MAINT = Date.parse('2026-12-31T12:00:00Z')

  it('00 h 30 le 1er octobre à Paris compte en octobre, pas en septembre (UTC : 22 h 30 le 30)', () => {
    const b = rdv('2026-09-30T22:30:00Z', 100)
    expect(serieArgent(P('mois', '2026-10-10'), [b], [], MAINT).encaisse).toBe(100)
    expect(serieArgent(P('mois', '2026-09-10'), [b], [], MAINT).encaisse).toBe(0)
  })

  it('23 h 30 le 30 septembre à Paris compte en septembre', () => {
    const b = rdv('2026-09-30T21:30:00Z', 100)
    expect(serieArgent(P('mois', '2026-09-10'), [b], [], MAINT).encaisse).toBe(100)
    expect(serieArgent(P('mois', '2026-10-10'), [b], [], MAINT).encaisse).toBe(0)
  })

  it('1er janvier 00 h 30 à Paris : dans la nouvelle année, dans la semaine qui chevauche les deux', () => {
    const b = rdv('2025-12-31T23:30:00Z', 100)
    expect(serieArgent(P('annee', '2026-06-01'), [b], [], MAINT).encaisse).toBe(100)
    expect(serieArgent(P('annee', '2025-06-01'), [b], [], MAINT).encaisse).toBe(0)
    const sem = serieArgent(P('semaine', '2026-01-01'), [b], [], MAINT)
    expect(sem.points.find(p => p.cle === '2026-01-01')?.encaisse).toBe(100)
    expect(sem.points[0].cle).toBe('2025-12-29')
  })

  it('jour de 25 h : les deux « 2 h 30 » comptent, dans la même barre, une seule fois chacune', () => {
    const s = serieArgent(P('jour', '2026-10-25'), [
      rdv('2026-10-25T00:30:00Z', 10), rdv('2026-10-25T01:30:00Z', 20), rdv('2026-10-25T09:00:00Z', 5),
    ], [], MAINT)
    expect(s.points.find(p => p.cle === '02')?.encaisse).toBe(30)
    expect(s.encaisse).toBe(35)
  })

  it('jour de 23 h : rien ne se perd', () => {
    const s = serieArgent(P('jour', '2026-03-29'), [
      rdv('2026-03-28T23:30:00Z', 10), // 00:30
      rdv('2026-03-29T00:30:00Z', 20), // 01:30
      rdv('2026-03-29T01:30:00Z', 40), // 03:30 (2 h n'existe pas)
    ], [], MAINT)
    expect(s.encaisse).toBe(70)
    expect(s.points.find(p => p.cle === '02')?.encaisse ?? 0).toBe(0)
  })

  it('février d\'une année bissextile : 29 barres, le 29 compte', () => {
    const s = serieArgent(P('mois', '2028-02-10'), [rdv('2028-02-29T10:00:00Z', 50)], [], Date.parse('2028-12-31T12:00:00Z'))
    expect(s.points).toHaveLength(29)
    expect(s.points[28].encaisse).toBe(50)
  })

  it('une réservation à la date illisible est ignorée, pas rangée au hasard', () => {
    const s = serieArgent(P('mois', '2026-09-10'), [rdv('pas une date', 50)], [], MAINT)
    expect(s.encaisse).toBe(0)
    expect(s.vide).toBe(true)
  })
})

describe('serieArgent — période en cours, à venir et vide', () => {
  it('mois en cours : le jour courant est marqué, les suivants sont « à venir », les précédents ni l\'un ni l\'autre', () => {
    const s = serieArgent(P('mois', '2026-09-24'), SEMAINE, [], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.points[23].courant).toBe(true)
    expect(s.points[23].futur).toBe(false)
    expect(s.points[24].futur).toBe(true)
    expect(s.points[22]).toMatchObject({ courant: false, futur: false })
  })

  it('un rendez-vous terminé dans un créneau « à venir » garde sa barre : la somme des barres reste le total', () => {
    // Terminé le dimanche 27 alors qu'on est le jeudi 24 (clôture avant l'heure, ou date de test).
    const b = [rdv('2026-09-24T09:00:00Z', 100), rdv('2026-09-27T09:00:00Z', 95)]
    const s = serieArgent(P('semaine', '2026-09-24'), b, [], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.points[6]).toMatchObject({ encaisse: 95, futur: false })
    expect(s.points[5].futur).toBe(true)
    expect(somme(s.points.map(p => p.encaisse))).toBe(s.encaisse)
    expect(s.encaisse).toBe(195)
  })

  it('même chose pour des frais datés dans le futur', () => {
    const s = serieArgent(P('mois', '2026-09-24'), [], [{ date: '2026-09-28', amount: 20 }], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.points[27].futur).toBe(false)
    expect(s.points[27].depense).toBe(20)
  })

  it('année en cours : les mois après septembre sont à venir', () => {
    const s = serieArgent(P('annee', '2026-09-24'), SEMAINE.filter(b => b.scheduled_at < '2026-10'), [], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.points[8].courant).toBe(true)
    expect(s.points[9].futur).toBe(true)
    expect(s.points[7].futur).toBe(false)
  })

  it('jour en cours : l\'heure courante est marquée, même sans rendez-vous', () => {
    const s = serieArgent(P('jour', '2026-09-24'), [], [], Date.parse('2026-09-24T12:00:00Z')) // 14 h
    expect(s.points.find(p => p.courant)?.cle).toBe('14')
    expect(s.points.find(p => p.cle === '15')?.futur).toBe(true)
  })

  it('période passée : rien n\'est courant ni à venir', () => {
    const s = serieArgent(P('mois', '2026-08-10'), SEMAINE, [], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.points.some(p => p.courant || p.futur)).toBe(false)
  })

  it('période sans donnée : vide, sans division ni NaN', () => {
    const s = serieArgent(P('mois', '2025-01-10'), SEMAINE, [], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.vide).toBe(true)
    expect(s.encaisse).toBe(0)
    expect(s.resultat).toBe(0)
    expect(s.points.every(p => p.resultat === 0)).toBe(true)
  })

  it('des frais sans rendez-vous ne sont pas « vide » : le résultat est négatif', () => {
    const s = serieArgent(P('mois', '2026-09-10'), [], [{ date: '2026-09-02', amount: 40 }], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.vide).toBe(false)
    expect(s.resultat).toBe(-40)
  })

  it('un montant de frais illisible compte pour zéro', () => {
    const s = serieArgent(P('mois', '2026-09-10'), [], [{ date: '2026-09-02', amount: 'abc' }], Date.parse('2026-09-24T12:00:00Z'))
    expect(s.depense).toBe(0)
  })
})

describe('totauxArgent', () => {
  it('donne les mêmes totaux que serieArgent, pour chaque type de période', () => {
    const frais: FraisArgent[] = [{ date: '2026-09-22', amount: 30 }, { date: '2026-03-05', amount: 12 }]
    for (const type of ['jour', 'semaine', 'mois', 'annee'] as const) {
      const p = P(type, '2026-09-22')
      const t = totauxArgent(p, SEMAINE, frais)
      const s = serieArgent(p, SEMAINE, frais, Date.parse('2026-12-31T12:00:00Z'))
      expect(t.encaisse).toBe(s.encaisse)
      expect(t.depense).toBe(s.depense)
      expect(t.resultat).toBe(s.resultat)
    }
  })
})

describe('premierJourDeDonnee / finitAvant', () => {
  it('premier jour de rendez-vous, à l\'heure de Paris, tous statuts confondus', () => {
    expect(premierJourDeDonnee(SEMAINE)).toBe('2026-09-14')
    expect(premierJourDeDonnee([{ scheduled_at: '2026-04-30T22:30:00Z' }])).toBe('2026-05-01')
    expect(premierJourDeDonnee([])).toBeNull()
    expect(premierJourDeDonnee([{ scheduled_at: 'x' }])).toBeNull()
  })

  it('finitAvant : la période entière précède-t-elle la donnée ?', () => {
    expect(finitAvant(P('mois', '2026-08-10'), '2026-09-14')).toBe(true)
    expect(finitAvant(P('mois', '2026-09-10'), '2026-09-14')).toBe(false)
    expect(finitAvant(P('mois', '2026-08-10'), null)).toBe(false)
    expect(plageDe(P('semaine', '2026-09-07')).fin).toBe('2026-09-13')
    expect(finitAvant(P('semaine', '2026-09-07'), '2026-09-14')).toBe(true)
  })
})
