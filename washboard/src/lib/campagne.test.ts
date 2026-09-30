import { describe, it, expect } from 'vitest'
import {
  cleDepuisNom, cleUnique, erreurCampagne, estEnCours, bilanCampagne,
  lienCampagne, estPlateforme, labelPlateforme, PLATEFORMES,
  bilansParCampagne, type Campagne,
} from './campagne'

// ─────────────────────────────────────────────────────────────────────────────
// Le laveur déclare sa campagne, colle le lien dans sa publicité, et WashBoard
// lui dit si elle lui rapporte de l'argent. Tout se joue sur la clé qui voyage
// dans l'URL : si elle se perd, les réservations tombent dans « Accès direct »
// et il conclut que sa pub ne marche pas.
// ─────────────────────────────────────────────────────────────────────────────

describe('cleDepuisNom', () => {
  it('rend une clé qui survit à un passage dans une URL', () => {
    expect(cleDepuisNom('Pub Rentrée 2026')).toBe('pub-rentree-2026')
  })

  it('retire les accents plutôt que de les encoder', () => {
    // « rentrée » encodé devient « rentr%C3%A9e » : illisible dans le
    // gestionnaire de publicités, et réécrit par certains d'entre eux.
    expect(cleDepuisNom('Été à Auxerre')).toBe('ete-a-auxerre')
  })

  it('écrase les séparations multiples et ne laisse pas de tiret aux bouts', () => {
    expect(cleDepuisNom('  Pub   —  été !! ')).toBe('pub-ete')
  })

  it('tronque sans laisser un tiret orphelin', () => {
    const cle = cleDepuisNom('a'.repeat(30) + ' ' + 'b'.repeat(30))
    expect(cle.length).toBeLessThanOrEqual(40)
    expect(cle.endsWith('-')).toBe(false)
  })

  it('rend une chaîne vide quand il n’y a rien d’utilisable', () => {
    // À l'appelant de refuser : fabriquer une clé vide collerait toutes les
    // campagnes du laveur dans le même sac.
    expect(cleDepuisNom('🚗🚗🚗')).toBe('')
    expect(cleDepuisNom('!!! ???')).toBe('')
  })
})

describe('cleUnique', () => {
  it('garde la clé quand elle est libre', () => {
    expect(cleUnique('pub-rentree', ['autre-pub'])).toBe('pub-rentree')
  })

  it('suffixe plutôt que de mélanger deux campagnes', () => {
    // Deux campagnes sur la même clé additionneraient leurs visites et leurs
    // réservations : le laveur comparerait un budget à des chiffres qui ne lui
    // correspondent pas. Mieux vaut un nom moins joli qu'un bilan faux.
    expect(cleUnique('pub-rentree', ['pub-rentree'])).toBe('pub-rentree-2')
    expect(cleUnique('pub-rentree', ['pub-rentree', 'pub-rentree-2'])).toBe('pub-rentree-3')
  })

  it('ne dépasse jamais la longueur maximale, même en suffixant', () => {
    const longue = 'a'.repeat(40)
    const cle = cleUnique(longue, [longue])
    expect(cle.length).toBeLessThanOrEqual(40)
    expect(cle).not.toBe(longue)
  })

  it('rend une chaîne vide sur une base vide', () => {
    expect(cleUnique('', ['x'])).toBe('')
  })
})

describe('erreurCampagne', () => {
  const valide = { nom: 'Pub Rentrée', budget: 80, debut: '2026-09-01', fin: '2026-09-30' }

  it('accepte une campagne complète', () => {
    expect(erreurCampagne(valide)).toBeNull()
  })

  it('accepte une campagne sans date de fin', () => {
    // Le laveur n'a pas toujours une fin en tête : l'obliger à en inventer une
    // fausserait son bilan le jour où il prolonge.
    expect(erreurCampagne({ ...valide, fin: null })).toBeNull()
  })

  it('accepte un budget nul', () => {
    // Une campagne à 0 € existe : un échange, une publication sponsorisée
    // offerte. Le retour n'a alors pas de sens, mais les visites si.
    expect(erreurCampagne({ ...valide, budget: 0 })).toBeNull()
  })

  it('refuse un nom vide ou sans caractère utilisable', () => {
    expect(erreurCampagne({ ...valide, nom: '   ' })).toBe('nom')
    expect(erreurCampagne({ ...valide, nom: '🚗' })).toBe('cle')
  })

  it('refuse un budget absent, négatif ou illisible', () => {
    expect(erreurCampagne({ ...valide, budget: null })).toBe('budget')
    expect(erreurCampagne({ ...valide, budget: -10 })).toBe('budget')
    expect(erreurCampagne({ ...valide, budget: NaN })).toBe('budget')
  })

  it('refuse une fin antérieure au début', () => {
    expect(erreurCampagne({ ...valide, debut: '2026-09-30', fin: '2026-09-01' })).toBe('dates')
  })

  it('refuse une campagne sans date de début', () => {
    expect(erreurCampagne({ ...valide, debut: null })).toBe('dates')
  })
})

