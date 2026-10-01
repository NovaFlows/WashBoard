import { describe, it, expect } from 'vitest'
import {
  aujourdhuiParis, ajouterJours, bornesInstants, cleCreneauDuJour, contientAujourdhui, creneauDe, creneauxDe,
  deplacer, estAvant, formaterJour, jourParisDe, libelleComparaison, partiesParis, plageDe, rognerHeures,
  type PeriodeChiffres,
} from './chiffresPeriode'
import { getPeriodRange, type PeriodType } from './comptaPeriod'

const P = (type: PeriodeChiffres['type'], ref: string): PeriodeChiffres => ({ type, ref })

describe('plageDe', () => {
  it('jour : un seul jour', () => {
    const r = plageDe(P('jour', '2026-09-24'))
    expect([r.debut, r.fin]).toEqual(['2026-09-24', '2026-09-24'])
    expect(r.label).toContain('24 septembre 2026')
  })

  it('semaine : du lundi au dimanche, quel que soit le jour de la semaine choisi', () => {
    for (const ref of ['2026-09-21', '2026-09-24', '2026-09-27']) {
      const r = plageDe(P('semaine', ref))
      expect([r.debut, r.fin]).toEqual(['2026-09-21', '2026-09-27'])
    }
  })

  it('semaine : à cheval sur deux mois', () => {
    const r = plageDe(P('semaine', '2026-09-30'))
    expect([r.debut, r.fin]).toEqual(['2026-09-28', '2026-10-04'])
  })

  it('semaine : à cheval sur deux années, le libellé porte les deux années', () => {
    const r = plageDe(P('semaine', '2026-01-01'))
    expect([r.debut, r.fin]).toEqual(['2025-12-29', '2026-01-04'])
    expect(r.label).toContain('2025')
    expect(r.label).toContain('2026')
  })

  it.each([
    ['2026-02-10', '2026-02-28'],
    ['2028-02-10', '2028-02-29'], // année bissextile
    ['2026-09-10', '2026-09-30'],
    ['2026-10-10', '2026-10-31'],
    ['2026-12-31', '2026-12-31'],
  ])('mois : %s finit le %s', (ref, fin) => {
    const r = plageDe(P('mois', ref))
    expect(r.debut).toBe(`${ref.slice(0, 7)}-01`)
    expect(r.fin).toBe(fin)
  })

  it('mois : libellé « Septembre 2026 » ; année : « 2026 »', () => {
    expect(plageDe(P('mois', '2026-09-24')).label).toBe('Septembre 2026')
    const a = plageDe(P('annee', '2026-09-24'))
    expect([a.debut, a.fin, a.label]).toEqual(['2026-01-01', '2026-12-31', '2026'])
  })

  it('reprend à l\'identique la définition de comptaPeriod.getPeriodRange (Compta v1)', () => {
    const refs = ['2026-01-01', '2026-02-28', '2026-03-29', '2026-09-24', '2026-10-25', '2026-12-31', '2028-02-29']
    const types: PeriodType[] = ['jour', 'semaine', 'mois', 'annee']
    for (const ref of refs) {
      const [a, m, j] = ref.split('-').map(Number)
      for (const type of types) {
        const ancien = getPeriodRange(type, new Date(a, m - 1, j))
        const nouveau = plageDe(P(type, ref))
        expect([nouveau.debut, nouveau.fin]).toEqual([ancien.start, ancien.end])
      }
    }
  })
})

describe('deplacer', () => {
  const AUJ = '2026-09-24'

  it('mois : le 31 octobre précédent est en septembre (pas le 1er octobre)', () => {
    const p = deplacer(P('mois', '2026-10-31'), -1, '2026-12-01')
    expect(p.ref).toBe('2026-09-30')
    expect(plageDe(p).debut).toBe('2026-09-01')
  })

  it('mois : mars → février se cale sur le dernier jour, et 3 reculs de suite sont justes', () => {
    let p = P('mois', '2026-03-31')
    p = deplacer(p, -1, '2026-12-01')
    expect(plageDe(p).label).toBe('Février 2026')
    p = deplacer(p, -1, '2026-12-01')
    expect(plageDe(p).label).toBe('Janvier 2026')
    p = deplacer(p, -1, '2026-12-01')
    expect(plageDe(p).label).toBe('Décembre 2025')
  })

  it('mois : traverse le 1er janvier dans les deux sens', () => {
    expect(plageDe(deplacer(P('mois', '2026-01-15'), -1, AUJ)).label).toBe('Décembre 2025')
    expect(plageDe(deplacer(P('mois', '2025-12-15'), 1, AUJ)).label).toBe('Janvier 2026')
  })

  it('année : le 29 février d\'une bissextile passe au 28 février', () => {
    expect(deplacer(P('annee', '2028-02-29'), -1, '2030-01-01').ref).toBe('2027-02-28')
    expect(deplacer(P('annee', '2026-09-24'), -1, AUJ).ref).toBe('2025-09-24')
  })

  it('semaine et jour : ±7 et ±1 jours, à travers les fins de mois et d\'année', () => {
    expect(deplacer(P('semaine', '2026-09-24'), -1, AUJ).ref).toBe('2026-09-17')
    expect(deplacer(P('jour', '2026-01-01'), -1, AUJ).ref).toBe('2025-12-31')
    expect(deplacer(P('jour', '2026-02-28'), 1, AUJ).ref).toBe('2026-03-01')
  })

  it('ne dépasse jamais aujourd\'hui : « suivant » depuis jeudi dernier retombe sur aujourd\'hui', () => {
    // Aujourd'hui = mercredi 23 ; jeudi 17 + 7 = jeudi 24 > aujourd'hui
    const p = deplacer(P('semaine', '2026-09-17'), 1, '2026-09-23')
    expect(p.ref).toBe('2026-09-23')
    expect(contientAujourdhui(p, '2026-09-23')).toBe(true)
  })

  it('garde le type de période', () => {
    expect(deplacer(P('mois', '2026-09-24'), -1, AUJ).type).toBe('mois')
  })
})

