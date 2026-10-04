import { describe, it, expect } from 'vitest'
import {
  cleDepuisNom, cleUnique, erreurCampagne, estEnCours, bilanCampagne,
  lienCampagne, estPlateforme, labelPlateforme, PLATEFORMES,
  bilansParCampagne, type Campagne,
  inventaireFormats, erreurCreation, lienCreation, estFiable, SEUIL_FIABILITE,
  bilansParCreation, resteHorsCreations, synthese, type Creation,
  joursDepuisBudget, budgetAVerifier, BUDGET_A_VERIFIER_JOURS,
  toutesLesCreations, parPlateforme,
  type CampagneAffichee, type Plateforme,
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

// ─────────────────────────────────────────────────────────────────────────────
// Les créations : une ligne par vidéo. Ce qui se joue ici, c'est la décision
// « laquelle je garde, laquelle je coupe ». Un chiffre faux à ce niveau ne fait
// pas juste une statistique fausse : il fait couper la vidéo qui rapportait.
// ─────────────────────────────────────────────────────────────────────────────

describe('inventaireFormats', () => {
  it('résume la campagne en une ligne lisible', () => {
    expect(inventaireFormats([
      { format: 'video' }, { format: 'video' }, { format: 'image' },
    ])).toBe('2 vidéos, 1 image')
  })

  it('accorde le singulier', () => {
    expect(inventaireFormats([{ format: 'video' }])).toBe('1 vidéo')
  })

  it('suit toujours le même ordre, quel que soit celui de la saisie', () => {
    // Deux campagnes identiques ne doivent pas produire deux phrases
    // différentes : l'œil croirait que quelque chose a changé.
    const a = inventaireFormats([{ format: 'image' }, { format: 'video' }])
    const b = inventaireFormats([{ format: 'video' }, { format: 'image' }])
    expect(a).toBe(b)
    expect(a).toBe('1 vidéo, 1 image')
  })

  it('ne rend rien sans création', () => {
    expect(inventaireFormats([])).toBe('')
  })
})

describe('erreurCreation', () => {
  it('accepte un nom seul : le budget par vidéo est facultatif', () => {
    // Meta répartit souvent le budget tout seul entre les publicités. Rendre le
    // budget obligatoire ferait inventer un chiffre, ou abandonner la saisie.
    expect(erreurCreation({ nom: 'Avant/après Clio' })).toBeNull()
    expect(erreurCreation({ nom: 'Avant/après Clio', budget: null })).toBeNull()
    expect(erreurCreation({ nom: 'Avant/après Clio', budget: 0 })).toBeNull()
  })

  it('refuse un nom vide ou impossible à mettre dans une URL', () => {
    expect(erreurCreation({ nom: '  ' })).toBe('nom')
    expect(erreurCreation({ nom: '🎬🎬' })).toBe('cle')
  })

  it('refuse un budget négatif ou absurde', () => {
    expect(erreurCreation({ nom: 'Vidéo 1', budget: -5 })).toBe('budget')
    expect(erreurCreation({ nom: 'Vidéo 1', budget: Number.NaN })).toBe('budget')
  })
})

describe('lienCreation', () => {
  it('ajoute la création au lien de la campagne, sans le remplacer', () => {
    // La campagne DOIT rester dans le lien : sans elle, la visite ne se
    // rattache à aucun budget, et le bilan de la campagne perdrait la vidéo.
    expect(lienCreation('https://www.washboard.fr/book/kookii', 'pub-rentree', 'avant-apres', 'meta'))
      .toBe('https://www.washboard.fr/book/kookii?utm_source=facebook&utm_campaign=pub-rentree&utm_content=avant-apres')
  })
})

describe('bilanCampagne, budget inconnu', () => {
  it('ne prétend pas qu’une vidéo est gratuite quand son budget est inconnu', () => {
    // `0 € par client` sur une vidéo dont on ignore le budget est un mensonge,
    // et c'est le mensonge qui la ferait garder à tort.
    const b = bilanCampagne({ budget: null, visites: 100, reservations: 4, chiffreAffaires: 260 })
    expect(b.coutParReservation).toBeNull()
    expect(b.retour).toBeNull()
    // Ce qu'on sait, on le dit quand même.
    expect(b.reservations).toBe(4)
    expect(b.chiffreAffaires).toBe(260)
    expect(b.tauxConversion).toBe(4)
  })
})

describe('estFiable', () => {
  it('ne laisse pas lire un taux calculé sur une poignée de visites', () => {
    // 1 réservation sur 3 visites affiche 33 % et paraît excellent : c'est du
    // hasard, et un laveur y croirait.
    expect(estFiable(3)).toBe(false)
    expect(estFiable(SEUIL_FIABILITE - 1)).toBe(false)
    expect(estFiable(SEUIL_FIABILITE)).toBe(true)
  })
})

describe('bilansParCreation', () => {
  const campagne: Campagne = {
    id: 'c1', nom: 'Pub Rentrée', plateforme: 'meta', budget: 100,
    cle: 'pub-rentree', debut: '2026-09-01', fin: '2026-09-30',
  }
  const creations: Creation[] = [
    { id: 'v1', campagne_id: 'c1', nom: 'Avant/après', format: 'video', cle: 'avant-apres', budget: 60 },
    { id: 'v2', campagne_id: 'c1', nom: 'Témoignage',  format: 'video', cle: 'temoignage',  budget: null },
    { id: 'v3', campagne_id: 'c1', nom: 'Photo',       format: 'image', cle: 'photo',       budget: 40 },
  ]

  function visite(cle: string | null, session: string, jour = '2026-09-10') {
    return { session_id: session, utm_campaign: 'pub-rentree', utm_content: cle, created_at: `${jour}T10:00:00Z` }
  }
  function reservation(cle: string | null, prix: number, jour = '2026-09-10') {
    return { utm_campaign: 'pub-rentree', utm_content: cle, created_at: `${jour}T11:00:00Z`, booked_price: prix }
  }

  it('sépare les vidéos plutôt que de rendre une moyenne', () => {
    const b = bilansParCreation(campagne, creations, [
      visite('avant-apres', 's1'), visite('avant-apres', 's2'),
      visite('temoignage', 's3'),
    ], [
      reservation('avant-apres', 65),
    ])

    const parCle = new Map(b.map(x => [x.creation.cle, x]))
    expect(parCle.get('avant-apres')!.visites).toBe(2)
    expect(parCle.get('avant-apres')!.reservations).toBe(1)
    expect(parCle.get('temoignage')!.visites).toBe(1)
    expect(parCle.get('temoignage')!.reservations).toBe(0)
    expect(parCle.get('photo')!.visites).toBe(0)
  })

  it('compte une session une seule fois, même après quatre étapes de formulaire', () => {
    // Quelqu'un qui parcourt le formulaire produit plusieurs événements.
    // Les compter tous diviserait le taux de transformation par quatre.
    const b = bilansParCreation(campagne, creations, [
      visite('avant-apres', 's1'), visite('avant-apres', 's1'),
      visite('avant-apres', 's1'), visite('avant-apres', 's1'),
    ], [])
    expect(b.find(x => x.creation.cle === 'avant-apres')!.visites).toBe(1)
  })

  it('classe par réservations, jamais par taux', () => {
    // La vidéo à 1/2 affiche 50 %, celle à 5/200 affiche 2,5 %. Classer par
    // taux mettrait la première en tête et ferait couper celle qui rapporte.
    const beaucoup = Array.from({ length: 200 }, (_, i) => visite('temoignage', `t${i}`))
    const b = bilansParCreation(campagne, creations, [
      visite('avant-apres', 'a1'), visite('avant-apres', 'a2'),
      ...beaucoup,
    ], [
      reservation('avant-apres', 65),
      ...Array.from({ length: 5 }, () => reservation('temoignage', 50)),
    ])
    expect(b[0].creation.cle).toBe('temoignage')
    expect(b[0].reservations).toBe(5)
  })

  it('rend un ordre stable quand tout est à égalité', () => {
    const a = bilansParCreation(campagne, creations, [], [])
    const b = bilansParCreation(campagne, [...creations].reverse(), [], [])
    expect(a.map(x => x.creation.cle)).toEqual(b.map(x => x.creation.cle))
  })

  it('donne la part de chaque vidéo dans les réservations de la campagne', () => {
    const b = bilansParCreation(campagne, creations, [], [
      reservation('avant-apres', 65), reservation('avant-apres', 65),
      reservation('temoignage', 50),
    ])
    const parCle = new Map(b.map(x => [x.creation.cle, x]))
    expect(parCle.get('avant-apres')!.partReservations).toBeCloseTo(66.67, 1)
    expect(parCle.get('temoignage')!.partReservations).toBeCloseTo(33.33, 1)
  })

  it('compte la part sur TOUTES les réservations de la campagne, créations comprises ou non', () => {
    // Le laveur a lancé sa campagne, puis déclaré ses vidéos trois jours après.
    // Les premières réservations ne portent aucune création : les ignorer
    // gonflerait la part des vidéos jusqu'à 100 % et surestimerait leur rôle.
    const b = bilansParCreation(campagne, creations, [], [
      reservation(null, 65), reservation(null, 65), reservation(null, 65),
      reservation('avant-apres', 65),
    ])
    expect(b.find(x => x.creation.cle === 'avant-apres')!.partReservations).toBe(25)
  })

  it('n’attribue rien hors de la période déclarée, ni d’une autre campagne', () => {
    const b = bilansParCreation(campagne, creations, [
      visite('avant-apres', 's1', '2026-08-31'),
      { session_id: 's2', utm_campaign: 'autre-pub', utm_content: 'avant-apres', created_at: '2026-09-10T10:00:00Z' },
    ], [
      reservation('avant-apres', 65, '2026-10-01'),
    ])
    const v = b.find(x => x.creation.cle === 'avant-apres')!
    expect(v.visites).toBe(0)
    expect(v.reservations).toBe(0)
  })

  it('compte le dernier jour de la campagne en entier', () => {
    const b = bilansParCreation(campagne, creations, [visite('avant-apres', 's1', '2026-09-30')], [])
    expect(b.find(x => x.creation.cle === 'avant-apres')!.visites).toBe(1)
  })

  it('ignore les réservations annulées, comme partout ailleurs', () => {
    const b = bilansParCreation(campagne, creations, [], [
      { ...reservation('avant-apres', 65), status: 'cancelled' },
      reservation('avant-apres', 65),
    ])
    const v = b.find(x => x.creation.cle === 'avant-apres')!
    expect(v.reservations).toBe(1)
    expect(v.chiffreAffaires).toBe(65)
  })

  it('ne mélange jamais les créations de deux campagnes', () => {
    const autre: Creation = {
      id: 'x1', campagne_id: 'c2', nom: 'Vidéo d’une autre campagne',
      format: 'video', cle: 'avant-apres', budget: null,
    }
    const b = bilansParCreation(campagne, [...creations, autre], [], [])
    expect(b.map(x => x.creation.id)).not.toContain('x1')
  })

  it('laisse le coût par client vide quand le budget de la vidéo est inconnu', () => {
    const b = bilansParCreation(campagne, creations, [], [reservation('temoignage', 50)])
    const v = b.find(x => x.creation.cle === 'temoignage')!
    expect(v.coutParReservation).toBeNull()
    expect(v.retour).toBeNull()
    expect(v.chiffreAffaires).toBe(50)
  })
})

describe('resteHorsCreations', () => {
  const campagne: Campagne = {
    id: 'c1', nom: 'Pub', plateforme: 'meta', budget: 100,
    cle: 'pub', debut: '2026-09-01', fin: null,
  }

  it('montre ce qui est arrivé avant que les vidéos soient déclarées', () => {
    // Sans cette ligne, la somme des vidéos ne fait pas le total de la
    // campagne, et le laveur a raison de ne plus croire l'écran.
    const bilanC = bilanCampagne({ budget: 100, visites: 50, reservations: 5, chiffreAffaires: 325 })
    const parCreation = bilansParCreation(
      campagne,
      [{ id: 'v1', campagne_id: 'c1', nom: 'V1', format: 'video', cle: 'v1', budget: null }],
      [{ session_id: 's1', utm_campaign: 'pub', utm_content: 'v1', created_at: '2026-09-10T10:00:00Z' }],
      [{ utm_campaign: 'pub', utm_content: 'v1', created_at: '2026-09-10T11:00:00Z', booked_price: 65 }],
    )
    const reste = resteHorsCreations(bilanC, parCreation)
    expect(reste.visites).toBe(49)
    expect(reste.reservations).toBe(4)
    expect(reste.chiffreAffaires).toBe(260)
  })

  it('ne descend jamais sous zéro', () => {
    // Une visite peut porter une création supprimée depuis : afficher
    // « −3 visites » ferait douter de tout l'écran.
    const bilanC = bilanCampagne({ budget: 100, visites: 1, reservations: 0, chiffreAffaires: 0 })
    const reste = resteHorsCreations(bilanC, [{
      creation: { id: 'v1', campagne_id: 'c1', nom: 'V1', format: 'video', cle: 'v1', budget: null },
      visites: 5, reservations: 2, chiffreAffaires: 130,
      tauxConversion: 40, coutParReservation: null, retour: null,
      partReservations: null, fiable: false,
    }])
    expect(reste.visites).toBe(0)
    expect(reste.reservations).toBe(0)
    expect(reste.chiffreAffaires).toBe(0)
  })
})

describe('synthese', () => {
  it('recalcule le retour global au lieu de moyenner les retours', () => {
    // Moyenner « ×3 » et « ×0,5 » donnerait ×1,75. La vérité est
    // (300 + 25) / (100 + 50) = ×2,17 : une petite campagne rentable ne doit
    // pas peser autant qu'une grosse qui perd de l'argent.
    const s = synthese([
      bilanCampagne({ budget: 100, visites: 200, reservations: 5, chiffreAffaires: 300 }),
      bilanCampagne({ budget: 50,  visites: 100, reservations: 1, chiffreAffaires: 25 }),
    ], [100, 50])
    expect(s.budget).toBe(150)
    expect(s.chiffreAffaires).toBe(325)
    expect(s.retour).toBeCloseTo(2.17, 2)
    expect(s.coutParReservation).toBeCloseTo(25, 2)
  })

  it('ne divise pas par zéro sans campagne', () => {
    const s = synthese([], [])
    expect(s.retour).toBeNull()
    expect(s.coutParReservation).toBeNull()
    expect(s.budget).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Un budget déclaré vieillit, et il vieillit dans le sens dangereux : les
// réservations continuent de s'additionner pendant que la dépense reste figée,
// donc le retour affiché monte tout seul. Ce qui se joue ici, c'est un laveur
// qui remet de l'argent sur une campagne en croyant qu'elle rapporte ×8.
// ─────────────────────────────────────────────────────────────────────────────

describe('joursDepuisBudget', () => {
  const MAINTENANT = new Date('2026-10-01T12:00:00Z').getTime()

  it('compte les jours depuis la dernière saisie', () => {
    expect(joursDepuisBudget({ budget_maj_le: '2026-09-01T12:00:00Z' }, MAINTENANT)).toBe(30)
  })

  it('ne sait rien d’une campagne antérieure au suivi', () => {
    // Migration 009 : les campagnes créées avant n'ont pas cette date. Mieux
    // vaut ne rien dire que d'inventer « 0 jour », qui ferait passer un vieux
    // budget pour un budget frais.
    expect(joursDepuisBudget({ budget_maj_le: null }, MAINTENANT)).toBeNull()
    expect(joursDepuisBudget({ budget_maj_le: undefined }, MAINTENANT)).toBeNull()
    expect(joursDepuisBudget({ budget_maj_le: 'pas une date' }, MAINTENANT)).toBeNull()
  })

  it('ne rend jamais un nombre de jours négatif', () => {
    // Horloge déréglée : « il y a −3 jours » ferait douter de tout l'écran.
    expect(joursDepuisBudget({ budget_maj_le: '2026-10-05T12:00:00Z' }, MAINTENANT)).toBe(0)
  })
})

describe('budgetAVerifier', () => {
  const MAINTENANT = new Date('2026-10-01T12:00:00Z').getTime()
  const vieux = '2026-08-01T12:00:00Z'   // 61 jours
  const recent = '2026-09-28T12:00:00Z'  // 3 jours

  it('alerte sur une campagne sans date de fin dont le budget traîne', () => {
    // Le cas qui motive tout : une publicité laissée tourner des mois.
    expect(budgetAVerifier(
      { budget_maj_le: vieux, debut: '2026-07-01', fin: null }, '2026-10-01', MAINTENANT,
    )).toBe(true)
  })

  it('n’alerte pas sur une campagne TERMINÉE', () => {
    // Son budget est définitif : réclamer une mise à jour serait du bruit, et
    // le bruit fait ignorer l'avertissement le jour où il compte.
    expect(budgetAVerifier(
      { budget_maj_le: vieux, debut: '2026-07-01', fin: '2026-08-15' }, '2026-10-01', MAINTENANT,
    )).toBe(false)
  })

  it('n’alerte pas sur une campagne qui vient d’être mise à jour', () => {
    expect(budgetAVerifier(
      { budget_maj_le: recent, debut: '2026-07-01', fin: null }, '2026-10-01', MAINTENANT,
    )).toBe(false)
  })

  it('n’alerte pas quand on ignore la date de saisie', () => {
    expect(budgetAVerifier(
      { budget_maj_le: null, debut: '2026-07-01', fin: null }, '2026-10-01', MAINTENANT,
    )).toBe(false)
  })

  it('n’alerte pas sur une campagne qui n’a pas encore commencé', () => {
    expect(budgetAVerifier(
      { budget_maj_le: vieux, debut: '2026-12-01', fin: null }, '2026-10-01', MAINTENANT,
    )).toBe(false)
  })

  it('bascule pile au seuil, pas un jour avant', () => {
    const veille = new Date(MAINTENANT - (BUDGET_A_VERIFIER_JOURS - 1) * 86400000).toISOString()
    const seuil  = new Date(MAINTENANT - BUDGET_A_VERIFIER_JOURS * 86400000).toISOString()
    const base = { debut: '2026-07-01', fin: null }
    expect(budgetAVerifier({ ...base, budget_maj_le: veille }, '2026-10-01', MAINTENANT)).toBe(false)
    expect(budgetAVerifier({ ...base, budget_maj_le: seuil }, '2026-10-01', MAINTENANT)).toBe(true)
  })
})

describe('estEnCours — campagne sans fin prévue', () => {
  it('reste en cours indéfiniment', () => {
    // Le cas courant : un laveur laisse tourner sa publicité sans date de fin.
    // Elle doit compter ses visites et ses réservations des mois plus tard.
    expect(estEnCours({ debut: '2026-01-01', fin: null }, '2026-10-01')).toBe(true)
    expect(estEnCours({ debut: '2026-01-01', fin: null }, '2027-06-15')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Le bilan additionne. Ce qui s'y joue : « laquelle de TOUTES mes vidéos
// marche » et « quelle plateforme me rapporte » — deux questions qu'aucune
// carte de campagne isolée ne peut trancher, et deux réponses sur lesquelles
// un laveur déplace son budget.
// ─────────────────────────────────────────────────────────────────────────────

function campagneFactice(
  id: string, nomCampagne: string, plateforme: Plateforme, budget: number,
  bilanValeurs: { visites: number; reservations: number; chiffreAffaires: number },
  creations: { id: string; nom: string; reservations: number; chiffreAffaires: number; visites: number }[] = [],
): CampagneAffichee {
  return {
    id, nom: nomCampagne, plateforme, budget, cle: id,
    debut: '2026-01-01', fin: null, budget_maj_le: null,
    bilan: bilanCampagne({ budget, ...bilanValeurs }),
    creations: creations.map(c => ({
      creation: { id: c.id, campagne_id: id, nom: c.nom, format: 'video' as const, cle: c.id, budget: null },
      ...bilanCampagne({ budget: null, visites: c.visites, reservations: c.reservations, chiffreAffaires: c.chiffreAffaires }),
      partReservations: null,
      fiable: estFiable(c.visites),
    })),
    reste: { visites: 0, reservations: 0, chiffreAffaires: 0 },
  }
}

describe('toutesLesCreations', () => {
  it('mélange les campagnes pour les classer ensemble', () => {
    // Tout l'intérêt : la meilleure vidéo d'une petite campagne peut battre
    // celle d'une grosse, et aucune carte isolée ne le montre.
    const liste = toutesLesCreations([
      campagneFactice('a', 'Grosse pub', 'meta', 500, { visites: 400, reservations: 4, chiffreAffaires: 260 },
        [{ id: 'a1', nom: 'Vidéo A', reservations: 4, chiffreAffaires: 260, visites: 400 }]),
      campagneFactice('b', 'Petite pub', 'tiktok', 40, { visites: 60, reservations: 7, chiffreAffaires: 455 },
        [{ id: 'b1', nom: 'Vidéo B', reservations: 7, chiffreAffaires: 455, visites: 60 }]),
    ])
    expect(liste.map(v => v.creation.id)).toEqual(['b1', 'a1'])
  })

  it('garde le nom de la campagne d’origine', () => {
    // Deux vidéos « Avant/après » venues de deux campagnes seraient sinon
    // impossibles à distinguer dans la liste.
    const liste = toutesLesCreations([
      campagneFactice('a', 'Pub Rentrée', 'meta', 100, { visites: 10, reservations: 1, chiffreAffaires: 65 },
        [{ id: 'a1', nom: 'Avant/après', reservations: 1, chiffreAffaires: 65, visites: 10 }]),
    ])
    expect(liste[0].campagne).toBe('Pub Rentrée')
  })

  it('rend une liste vide sans créations', () => {
    expect(toutesLesCreations([
      campagneFactice('a', 'Pub', 'meta', 100, { visites: 10, reservations: 0, chiffreAffaires: 0 }),
    ])).toEqual([])
  })
})

describe('parPlateforme', () => {
  it('regroupe les campagnes d’une même plateforme', () => {
    const r = parPlateforme([
      campagneFactice('a', 'Pub 1', 'meta', 100, { visites: 200, reservations: 5, chiffreAffaires: 300 }),
      campagneFactice('b', 'Pub 2', 'meta', 50, { visites: 100, reservations: 1, chiffreAffaires: 25 }),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].campagnes).toBe(2)
    expect(r[0].budget).toBe(150)
    expect(r[0].chiffreAffaires).toBe(325)
  })

  it('RECALCULE le retour au lieu de moyenner celui des campagnes', () => {
    // Moyenner ×3 et ×0,5 donnerait ×1,75. La vérité est 325/150 = ×2,17 :
    // une petite campagne rentable ne doit pas peser autant qu'une grosse qui
    // perd de l'argent, sinon on abandonne une plateforme qui marche.
    const r = parPlateforme([
      campagneFactice('a', 'Pub 1', 'meta', 100, { visites: 200, reservations: 5, chiffreAffaires: 300 }),
      campagneFactice('b', 'Pub 2', 'meta', 50, { visites: 100, reservations: 1, chiffreAffaires: 25 }),
    ])
    expect(r[0].retour).toBeCloseTo(2.17, 2)
    expect(r[0].coutParReservation).toBeCloseTo(25, 2)
  })

  it('sépare les plateformes et les classe par chiffre encaissé', () => {
    const r = parPlateforme([
      campagneFactice('a', 'Meta', 'meta', 100, { visites: 200, reservations: 2, chiffreAffaires: 130 }),
      campagneFactice('b', 'TikTok', 'tiktok', 40, { visites: 90, reservations: 6, chiffreAffaires: 390 }),
    ])
    expect(r.map(p => p.plateforme)).toEqual(['tiktok', 'meta'])
  })

  it('ne divise pas par zéro sur une plateforme sans budget ni client', () => {
    const r = parPlateforme([
      campagneFactice('a', 'Offerte', 'autre', 0, { visites: 10, reservations: 0, chiffreAffaires: 0 }),
    ])
    expect(r[0].retour).toBeNull()
    expect(r[0].coutParReservation).toBeNull()
  })

  it('ne rend rien sans campagne', () => {
    expect(parPlateforme([])).toEqual([])
  })
})
