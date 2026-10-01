import { PLAN_LABELS, offreCatalogueIllimite } from './plan'
import { describe, it, expect } from 'vitest'
import {
  estReservable, champsManquants, messageManques, dureeValide, DUREE_MAX_MINUTES,
  estRefusCleEtrangere, CODE_PG_CLE_ETRANGERE, ERREUR_PRESTATION_RESERVEE, ERREUR_SANS_TYPE,
  estEnVeille, estVisibleParLesClients, aMettreEnVeille, prestationsAffichees, erreurTropDActives,
} from './prestation'

const complete = { name: 'Lavage complet', price: '80', duration_minutes: '90', vehicle_types: ['SUV'] }

describe('estReservable', () => {
  it('vrai avec au moins un type', () => {
    expect(estReservable({ vehicle_types: ['citadine'] })).toBe(true)
  })

  it('faux sans type : le client resterait bloqué sur la page de réservation', () => {
    expect(estReservable({ vehicle_types: [] })).toBe(false)
  })

  it('faux si la donnée est absente ou mal formée (charge venue du navigateur)', () => {
    expect(estReservable({})).toBe(false)
    expect(estReservable({ vehicle_types: null })).toBe(false)
    expect(estReservable({ vehicle_types: 'SUV' })).toBe(false)
  })
})

describe('champsManquants', () => {
  it('rien ne manque sur une prestation complète', () => {
    expect(champsManquants(complete)).toEqual([])
  })

  it('un prix à 0 € est un prix, pas un oubli', () => {
    expect(champsManquants({ ...complete, price: '0' })).toEqual([])
  })

  it('signale l’absence de type, le cas qui passait sans avertissement', () => {
    expect(champsManquants({ ...complete, vehicle_types: [] })).toEqual(['type'])
  })

  it('liste tout ce qui manque, dans l’ordre du formulaire', () => {
    expect(champsManquants({ name: '  ', price: '', duration_minutes: '', vehicle_types: [] }))
      .toEqual(['nom', 'prix', 'duree', 'type'])
  })

  it('une durée nulle compte comme manquante', () => {
    expect(champsManquants({ ...complete, duration_minutes: '0' })).toEqual(['duree'])
  })

  it('une durée déraisonnable (5000 min, incident réel) est signalée, pas juste acceptée', () => {
    expect(champsManquants({ ...complete, duration_minutes: '5000' })).toEqual(['duree_max'])
  })

  it('la durée maximale exacte reste acceptée', () => {
    expect(champsManquants({ ...complete, duration_minutes: String(DUREE_MAX_MINUTES) })).toEqual([])
  })
})

describe('dureeValide', () => {
  it('accepte une durée normale', () => {
    expect(dureeValide(90)).toBe(true)
  })

  it('refuse zéro, le négatif et le non fini', () => {
    expect(dureeValide(0)).toBe(false)
    expect(dureeValide(-10)).toBe(false)
    expect(dureeValide(NaN)).toBe(false)
  })

  it('accepte le plafond, refuse juste au-dessus', () => {
    expect(dureeValide(DUREE_MAX_MINUTES)).toBe(true)
    expect(dureeValide(DUREE_MAX_MINUTES + 1)).toBe(false)
  })

  it('refuse 5000 minutes, la valeur enregistrée en vrai avant ce correctif', () => {
    expect(dureeValide(5000)).toBe(false)
  })
})

describe('messageManques', () => {
  it('aucun message quand tout est rempli', () => {
    expect(messageManques([])).toBeNull()
  })

  it('un seul manque', () => {
    expect(messageManques(['type'])).toBe('Pour enregistrer, il manque au moins un type.')
  })

  it('plusieurs manques, reliés par « et »', () => {
    expect(messageManques(['nom', 'prix', 'type']))
      .toBe('Pour enregistrer, il manque le nom, le prix et au moins un type.')
  })

  it('« duree_max » seul ne produit aucun message : ce champ n’est pas manquant, il est trop grand — son message vit ailleurs (ERREUR_DUREE_MAX), pas dans « il manque »', () => {
    expect(messageManques(['duree_max'])).toBeNull()
  })

  it('« duree_max » est ignoré au milieu d’une vraie liste de manques', () => {
    expect(messageManques(['nom', 'duree_max'])).toBe('Pour enregistrer, il manque le nom.')
  })
})

describe('estRefusCleEtrangere', () => {
  it('reconnaît le refus Postgres 23503 renvoyé par Supabase', () => {
    expect(estRefusCleEtrangere({ code: CODE_PG_CLE_ETRANGERE, message: 'update or delete on table "services" violates foreign key constraint' })).toBe(true)
  })

  it('ne confond pas avec une autre erreur de base', () => {
    expect(estRefusCleEtrangere({ code: '23505' })).toBe(false)
    expect(estRefusCleEtrangere({ code: 'PGRST116' })).toBe(false)
  })

  it('tolère tout ce qui n’est pas un objet d’erreur', () => {
    expect(estRefusCleEtrangere(null)).toBe(false)
    expect(estRefusCleEtrangere(undefined)).toBe(false)
    expect(estRefusCleEtrangere('23503')).toBe(false)
    expect(estRefusCleEtrangere({})).toBe(false)
  })
})