describe('estEnCours', () => {
  const c = { debut: '2026-09-01', fin: '2026-09-30' }

  it('est en cours entre ses deux bornes, incluses', () => {
    expect(estEnCours(c, '2026-09-01')).toBe(true)
    expect(estEnCours(c, '2026-09-15')).toBe(true)
    expect(estEnCours(c, '2026-09-30')).toBe(true)
  })

  it('ne l’est ni avant ni après', () => {
    expect(estEnCours(c, '2026-08-31')).toBe(false)
    expect(estEnCours(c, '2026-10-01')).toBe(false)
  })

  it('sans date de fin, reste en cours indéfiniment', () => {
    expect(estEnCours({ debut: '2026-09-01', fin: null }, '2030-01-01')).toBe(true)
    expect(estEnCours({ debut: '2026-09-01', fin: null }, '2026-08-31')).toBe(false)
  })
})

describe('bilanCampagne', () => {
  it('calcule ce qu’un laveur veut savoir', () => {
    const b = bilanCampagne({ budget: 80, visites: 312, reservations: 14, chiffreAffaires: 910 })
    expect(b.tauxConversion).toBeCloseTo(4.487, 2)
    expect(b.coutParReservation).toBeCloseTo(5.714, 2)
    expect(b.retour).toBeCloseTo(11.375, 2)
  })

  it('rend null plutôt que zéro quand le ratio n’a pas de sens', () => {
    // Afficher « 0 % » et « 0 € » à quelqu'un dont la campagne démarre lui
    // ferait conclure qu'elle ne marche pas, alors qu'elle n'a pas encore eu
    // le temps de marcher.
    const neuve = bilanCampagne({ budget: 80, visites: 0, reservations: 0, chiffreAffaires: 0 })
    expect(neuve.tauxConversion).toBeNull()
    expect(neuve.coutParReservation).toBeNull()
    expect(neuve.retour).toBe(0)
  })

  it('n’invente pas de retour sur un budget nul', () => {
    // Division par zéro : sans ce garde-fou, l'écran afficherait « × Infinity ».
    const offerte = bilanCampagne({ budget: 0, visites: 100, reservations: 3, chiffreAffaires: 195 })
    expect(offerte.retour).toBeNull()
    expect(offerte.coutParReservation).toBe(0)
  })

  it('recopie les comptages sans les retoucher', () => {
    const b = bilanCampagne({ budget: 50, visites: 7, reservations: 2, chiffreAffaires: 130 })
    expect(b.visites).toBe(7)
    expect(b.reservations).toBe(2)
    expect(b.chiffreAffaires).toBe(130)
  })
})

describe('lienCampagne', () => {
  const base = 'https://www.washboard.fr/book/autonettoyage'

  it('porte la source ET la campagne', () => {
    // Sans `utm_source`, la visite retomberait dans « Accès direct » au CRM
    // pendant qu'elle compterait pour la campagne : deux écrans qui se
    // contredisent sur la même visite.
    expect(lienCampagne(base, 'pub-rentree', 'meta'))
      .toBe(`${base}?utm_source=facebook&utm_campaign=pub-rentree`)
  })

  it('traduit Meta vers la source déjà connue du CRM', () => {
    expect(lienCampagne(base, 'x', 'meta')).toContain('utm_source=facebook')
    expect(lienCampagne(base, 'x', 'google')).toContain('utm_source=google')
    expect(lienCampagne(base, 'x', 'tiktok')).toContain('utm_source=tiktok')
  })

  it('échappe ce qui doit l’être', () => {
    expect(lienCampagne(base, 'a b', 'autre')).toContain('utm_campaign=a%20b')
  })
})