describe('contientAujourdhui', () => {
  it.each([
    ['jour', '2026-09-24', true],
    ['jour', '2026-09-23', false],
    ['semaine', '2026-09-21', true],
    ['semaine', '2026-09-14', false],
    ['mois', '2026-09-01', true],
    ['mois', '2026-08-31', false],
    ['annee', '2026-01-01', true],
    ['annee', '2025-12-31', false],
  ] as const)('%s de %s : %s', (type, ref, attendu) => {
    expect(contientAujourdhui(P(type, ref), '2026-09-24')).toBe(attendu)
  })
})

describe('fuseau Europe/Paris', () => {
  it('partiesParis : 00 h 30 le 2 septembre à Paris est le 2, pas le 1er (UTC : 22 h 30 la veille)', () => {
    expect(partiesParis('2026-09-01T22:30:00Z')).toEqual({ jour: '2026-09-02', heure: 0 })
  })

  it('partiesParis : l\'hiver (UTC+1)', () => {
    expect(partiesParis('2026-01-01T23:30:00Z')).toEqual({ jour: '2026-01-02', heure: 0 })
    expect(partiesParis('2026-01-15T08:00:00Z')).toEqual({ jour: '2026-01-15', heure: 9 })
  })

  it('partiesParis : minuit pile est l\'heure 0, jamais 24', () => {
    expect(partiesParis('2026-07-01T22:00:00Z')?.heure).toBe(0)
  })

  it('partiesParis : date illisible → null', () => {
    expect(partiesParis('n\'importe quoi')).toBeNull()
    expect(jourParisDe('n\'importe quoi')).toBeNull()
  })

  it('aujourdhuiParis : à 23 h 30 UTC on est déjà demain à Paris', () => {
    expect(aujourdhuiParis(Date.parse('2026-09-23T22:30:00Z'))).toBe('2026-09-24')
  })

  it('bornesInstants : septembre 2026 va de minuit Paris à minuit Paris', () => {
    const { debut, fin } = bornesInstants(P('mois', '2026-09-10'))
    expect(debut.toISOString()).toBe('2026-08-31T22:00:00.000Z')
    expect(fin.toISOString()).toBe('2026-09-30T22:00:00.000Z')
  })

  it('bornesInstants : le jour du passage à l\'heure d\'été dure 23 h, celui de retour 25 h', () => {
    const heures = (ref: string) => {
      const { debut, fin } = bornesInstants(P('jour', ref))
      return (fin.getTime() - debut.getTime()) / 3_600_000
    }
    expect(heures('2026-03-29')).toBe(23)
    expect(heures('2026-10-25')).toBe(25)
    expect(heures('2026-09-24')).toBe(24)
  })

  it('bornesInstants : une semaine qui contient le changement d\'heure dure 7 jours moins 1 h', () => {
    const { debut, fin } = bornesInstants(P('semaine', '2026-03-29'))
    expect((fin.getTime() - debut.getTime()) / 3_600_000).toBe(7 * 24 - 1)
  })

  it('estAvant : un instant avant le début de la période', () => {
    expect(estAvant('2026-08-31T21:59:00Z', P('mois', '2026-09-10'))).toBe(true)
    expect(estAvant('2026-08-31T22:00:00Z', P('mois', '2026-09-10'))).toBe(false)
  })
})