describe('messages de refus', () => {
  it('le refus « réservée » ne conseille pas de retirer les types : une prestation sans type est refusée', () => {
    expect(ERREUR_PRESTATION_RESERVEE).not.toMatch(/retirez/i)
    expect(ERREUR_SANS_TYPE).toMatch(/au moins un type/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Mise en veille (plafond de catalogue)
//
// Le plafond ne bloquait que la CRÉATION : un laveur arrivant sur une offre
// limitée avec quatre prestations les gardait toutes visibles. Le plafond ne
// servait donc à rien pour un compte existant — c'est-à-dire pour tout le
// monde. Ces règles décident ce que le client voit réellement.
// ─────────────────────────────────────────────────────────────────────────────

const RESERVABLE = { vehicle_types: ['citadine'] }

describe('estEnVeille', () => {
  it('ne l’est que lorsque c’est explicitement vrai', () => {
    expect(estEnVeille({ en_veille: true })).toBe(true)
    expect(estEnVeille({ en_veille: false })).toBe(false)
  })

  it('ne l’est pas quand l’information manque', () => {
    // Une prestation lue avant la migration n'a pas la colonne : elle doit
    // rester EN LIGNE. Le contraire ferait disparaître d'un coup tout le
    // catalogue de tout le monde au moment du déploiement.
    expect(estEnVeille({})).toBe(false)
    expect(estEnVeille({ en_veille: null })).toBe(false)
    expect(estEnVeille({ en_veille: undefined })).toBe(false)
  })
})

describe('estVisibleParLesClients', () => {
  it('exige d’être à la fois réservable et active', () => {
    expect(estVisibleParLesClients({ ...RESERVABLE })).toBe(true)
    expect(estVisibleParLesClients({ ...RESERVABLE, en_veille: true })).toBe(false)
    expect(estVisibleParLesClients({ vehicle_types: [], en_veille: false })).toBe(false)
    expect(estVisibleParLesClients({ vehicle_types: [], en_veille: true })).toBe(false)
  })
})

describe('aMettreEnVeille — combien le laveur doit en éteindre', () => {
  it('ne demande rien quand il est dans les clous', () => {
    expect(aMettreEnVeille(3, 3)).toBe(0)
    expect(aMettreEnVeille(1, 3)).toBe(0)
    expect(aMettreEnVeille(0, 3)).toBe(0)
  })

  it('demande la différence quand il dépasse', () => {
    expect(aMettreEnVeille(4, 3)).toBe(1)
    expect(aMettreEnVeille(9, 3)).toBe(6)
  })

  it('ne demande jamais rien sans plafond', () => {
    expect(aMettreEnVeille(250, null)).toBe(0)
  })
})

describe('prestationsAffichees — ce que le client voit vraiment', () => {
  const catalogue = [
    { id: 'a', ...RESERVABLE },
    { id: 'b', ...RESERVABLE },
    { id: 'c', ...RESERVABLE },
    { id: 'd', ...RESERVABLE },
  ]

  it('montre tout quand l’offre n’a pas de plafond', () => {
    expect(prestationsAffichees(catalogue, null).map(s => s.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('coupe au plafond tant que le laveur n’a pas choisi', () => {
    // Sans ce repli, le plafond ne serait qu'une phrase sur une page de vente.
    expect(prestationsAffichees(catalogue, 3).map(s => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('garde les PREMIÈRES, pas les dernières', () => {
    // Les prestations historiques sont celles que les clients connaissent :
    // les faire disparaître en premier serait le pire des deux choix.
    expect(prestationsAffichees(catalogue, 1).map(s => s.id)).toEqual(['a'])
  })

  it('respecte le choix du laveur avant le repli', () => {
    // Il a mis « a » en veille : c'est « b, c, d » qui restent, et le plafond
    // n'a plus rien à couper.
    const choisi = [{ id: 'a', ...RESERVABLE, en_veille: true }, ...catalogue.slice(1)]
    expect(prestationsAffichees(choisi, 3).map(s => s.id)).toEqual(['b', 'c', 'd'])
  })

  it('écarte les prestations sans type avant de compter', () => {
    // Une prestation sans type est une impasse pour le client : elle ne doit
    // pas occuper une des places du plafond.
    const avecImpasse = [
      { id: 'a', vehicle_types: [] },
      { id: 'b', ...RESERVABLE },
      { id: 'c', ...RESERVABLE },
      { id: 'd', ...RESERVABLE },
    ]
    expect(prestationsAffichees(avecImpasse, 3).map(s => s.id)).toEqual(['b', 'c', 'd'])
  })

  it('ne renvoie rien d’un catalogue vide', () => {
    expect(prestationsAffichees([], 3)).toEqual([])
  })
})

describe('erreurTropDActives — le refus lu par le laveur', () => {
  it('accorde le pluriel au plafond', () => {
    expect(erreurTropDActives(3)).toContain('3 prestations')
    expect(erreurTropDActives(1)).toContain('1 prestation ')
  })

  it('dit quoi faire, pas seulement que c’est refusé', () => {
    expect(erreurTropDActives(3)).toMatch(/veille/)
  })

  it('NOMME l’offre qui lève le plafond', () => {
    // « Passez à l'offre supérieure » ne dit ni laquelle ni combien : le
    // laveur referme. Le nom de l'offre est calculé, pas écrit en dur — le
    // jour où le catalogue illimité change de palier, le message suit.
    expect(erreurTropDActives(3)).toContain(PLAN_LABELS[offreCatalogueIllimite()])
    expect(erreurTropDActives(3)).toMatch(/illimité/)
  })
})