describe('plateformes', () => {
  it('reconnaît les plateformes connues, et elles seules', () => {
    for (const p of PLATEFORMES) expect(estPlateforme(p.cle)).toBe(true)
    expect(estPlateforme('snapchat')).toBe(false)
    expect(estPlateforme(null)).toBe(false)
    expect(estPlateforme(42)).toBe(false)
  })

  it('donne un libellé à chacune', () => {
    for (const p of PLATEFORMES) expect(labelPlateforme(p.cle)).toBe(p.label)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// L'agrégation. C'est elle qui décide des chiffres que le laveur lira pour
// juger sa publicité — une erreur ici lui fait couper une campagne qui
// marchait, ou en prolonger une qui lui coûte de l'argent.
// ─────────────────────────────────────────────────────────────────────────────

describe('bilansParCampagne', () => {
  const campagne: Campagne = {
    id: 'c1', nom: 'Pub Rentrée', plateforme: 'meta', budget: 80,
    cle: 'pub-rentree', debut: '2026-09-01', fin: '2026-09-30',
  }

  it('compte les SESSIONS distinctes, pas les événements', () => {
    // Un visiteur qui parcourt les quatre étapes produit quatre événements.
    // Les compter gonflerait le trafic d'un facteur quatre, et écraserait le
    // taux de conversion d'autant.
    const visites = ['prestation', 'creneau', 'coordonnees', 'confirmation'].map(() => ({
      session_id: 's1', utm_campaign: 'pub-rentree', created_at: '2026-09-10T10:00:00Z',
    }))
    visites.push({ session_id: 's2', utm_campaign: 'pub-rentree', created_at: '2026-09-11T10:00:00Z' })
    const b = bilansParCampagne([campagne], visites, [])
    expect(b.get('c1')!.visites).toBe(2)
  })

  it('additionne les réservations et leur chiffre d\u2019affaires', () => {
    const b = bilansParCampagne([campagne], [], [
      { utm_campaign: 'pub-rentree', created_at: '2026-09-12T10:00:00Z', booked_price: 65 },
      { utm_campaign: 'pub-rentree', created_at: '2026-09-15T10:00:00Z', booked_price: 90 },
    ])
    expect(b.get('c1')!.reservations).toBe(2)
    expect(b.get('c1')!.chiffreAffaires).toBe(155)
  })

  it('écarte les réservations annulées, du nombre ET du montant', () => {
    // Un rendez-vous annulé n'a rien rapporté. L'inclure rendrait le retour
    // affiché mensonger — et c'est sur ce chiffre que le laveur décide.
    const b = bilansParCampagne([campagne], [], [
      { utm_campaign: 'pub-rentree', created_at: '2026-09-12T10:00:00Z', booked_price: 65 },
      { utm_campaign: 'pub-rentree', created_at: '2026-09-13T10:00:00Z', booked_price: 90, status: 'cancelled' },
    ])
    expect(b.get('c1')!.reservations).toBe(1)
    expect(b.get('c1')!.chiffreAffaires).toBe(65)
  })

  it('ne compte que ce qui tombe dans la période déclarée', () => {
    const b = bilansParCampagne([campagne], [
      { session_id: 'avant', utm_campaign: 'pub-rentree', created_at: '2026-08-31T23:00:00Z' },
      { session_id: 'dedans', utm_campaign: 'pub-rentree', created_at: '2026-09-15T10:00:00Z' },
      { session_id: 'apres', utm_campaign: 'pub-rentree', created_at: '2026-10-01T08:00:00Z' },
    ], [])
    expect(b.get('c1')!.visites).toBe(1)
  })

  it('compte le dernier jour EN ENTIER', () => {
    // Le laveur saisit « jusqu'au 30 septembre » et entend le 30 inclus.
    // Comparer une date ISO complète à « 2026-09-30 » couperait la journée.
    const b = bilansParCampagne([campagne], [
      { session_id: 's', utm_campaign: 'pub-rentree', created_at: '2026-09-30T23:59:00Z' },
    ], [])
    expect(b.get('c1')!.visites).toBe(1)
  })

  it('sans date de fin, compte jusqu\u2019à aujourd\u2019hui et au-delà', () => {
    const ouverte = { ...campagne, fin: null }
    const b = bilansParCampagne([ouverte], [
      { session_id: 's', utm_campaign: 'pub-rentree', created_at: '2030-01-01T10:00:00Z' },
    ], [])
    expect(b.get('c1')!.visites).toBe(1)
  })

  it('ne mélange jamais deux campagnes', () => {
    const autre: Campagne = { ...campagne, id: 'c2', cle: 'pub-ete', nom: 'Pub Été' }
    const b = bilansParCampagne([campagne, autre], [
      { session_id: 'a', utm_campaign: 'pub-rentree', created_at: '2026-09-10T10:00:00Z' },
      { session_id: 'b', utm_campaign: 'pub-ete', created_at: '2026-09-10T10:00:00Z' },
    ], [])
    expect(b.get('c1')!.visites).toBe(1)
    expect(b.get('c2')!.visites).toBe(1)
  })

  it('donne un bilan à zéro, jamais d\u2019absence, pour une campagne sans trafic', () => {
    // L'écran doit pouvoir l'afficher sans cas particulier.
    const b = bilansParCampagne([campagne], [], [])
    expect(b.get('c1')).toBeDefined()
    expect(b.get('c1')!.visites).toBe(0)
    expect(b.get('c1')!.tauxConversion).toBeNull()
  })

  it('ignore ce qui ne porte aucune campagne, ou une campagne inconnue', () => {
    const b = bilansParCampagne([campagne], [
      { session_id: 'x', utm_campaign: null, created_at: '2026-09-10T10:00:00Z' },
      { session_id: 'y', utm_campaign: 'campagne-supprimee', created_at: '2026-09-10T10:00:00Z' },
    ], [])
    expect(b.get('c1')!.visites).toBe(0)
  })

  it('compte zéro pour une réservation sans prix, sans fausser le total', () => {
    const b = bilansParCampagne([campagne], [], [
      { utm_campaign: 'pub-rentree', created_at: '2026-09-12T10:00:00Z', booked_price: null },
      { utm_campaign: 'pub-rentree', created_at: '2026-09-13T10:00:00Z', booked_price: 65 },
    ])
    expect(b.get('c1')!.reservations).toBe(2)
    expect(b.get('c1')!.chiffreAffaires).toBe(65)
  })
})