describe('creneauxDe', () => {
  it('jour : 24 heures ; semaine : 7 jours ; année : 12 mois', () => {
    expect(creneauxDe(P('jour', '2026-09-24'))).toHaveLength(24)
    expect(creneauxDe(P('semaine', '2026-09-24'))).toHaveLength(7)
    expect(creneauxDe(P('annee', '2026-09-24'))).toHaveLength(12)
  })

  it.each([
    ['2026-02-10', 28], ['2028-02-10', 29], ['2026-09-10', 30], ['2026-10-10', 31],
  ])('mois de %s : %i barres', (ref, n) => {
    expect(creneauxDe(P('mois', ref))).toHaveLength(n)
  })

  it('semaine : les clés sont les 7 jours consécutifs, même à cheval sur deux mois', () => {
    expect(creneauxDe(P('semaine', '2026-09-30')).map(c => c.cle)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(creneauxDe(P('semaine', '2026-09-24')).map(c => c.label)).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'])
  })

  it('mois : un libellé sur cinq (1, 5, 10, 15…) pour rester lisible sur 31 barres', () => {
    const affiches = creneauxDe(P('mois', '2026-10-10')).filter(c => c.afficherLabel).map(c => c.label)
    expect(affiches).toEqual(['1', '5', '10', '15', '20', '25', '30'])
  })

  it('jour : un libellé toutes les 3 heures', () => {
    expect(creneauxDe(P('jour', '2026-09-24')).filter(c => c.afficherLabel).map(c => c.label))
      .toEqual(['0h', '3h', '6h', '9h', '12h', '15h', '18h', '21h'])
  })

  it('libellés longs lisibles', () => {
    expect(creneauxDe(P('semaine', '2026-09-24'))[3].libelleLong).toBe('jeudi 24 septembre')
    expect(creneauxDe(P('annee', '2026-09-24'))[8].libelleLong).toBe('Septembre 2026')
    expect(creneauxDe(P('jour', '2026-09-24'))[9].libelleLong).toContain('de 9h à 10h')
  })
})

describe('creneauDe / cleCreneauDuJour', () => {
  it('heure de Paris : 00 h 30 tombe dans l\'heure 00 du bon jour', () => {
    expect(creneauDe(P('jour', '2026-09-02'), '2026-09-01T22:30:00Z')).toEqual({ cle: '00', jour: '2026-09-02' })
  })

  it('jour de 25 h (25 octobre 2026) : les deux « 2 h 30 » tombent dans la même barre', () => {
    const a = creneauDe(P('jour', '2026-10-25'), '2026-10-25T00:30:00Z') // 02:30 heure d'été
    const b = creneauDe(P('jour', '2026-10-25'), '2026-10-25T01:30:00Z') // 02:30 heure d'hiver
    expect(a?.cle).toBe('02')
    expect(b?.cle).toBe('02')
  })

  it('jour de 23 h (29 mars 2026) : pas de « 2 h », 1 h 30 puis 3 h 30', () => {
    expect(creneauDe(P('jour', '2026-03-29'), '2026-03-29T00:30:00Z')?.cle).toBe('01')
    expect(creneauDe(P('jour', '2026-03-29'), '2026-03-29T01:30:00Z')?.cle).toBe('03')
  })

  it('semaine/mois : clé = jour ; année : clé = mois', () => {
    expect(creneauDe(P('mois', '2026-09-10'), '2026-09-24T10:00:00Z')?.cle).toBe('2026-09-24')
    expect(creneauDe(P('annee', '2026-09-10'), '2026-09-24T10:00:00Z')?.cle).toBe('2026-09')
    expect(creneauDe(P('annee', '2026-09-10'), 'x')).toBeNull()
  })

  it('cleCreneauDuJour : les frais n\'ont pas d\'heure', () => {
    expect(cleCreneauDuJour(P('jour', '2026-09-24'), '2026-09-24')).toBeNull()
    expect(cleCreneauDuJour(P('mois', '2026-09-24'), '2026-09-12')).toBe('2026-09-12')
    expect(cleCreneauDuJour(P('annee', '2026-09-24'), '2026-09-12')).toBe('2026-09')
  })
})

describe('rognerHeures', () => {
  const h = (n: number) => ({ cle: String(n).padStart(2, '0') })
  const toutes = Array.from({ length: 24 }, (_, i) => h(i))

  it('garde 6 h – 21 h par défaut', () => {
    const r = rognerHeures(toutes, () => false)
    expect(r[0].cle).toBe('06')
    expect(r[r.length - 1].cle).toBe('21')
    expect(r).toHaveLength(16)
  })

  it('s\'élargit aux heures qui ont de la donnée (5 h et 23 h)', () => {
    const r = rognerHeures(toutes, c => c.cle === '05' || c.cle === '23')
    expect(r[0].cle).toBe('05')
    expect(r[r.length - 1].cle).toBe('23')
  })
})

describe('divers', () => {
  it('ajouterJours traverse les mois, les années et le 29 février', () => {
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
    expect(ajouterJours('2028-02-28', 1)).toBe('2028-02-29')
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('libelleComparaison', () => {
    expect(libelleComparaison('semaine')).toBe('par rapport à la semaine précédente')
    expect(libelleComparaison('jour')).toBe('par rapport à la veille')
    expect(libelleComparaison('mois')).toBe('par rapport au mois précédent')
    expect(libelleComparaison('annee')).toBe("par rapport à l'année précédente")
  })

  it('formaterJour', () => {
    expect(formaterJour('2026-09-24')).toBe('24 septembre 2026')
  })

  it('le 1er se lit « 1er », le 11 et le 21 restent tels quels', () => {
    expect(formaterJour('2026-09-01')).toBe('1er septembre 2026')
    expect(formaterJour('2026-09-11')).toBe('11 septembre 2026')
    expect(formaterJour('2026-09-21')).toBe('21 septembre 2026')
    expect(creneauxDe(P('mois', '2026-09-10'))[0].libelleLong).toBe('mardi 1er septembre')
  })
})
