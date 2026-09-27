import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hasFeature, washerPlan, requiredPlanLabel, yearlyPrice, yearlyMonthlyEquivalent,
  formatEuros, graceEnded, monthsOwed, YEARLY_FREE_MONTHS, freeMonthsLabel,
  quotaReservations, quotaPrestations, quotaDepasse, debutDuMoisParis,
  PLAN_PRICES, PLAN_LABELS, PLAN_CARDS, SMS_QUOTA, BOOKING_QUOTA, SERVICE_QUOTA,
  TEAM_SIZE_INCLUS, PLAN_ESSAI, PLAN_HISTORIQUE,
  RETOUR_GRATUIT_POUR_COMPTES_CREES_DES, COMPTES_TEST_RETOUR_GRATUIT,
  suitRetourGratuit, essaiTermineSansFormule,
  planEffectif, doitChoisirFormule, offreQuiCouvre,
  type Plan, type Feature,
} from './plan'

// ─────────────────────────────────────────────────────────────────────────────
// La grille 2026 a quatre offres. Ce qui distingue une offre d'une autre — ce
// pour quoi le laveur paie — tient dans deux tableaux : ce qui est ACCESSIBLE
// (hasFeature) et ce qui est PLAFONNÉ (les quotas). Les deux sont vérifiés ici
// offre par offre, ligne par ligne, sans raccourci du type « le Pro a tout » :
// c'est exactement le genre de raccourci qui laisse passer une fonctionnalité
// oubliée le jour où on en ajoute une.
// ─────────────────────────────────────────────────────────────────────────────

const OFFRES: Plan[] = ['decouverte', 'starter', 'pro', 'business']

/** Ce que chaque offre doit ouvrir. La table est écrite en toutes lettres,
 *  volontairement : elle sert de contrat lisible, pas de reflet du code. */
const ACCES: Record<Plan, Record<Feature, boolean>> = {
  decouverte: {
    page_personnalisee: false, crm: false, ca_simple: false,
    avis_email: false, avis_sms: false, compta: false, facturation: false,
    creneaux_intelligents: false, frais_deplacement: false, followup: false,
    multi_laveurs: false,
  },
  starter: {
    page_personnalisee: true, crm: true, ca_simple: true,
    avis_email: false, avis_sms: false, compta: false, facturation: false,
    creneaux_intelligents: false, frais_deplacement: false, followup: false,
    multi_laveurs: false,
  },
  pro: {
    page_personnalisee: true, crm: true, ca_simple: true,
    avis_email: true, avis_sms: true, compta: true, facturation: true,
    creneaux_intelligents: true, frais_deplacement: true, followup: true,
    multi_laveurs: false,
  },
  business: {
    page_personnalisee: true, crm: true, ca_simple: true,
    avis_email: true, avis_sms: true, compta: true, facturation: true,
    creneaux_intelligents: true, frais_deplacement: true, followup: true,
    multi_laveurs: true,
  },
}

describe('washerPlan — résolution du plan lu en base', () => {
  it('renvoie les quatre offres de la grille', () => {
    for (const p of OFFRES) expect(washerPlan({ plan: p })).toBe(p)
  })

  it('fait remonter un ancien compte « essentiel » sur Pro', () => {
    // Même tarif (49 €), davantage de fonctionnalités : le repli se fait vers
    // le haut. Le faire vers le bas retirerait un acquis le jour du déploiement.
    expect(washerPlan({ plan: 'essentiel' })).toBe('pro')
    expect(PLAN_PRICES.pro).toBe(49)
  })

  it('retombe sur l’offre gratuite si le plan est absent ou inconnu', () => {
    // Le repli par défaut n'ouvre JAMAIS un accès payant : une chaîne
    // inattendue en base ne doit pas offrir la comptabilité à tout le monde.
    expect(washerPlan(null)).toBe('decouverte')
    expect(washerPlan(undefined)).toBe('decouverte')
    expect(washerPlan({})).toBe('decouverte')
    expect(washerPlan({ plan: null })).toBe('decouverte')
    expect(washerPlan({ plan: 'n_importe_quoi' })).toBe('decouverte')
    expect(washerPlan({ plan: 'PRO' })).toBe('decouverte')  // la casse compte
  })
})

describe('hasFeature — la matrice complète des accès', () => {
  for (const offre of OFFRES) {
    const attendu = ACCES[offre]
    describe(`offre ${PLAN_LABELS[offre]}`, () => {
      for (const [feature, ouvert] of Object.entries(attendu) as [Feature, boolean][]) {
        it(`${ouvert ? 'ouvre' : 'ferme'} ${feature}`, () => {
          expect(hasFeature({ plan: offre, grandfathered: false }, feature)).toBe(ouvert)
        })
      }
    })
  }

  it('n’oublie aucune fonctionnalité dans la table de test', () => {
    // Garde-fou : si `Feature` gagne une valeur et qu'on oublie de l'ajouter
    // ci-dessus, la nouvelle fonctionnalité serait livrée sans qu'aucun test
    // ne dise à quelle offre elle appartient.
    const declarees = Object.keys(ACCES.decouverte).sort()
    for (const offre of OFFRES) {
      expect(Object.keys(ACCES[offre]).sort()).toEqual(declarees)
    }
  })

  it('est monotone : ce qu’une offre ouvre, l’offre au-dessus l’ouvre aussi', () => {
    // Une grille tarifaire où il faut RÉTROGRADER pour garder une
    // fonctionnalité est une grille cassée.
    for (let i = 1; i < OFFRES.length; i++) {
      const dessous = ACCES[OFFRES[i - 1]]
      const dessus  = ACCES[OFFRES[i]]
      for (const f of Object.keys(dessous) as Feature[]) {
        if (dessous[f]) expect(dessus[f]).toBe(true)
      }
    }
  })
})

describe('hasFeature — client historique (grandfathered)', () => {
  it('ouvre tout, y compris depuis l’offre gratuite', () => {
    const w = { plan: 'decouverte', grandfathered: true }
    for (const f of Object.keys(ACCES.business) as Feature[]) {
      expect(hasFeature(w, f)).toBe(true)
    }
  })

  it('ouvre tout même avec un plan illisible en base', () => {
    const w = { plan: 'valeur_corrompue', grandfathered: true }
    expect(hasFeature(w, 'multi_laveurs')).toBe(true)
  })
})

describe('requiredPlanLabel — l’offre à prendre pour débloquer', () => {
  it('nomme le palier exact, pas « Pro » par défaut', () => {
    expect(requiredPlanLabel('crm')).toBe('Starter')
    expect(requiredPlanLabel('page_personnalisee')).toBe('Starter')
    expect(requiredPlanLabel('ca_simple')).toBe('Starter')
    expect(requiredPlanLabel('compta')).toBe('Pro')
    expect(requiredPlanLabel('facturation')).toBe('Pro')
    expect(requiredPlanLabel('avis_email')).toBe('Pro')
    expect(requiredPlanLabel('avis_sms')).toBe('Pro')
    expect(requiredPlanLabel('followup')).toBe('Pro')
    expect(requiredPlanLabel('creneaux_intelligents')).toBe('Pro')
    expect(requiredPlanLabel('frais_deplacement')).toBe('Pro')
    expect(requiredPlanLabel('multi_laveurs')).toBe('Business')
  })

  it('désigne toujours une offre qui ouvre réellement la fonctionnalité', () => {
    for (const f of Object.keys(ACCES.business) as Feature[]) {
      const label = requiredPlanLabel(f)
      const offre = OFFRES.find(p => PLAN_LABELS[p] === label)!
      expect(hasFeature({ plan: offre }, f)).toBe(true)
    }
  })
})

describe('quotas de réservations — la limite qui sépare les offres', () => {
  it('plafonne Découverte à 5 par mois', () => {
    expect(quotaReservations({ plan: 'decouverte' })).toBe(5)
    expect(BOOKING_QUOTA.decouverte).toBe(5)
  })

  it('plafonne Starter à 15 par mois', () => {
    // 15, et non 30 : décision d'Alexandre, contre la proposition initiale.
    expect(quotaReservations({ plan: 'starter' })).toBe(15)
    expect(BOOKING_QUOTA.starter).toBe(15)
  })

  it('ne plafonne ni le Pro ni le Business', () => {
    expect(quotaReservations({ plan: 'pro' })).toBeNull()
    expect(quotaReservations({ plan: 'business' })).toBeNull()
  })

  it('ne plafonne pas un client historique, même sur l’offre gratuite', () => {
    expect(quotaReservations({ plan: 'decouverte', grandfathered: true })).toBeNull()
  })

  it('applique le plafond le plus strict à un plan inconnu', () => {
    expect(quotaReservations({ plan: 'inconnu' })).toBe(5)
    expect(quotaReservations(null)).toBe(5)
  })
})

describe('quotas de prestations au catalogue', () => {
  it('plafonne Découverte à 3 prestations', () => {
    expect(quotaPrestations({ plan: 'decouverte' })).toBe(3)
    expect(SERVICE_QUOTA.decouverte).toBe(3)
  })

  it('ouvre le catalogue dès Starter', () => {
    expect(quotaPrestations({ plan: 'starter' })).toBeNull()
    expect(quotaPrestations({ plan: 'pro' })).toBeNull()
    expect(quotaPrestations({ plan: 'business' })).toBeNull()
  })

  it('ne plafonne pas un client historique', () => {
    expect(quotaPrestations({ plan: 'decouverte', grandfathered: true })).toBeNull()
  })
})

describe('quotaDepasse — où tombe exactement la limite', () => {
  it('accepte jusqu’au plafond inclus et refuse le suivant', () => {
    // Avec un quota de 5 : les cinq premiers passent, le sixième est refusé.
    expect(quotaDepasse(5, 0)).toBe(false)
    expect(quotaDepasse(5, 4)).toBe(false)   // la 5ᵉ réservation
    expect(quotaDepasse(5, 5)).toBe(true)    // la 6ᵉ
    expect(quotaDepasse(5, 99)).toBe(true)
  })

  it('n’oppose jamais de limite quand il n’y en a pas', () => {
    expect(quotaDepasse(null, 0)).toBe(false)
    expect(quotaDepasse(null, 10_000)).toBe(false)
  })

  it('refuse tout avec un plafond à zéro', () => {
    expect(quotaDepasse(0, 0)).toBe(true)
  })
})

describe('SMS d’avis inclus', () => {
  it('n’en donne aucun aux offres sans avis', () => {
    expect(SMS_QUOTA.decouverte).toBe(0)
    expect(SMS_QUOTA.starter).toBe(0)
  })

  it('en donne 150 au Pro et au Business', () => {
    expect(SMS_QUOTA.pro).toBe(150)
    expect(SMS_QUOTA.business).toBe(150)
  })

  it('n’accorde de quota qu’aux offres qui ouvrent les avis SMS', () => {
    // Un quota de SMS sur une offre qui n'a pas la fonctionnalité serait un
    // budget affiché mais inatteignable.
    for (const p of OFFRES) {
      if (SMS_QUOTA[p] > 0) expect(hasFeature({ plan: p }, 'avis_sms')).toBe(true)
    }
  })
})

describe('taille d’équipe incluse', () => {
  it('donne 3 laveurs au Business et un seul ailleurs', () => {
    expect(TEAM_SIZE_INCLUS.business).toBe(3)
    expect(TEAM_SIZE_INCLUS.decouverte).toBe(1)
    expect(TEAM_SIZE_INCLUS.starter).toBe(1)
    expect(TEAM_SIZE_INCLUS.pro).toBe(1)
  })

  it('ne promet plusieurs laveurs que là où le multi-laveurs est ouvert', () => {
    for (const p of OFFRES) {
      if (TEAM_SIZE_INCLUS[p] > 1) expect(hasFeature({ plan: p }, 'multi_laveurs')).toBe(true)
    }
  })
})

describe('tarifs de la grille', () => {
  it('reprend les prix décidés', () => {
    expect(PLAN_PRICES).toEqual({ decouverte: 0, starter: 19, pro: 49, business: 129 })
  })

  it('monte à mesure qu’on monte dans la grille', () => {
    for (let i = 1; i < OFFRES.length; i++) {
      expect(PLAN_PRICES[OFFRES[i]]).toBeGreaterThan(PLAN_PRICES[OFFRES[i - 1]])
    }
  })

  it('fait démarrer l’essai sur l’offre complète, pas sur l’offre gratuite', () => {
    expect(PLAN_ESSAI).toBe('pro')
    expect(quotaReservations({ plan: PLAN_ESSAI })).toBeNull()
  })

  it('facture les clients historiques au tarif qu’ils payaient', () => {
    expect(PLAN_PRICES[PLAN_HISTORIQUE]).toBe(49)
  })
})

describe('PLAN_CARDS — ce qui est montré au laveur', () => {
  it('présente les quatre offres, dans l’ordre des prix', () => {
    expect(PLAN_CARDS.map(c => c.key)).toEqual(OFFRES)
  })

  it('affiche le prix de la grille, jamais un prix écrit à la main', () => {
    for (const c of PLAN_CARDS) expect(c.price).toBe(PLAN_PRICES[c.key])
  })

  it('annonce les bons plafonds sur les offres limitées', () => {
    const decouverte = PLAN_CARDS.find(c => c.key === 'decouverte')!
    expect(decouverte.features.join(' ')).toContain(`${BOOKING_QUOTA.decouverte} réservations`)
    expect(decouverte.features.join(' ')).toContain(`${SERVICE_QUOTA.decouverte} prestations`)

    const starter = PLAN_CARDS.find(c => c.key === 'starter')!
    expect(starter.features.join(' ')).toContain(`${BOOKING_QUOTA.starter} réservations`)
  })

  it('ne met en avant qu’une seule offre', () => {
    expect(PLAN_CARDS.filter(c => c.highlight)).toHaveLength(1)
  })

  it('ne présente « à partir de » que là où le prix dépend de l’usage', () => {
    // Seul le Business a un prix variable (laveurs supplémentaires).
    expect(PLAN_CARDS.filter(c => c.from).map(c => c.key)).toEqual(['business'])
  })
})

describe('debutDuMoisParis — la borne de remise à zéro des quotas', () => {
  it('tombe sur le 1er du mois à minuit heure de Paris', () => {
    // 15 juillet → 1er juillet 00:00 Paris = 30 juin 22:00 UTC (heure d'été).
    expect(debutDuMoisParis(new Date('2026-07-15T12:00:00.000Z')).toISOString())
      .toBe('2026-06-30T22:00:00.000Z')
  })

  it('tient compte de l’heure d’hiver', () => {
    // 1er janvier 00:00 Paris = 31 décembre 23:00 UTC.
    expect(debutDuMoisParis(new Date('2026-01-20T12:00:00.000Z')).toISOString())
      .toBe('2025-12-31T23:00:00.000Z')
  })

  it('bascule sur le nouveau mois dès la première minute parisienne', () => {
    // 1er août 00:30 à Paris = 31 juillet 22:30 UTC. Une borne calculée en UTC
    // aurait renvoyé le 1er JUILLET : le laveur se serait vu refuser une
    // réservation avec un compteur qui venait pourtant d'être remis à zéro.
    expect(debutDuMoisParis(new Date('2026-07-31T22:30:00.000Z')).toISOString())
      .toBe('2026-07-31T22:00:00.000Z')
  })
})

describe('tarifs annuels', () => {
  // Ces tests figeaient 490 et 690 €, valeurs de l'époque des 2 mois offerts :
  // ils cassaient dès qu'on touchait à l'offre, sans rien révéler d'utile. On
  // vérifie désormais la règle, qui elle ne change pas.
  it('facture douze mois moins les mois offerts', () => {
    expect(yearlyPrice(49)).toBe(49 * (12 - YEARLY_FREE_MONTHS))
    expect(yearlyPrice(19)).toBe(19 * (12 - YEARLY_FREE_MONTHS))
  })

  it('laisse l’offre gratuite gratuite, y compris à l’année', () => {
    expect(yearlyPrice(0)).toBe(0)
    expect(yearlyMonthlyEquivalent(0)).toBe(0)
  })

  it('revient moins cher que douze mensualités', () => {
    // Le sens de l'offre : si cette assertion tombe, l'engagement annuel
    // coûterait plus cher que le mensuel.
    expect(yearlyPrice(49)).toBeLessThan(49 * 12)
    expect(yearlyMonthlyEquivalent(49)).toBeLessThan(49)
  })

  it('calcule le mensuel équivalent arrondi au centime', () => {
    expect(yearlyMonthlyEquivalent(49)).toBe(
      Math.round((49 * (12 - YEARLY_FREE_MONTHS) / 12) * 100) / 100
    )
    // Un montant à décimales infinies ne doit pas fuir dans l'affichage.
    expect(yearlyMonthlyEquivalent(49).toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2)
  })

  it('affiche l’offre au bon nombre', () => {
    // « 1 mois offerts » était le défaut avant l'introduction de ce libellé.
    expect(freeMonthsLabel()).toBe(
      YEARLY_FREE_MONTHS > 1 ? `${YEARLY_FREE_MONTHS} mois offerts` : `${YEARLY_FREE_MONTHS} mois offert`
    )
  })
  it('formate à la française sans centimes inutiles', () => {
    expect(formatEuros(40.83)).toBe('40,83')
    expect(formatEuros(490)).toBe('490')
  })
  it('complète les centimes manquants sur un montant non rond', () => {
    expect(formatEuros(57.5)).toBe('57,50')
  })
})

// `graceEnded` et `monthsOwed` décident respectivement si on BLOQUE les
// réservations d'un laveur et COMBIEN il doit payer. Elles n'étaient couvertes
// par aucun test (33 % de branches sur ce fichier au 2026-08-30) alors qu'une
// erreur y coupe l'activité d'un client payant ou lui réclame le mauvais
// montant. Les dates sont figées : un test de facturation qui dépend de
// l'horloge du jour finit toujours par échouer un lundi matin.
describe('graceEnded — fin du délai de grâce (30 jours)', () => {
  const echeance = '2026-01-01T00:00:00.000Z'

  it('ne bloque pas avant la fin des 30 jours', () => {
    expect(graceEnded(echeance, null, new Date('2026-01-15T00:00:00.000Z'))).toBe(false)
  })

  it('ne bloque pas le dernier jour du délai', () => {
    expect(graceEnded(echeance, null, new Date('2026-01-31T00:00:00.000Z'))).toBe(false)
  })

  it('bloque une fois les 30 jours dépassés', () => {
    expect(graceEnded(echeance, null, new Date('2026-02-05T00:00:00.000Z'))).toBe(true)
  })

  it('sans aucune date, ne bloque pas — on ne coupe pas un compte sur une absence d’information', () => {
    expect(graceEnded(null, null, new Date('2030-01-01T00:00:00.000Z'))).toBe(false)
  })

  it('retombe sur la fin d’essai quand le laveur n’a jamais été abonné', () => {
    const finEssai = '2026-03-01T00:00:00.000Z'
    expect(graceEnded(null, finEssai, new Date('2026-03-20T00:00:00.000Z'))).toBe(false)
    expect(graceEnded(null, finEssai, new Date('2026-04-10T00:00:00.000Z'))).toBe(true)
  })

  it('privilégie l’échéance d’abonnement sur la fin d’essai quand les deux existent', () => {
    // Essai fini depuis longtemps mais abonnement récent : le laveur a payé,
    // il ne doit surtout pas être bloqué.
    const finEssai = '2026-01-01T00:00:00.000Z'
    const finAbo = '2026-06-01T00:00:00.000Z'
    expect(graceEnded(finAbo, finEssai, new Date('2026-06-15T00:00:00.000Z'))).toBe(false)
  })
})

describe('monthsOwed — mois dus après échéance', () => {
  const echeance = '2026-01-01T00:00:00.000Z'

  it('ne doit rien tant que l’échéance n’est pas passée', () => {
    expect(monthsOwed(echeance, null, new Date('2025-12-20T00:00:00.000Z'))).toBe(0)
  })

  it('ne doit rien le jour même de l’échéance', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-01T00:00:00.000Z'))).toBe(0)
  })

  it('doit un mois dès le lendemain', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-02T00:00:00.000Z'))).toBe(1)
  })

  it('doit toujours un mois à 29 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-30T00:00:00.000Z'))).toBe(1)
  })

  it('passe à deux mois après 30 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-01-31T12:00:00.000Z'))).toBe(2)
  })

  it('passe à trois mois après 60 jours de retard', () => {
    expect(monthsOwed(echeance, null, new Date('2026-03-02T12:00:00.000Z'))).toBe(3)
  })

  it('ne réclame rien sans aucune date connue', () => {
    expect(monthsOwed(null, null, new Date('2030-01-01T00:00:00.000Z'))).toBe(0)
  })

  it('retombe sur la fin d’essai quand le laveur n’a jamais été abonné', () => {
    expect(monthsOwed(null, '2026-01-01T00:00:00.000Z', new Date('2026-01-15T00:00:00.000Z'))).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Fin de l'essai : retour sur l'offre gratuite (règle 2026)
//
// La partie la plus délicate de la grille, parce qu'elle touche des comptes qui
// tournent déjà. Deux exigences, dans cet ordre :
//   1. AUCUN compte existant ne change de comportement ;
//   2. un compte neuf dont l'essai se termine retombe sur Découverte au lieu
//      d'être coupé.
//
// Les dates sont dérivées de la constante, jamais écrites en dur : la reculer
// pour étendre la règle à tout le monde ne doit pas casser ces tests.
// ─────────────────────────────────────────────────────────────────────────────

const BASCULE = new Date(RETOUR_GRATUIT_POUR_COMPTES_CREES_DES).getTime()
const JOUR = 24 * 60 * 60 * 1000
const AVANT  = new Date(BASCULE - 30 * JOUR).toISOString()   // compte existant
const APRES  = new Date(BASCULE + 30 * JOUR).toISOString()   // compte neuf

/** Un compte neuf dont l'essai s'est terminé hier, sans formule choisie. */
function compteNeufEssaiFini(extra: Record<string, unknown> = {}) {
  return {
    plan: 'pro', grandfathered: false,
    created_at: APRES,
    subscription_status: 'trial',
    trial_ends_at: new Date(BASCULE + 60 * JOUR).toISOString(),
    ...extra,
  }
}
const MAINTENANT = new Date(BASCULE + 90 * JOUR)   // après la fin de l'essai ci-dessus

describe('suitRetourGratuit — qui est concerné par la règle 2026', () => {
  it('concerne un compte créé après la bascule', () => {
    expect(suitRetourGratuit({ created_at: APRES })).toBe(true)
  })

  it('concerne un compte créé pile à la seconde de la bascule', () => {
    expect(suitRetourGratuit({ created_at: RETOUR_GRATUIT_POUR_COMPTES_CREES_DES })).toBe(true)
  })

  it('NE concerne PAS un compte plus ancien', () => {
    // L'exigence numéro un : les clients déjà en place ne bougent pas.
    expect(suitRetourGratuit({ created_at: AVANT })).toBe(false)
  })

  it('ne concerne pas un compte dont on ignore la date de création', () => {
    // Une page qui ne lit pas `created_at` ne doit pas faire basculer un compte
    // par omission : l'absence d'information ne change jamais rien.
    expect(suitRetourGratuit({})).toBe(false)
    expect(suitRetourGratuit(null)).toBe(false)
    expect(suitRetourGratuit({ created_at: null })).toBe(false)
    expect(suitRetourGratuit({ created_at: 'pas une date' })).toBe(false)
  })
})

describe('COMPTES_TEST_RETOUR_GRATUIT — bascule anticipée, compte par compte', () => {
  const LISTE = ['compte-de-test'] as const

  it('bascule un compte listé, même créé bien avant la date', () => {
    // C'est tout l'objet de la liste : essayer la règle sur un compte à soi
    // sans falsifier sa date de création en base.
    expect(suitRetourGratuit({ slug: 'compte-de-test', created_at: AVANT }, LISTE)).toBe(true)
  })

  it('le bascule même sans date de création connue', () => {
    expect(suitRetourGratuit({ slug: 'compte-de-test' }, LISTE)).toBe(true)
  })

  it('ne bascule pas un compte absent de la liste', () => {
    expect(suitRetourGratuit({ slug: 'un-laveur-quelconque', created_at: AVANT }, LISTE)).toBe(false)
  })

  it('n’a aucun effet sur les comptes quand la liste est vide', () => {
    // L'état livré : la liste ne fait rien tant que personne n'y est inscrit.
    expect(suitRetourGratuit({ slug: 'compte-de-test', created_at: AVANT }, [])).toBe(false)
  })

  it('laisse la date décider pour un compte listé ET récent', () => {
    expect(suitRetourGratuit({ slug: 'compte-de-test', created_at: APRES }, [])).toBe(true)
  })

  it('ne contient que des liens publics en minuscules, sans espace', () => {
    // Un `slug` mal orthographié ne casse rien : il ne correspond simplement à
    // personne, et l'essai semble « ne pas marcher » sans qu'on sache pourquoi.
    for (const slug of COMPTES_TEST_RETOUR_GRATUIT) {
      expect(slug, slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    }
  })

  it('reste vide ou courte — ce n’est pas là que se fait le déploiement général', () => {
    // Pour étendre la règle à tout le monde, on recule la DATE ; la liste sert
    // aux essais et à quelques bascules choisies, pas à recopier la base.
    expect(COMPTES_TEST_RETOUR_GRATUIT.length).toBeLessThanOrEqual(20)
  })
})

describe('essaiTermineSansFormule', () => {
  it('est faux tant que l’essai court', () => {
    expect(essaiTermineSansFormule(
      { subscription_status: 'trial', trial_ends_at: new Date(BASCULE + 60 * JOUR).toISOString() },
      new Date(BASCULE + 30 * JOUR),
    )).toBe(false)
  })

  it('devient vrai une fois l’échéance passée', () => {
    expect(essaiTermineSansFormule(compteNeufEssaiFini(), MAINTENANT)).toBe(true)
  })

  it('est faux pour un abonnement actif', () => {
    expect(essaiTermineSansFormule(
      compteNeufEssaiFini({ subscription_status: 'active' }), MAINTENANT,
    )).toBe(false)
  })

  it('est faux pendant une relance de paiement (past_due)', () => {
    // Prélèvement en échec, Stripe relance : on ne rétrograde pas quelqu’un
    // qui paie et dont la carte va probablement repasser.
    expect(essaiTermineSansFormule(
      compteNeufEssaiFini({ subscription_status: 'past_due' }), MAINTENANT,
    )).toBe(false)
  })

  it('est faux pour un client historique', () => {
    expect(essaiTermineSansFormule(
      compteNeufEssaiFini({ grandfathered: true }), MAINTENANT,
    )).toBe(false)
  })

  it('est faux sans aucune échéance connue', () => {
    expect(essaiTermineSansFormule(
      { subscription_status: 'trial', trial_ends_at: null }, MAINTENANT,
    )).toBe(false)
  })

  it('privilégie la fin d’abonnement sur la fin d’essai', () => {
    // Essai fini depuis longtemps, abonnement payé jusqu’à plus tard : la
    // période payée fait foi.
    expect(essaiTermineSansFormule({
      subscription_status: 'expired',
      trial_ends_at: new Date(BASCULE).toISOString(),
      subscription_ends_at: new Date(BASCULE + 120 * JOUR).toISOString(),
    }, MAINTENANT)).toBe(false)
  })
})

describe('planEffectif — l’offre qui s’applique vraiment', () => {
  it('fait retomber un compte neuf sur Découverte à la fin de l’essai', () => {
    expect(planEffectif(compteNeufEssaiFini(), MAINTENANT)).toBe('decouverte')
  })

  it('LAISSE INTACT un compte existant dans la même situation', () => {
    // Le test qui compte. Un client déjà en place dont l’essai est fini garde
    // son plan et son ancien comportement (suspension après la grâce) : la
    // grille 2026 ne lui retire rien du jour au lendemain.
    const ancien = compteNeufEssaiFini({ created_at: AVANT })
    expect(planEffectif(ancien, MAINTENANT)).toBe('pro')
    expect(hasFeature(ancien, 'compta')).toBe(true)
    expect(quotaReservations(ancien)).toBeNull()
  })

  it('laisse intact un compte neuf qui paie', () => {
    expect(planEffectif(compteNeufEssaiFini({ subscription_status: 'active' }), MAINTENANT)).toBe('pro')
  })

  it('laisse intact un compte neuf pendant son essai', () => {
    expect(planEffectif(compteNeufEssaiFini(), new Date(BASCULE + 30 * JOUR))).toBe('pro')
  })

  it('laisse intact un client historique', () => {
    expect(planEffectif(compteNeufEssaiFini({ grandfathered: true }), MAINTENANT)).toBe('pro')
  })

  it('ne change rien quand la fiche lue ne porte pas les dates', () => {
    // Toutes les routes ne lisent pas `created_at`. Celles-là gardent le
    // comportement d’avant — jamais une perte d’accès par omission.
    expect(planEffectif({ plan: 'pro', grandfathered: false })).toBe('pro')
  })
})

describe('règle 2026 — ce que le laveur retrouve après la bascule', () => {
  // `quotaReservations` et `hasFeature` lisent l'horloge réelle : on fige donc
  // l'échéance loin dans le passé plutôt que d'essayer de figer l'horloge.
  const fini = compteNeufEssaiFini({ trial_ends_at: '2020-01-01T00:00:00.000Z' })

  it('le ramène aux 5 réservations par mois de l’offre gratuite', () => {
    expect(quotaReservations(fini)).toBe(5)
    expect(quotaPrestations(fini)).toBe(3)
  })

  it('laisse intact, dans la même situation, un compte antérieur à la bascule', () => {
    // Le pendant du test précédent, côté clients existants : même fiche, même
    // essai fini, seule la date de création change — et rien ne bouge.
    expect(quotaReservations({ ...fini, created_at: AVANT })).toBeNull()
    expect(quotaPrestations({ ...fini, created_at: AVANT })).toBeNull()
  })

  it('lui ferme la comptabilité, le CRM et la page personnalisée', () => {
    expect(hasFeature(fini, 'compta')).toBe(false)
    expect(hasFeature(fini, 'crm')).toBe(false)
    expect(hasFeature(fini, 'page_personnalisee')).toBe(false)
  })

  it('ne lui prend ni son agenda ni ses clients — il n’y a pas de verrou dessus', () => {
    // Formulé comme un rappel : aucune `Feature` ne couvre l’agenda ni les
    // fiches clients. Si quelqu’un en ajoutait une un jour, ce test tomberait
    // et la question se poserait explicitement.
    const cles = Object.keys(ACCES.decouverte)
    expect(cles).not.toContain('agenda')
    expect(cles).not.toContain('clients')
  })
})

describe('doitChoisirFormule — quand demander une décision', () => {
  it('le demande à un compte neuf dont l’essai vient de finir', () => {
    expect(doitChoisirFormule(compteNeufEssaiFini(), MAINTENANT)).toBe(true)
  })

  it('ne le demande pas pendant l’essai', () => {
    expect(doitChoisirFormule(compteNeufEssaiFini(), new Date(BASCULE + 30 * JOUR))).toBe(false)
  })

  it('ne le demande pas à un client existant', () => {
    expect(doitChoisirFormule(compteNeufEssaiFini({ created_at: AVANT }), MAINTENANT)).toBe(false)
  })

  it('ne le demande pas à quelqu’un qui paie', () => {
    expect(doitChoisirFormule(compteNeufEssaiFini({ subscription_status: 'active' }), MAINTENANT)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Simulation locale (NEXT_PUBLIC_DEV_OFFRE / NEXT_PUBLIC_DEV_FIN_ESSAI)
//
// Un outil qui force l'offre de tous les comptes doit être vérifié sur un point
// avant tout autre : qu'il ne puisse RIEN faire en production. Le reste n'est
// qu'un confort de test ; celui-là est une garde.
// ─────────────────────────────────────────────────────────────────────────────
describe('simulation d’offre en local', () => {
  const PRO_PAYANT = { plan: 'pro', grandfathered: false, subscription_status: 'active' }
  const HISTORIQUE = { plan: 'pro', grandfathered: true }

  // L'environnement est ÉPINGLÉ, pas hérité.
  //
  // Ces tests décrivent le comportement de la simulation quand elle est
  // active, ce qui n'arrive qu'en dehors de la production. Sans cette ligne,
  // ils passaient en local (vitest tourne en `NODE_ENV=test`) et échouaient
  // chez Vercel, dont la commande de build exécute `npm run test` avec
  // `NODE_ENV=production` : la simulation y est inerte, donc `planEffectif`
  // rend l'offre réelle et les trois attentes tombent. Build de
  // prévisualisation en échec le 2026-09-27, pour cette seule raison.
  //
  // Le test qui vérifie l'inertie, lui, repose `NODE_ENV` sur 'production' de
  // son côté : le dernier appel gagne.
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'development') })
  afterEach(() => { vi.unstubAllEnvs() })

  it('ne fait rien tant qu’aucune variable n’est posée — l’état livré', () => {
    expect(planEffectif(PRO_PAYANT)).toBe('pro')
    expect(hasFeature(PRO_PAYANT, 'compta')).toBe(true)
    expect(doitChoisirFormule(PRO_PAYANT)).toBe(false)
  })

  it('force l’offre demandée sur un compte payant', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_OFFRE', 'starter')
    expect(planEffectif(PRO_PAYANT)).toBe('starter')
    expect(hasFeature(PRO_PAYANT, 'crm')).toBe(true)      // Starter l'a
    expect(hasFeature(PRO_PAYANT, 'compta')).toBe(false)  // Starter ne l'a pas
    expect(quotaReservations(PRO_PAYANT)).toBe(15)
  })

  it('passe outre le statut de client historique', () => {
    // Sans ça, simuler depuis le compte de l'équipe — qui a tout débloqué —
    // ne montrerait jamais rien, et on croirait à un bug.
    vi.stubEnv('NEXT_PUBLIC_DEV_OFFRE', 'decouverte')
    expect(planEffectif(HISTORIQUE)).toBe('decouverte')
    expect(hasFeature(HISTORIQUE, 'compta')).toBe(false)
    expect(quotaReservations(HISTORIQUE)).toBe(5)
    expect(quotaPrestations(HISTORIQUE)).toBe(3)
  })

  it('rend au client historique tout son accès dès la simulation retirée', () => {
    expect(hasFeature(HISTORIQUE, 'compta')).toBe(true)
    expect(quotaReservations(HISTORIQUE)).toBeNull()
  })

  it('simule une fin d’essai : Découverte et invitation à choisir', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_FIN_ESSAI', '1')
    expect(planEffectif(PRO_PAYANT)).toBe('decouverte')
    expect(doitChoisirFormule(PRO_PAYANT)).toBe(true)
    expect(quotaReservations(PRO_PAYANT)).toBe(5)
  })

  it('ignore une valeur d’offre qui n’existe pas, plutôt que de tout casser', () => {
    vi.stubEnv('NEXT_PUBLIC_DEV_OFFRE', 'offre_imaginaire')
    expect(planEffectif(PRO_PAYANT)).toBe('pro')
  })

  it('EST INERTE EN PRODUCTION', () => {
    // La garde qui compte. Même posées, les deux variables ne doivent avoir
    // aucun effet dès que le code tourne en production — déploiement de
    // prévisualisation Vercel compris, qui bâtit lui aussi en production.
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_DEV_OFFRE', 'decouverte')
    vi.stubEnv('NEXT_PUBLIC_DEV_FIN_ESSAI', '1')

    expect(planEffectif(PRO_PAYANT)).toBe('pro')
    expect(doitChoisirFormule(PRO_PAYANT)).toBe(false)
    expect(hasFeature(HISTORIQUE, 'compta')).toBe(true)
    expect(quotaReservations(PRO_PAYANT)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Quelle offre proposer à un laveur dont des clients sont cachés. Proposer
// trop cher fait fuir ; proposer trop petit promet un déblocage qui n'aura pas
// lieu. Les deux erreurs coûtent un client, pas la même façon.
// ─────────────────────────────────────────────────────────────────────────────

describe('offreQuiCouvre', () => {
  it('propose la MOINS CHÈRE qui couvre le volume du mois', () => {
    // Sept réservations sur Découverte (5) : le Starter (15) suffit. Lui
    // vendre le Pro à 49 € pour deux clients cachés, c'est le perdre.
    expect(offreQuiCouvre('decouverte', 7)).toBe('starter')
    expect(offreQuiCouvre('decouverte', 15)).toBe('starter')
  })

  it('monte dès que le volume dépasse le palier intermédiaire', () => {
    expect(offreQuiCouvre('decouverte', 16)).toBe('pro')
    expect(offreQuiCouvre('decouverte', 120)).toBe('pro')
  })

  it('ne propose jamais une offre inférieure ou égale à l’actuelle', () => {
    // Un laveur au Starter qui déborde n'a rien à faire du Starter.
    expect(offreQuiCouvre('starter', 7)).toBe('pro')
    expect(offreQuiCouvre('starter', 40)).toBe('pro')
  })

  it('renvoie l’offre actuelle quand il n’y a rien au-dessus', () => {
    // Business : l'écran ne s'affiche pas, rien à vendre.
    expect(offreQuiCouvre('business', 500)).toBe('business')
  })

  it('propose l’offre sans plafond quand le volume est inconnu', () => {
    // Un comptage raté ne doit pas faire promettre un déblocage impossible :
    // seule l'offre sans plafond tient la promesse à coup sûr.
    expect(offreQuiCouvre('decouverte', null)).toBe('pro')
    expect(offreQuiCouvre('starter', null)).toBe('pro')
  })

  it('l’offre proposée couvre vraiment le volume annoncé', () => {
    // Le contrat que le bouton signe : après le changement, plus rien n'est
    // caché. Vérifié sur toute la plage, pas sur trois cas choisis.
    for (const actuel of ['decouverte', 'starter'] as Plan[]) {
      for (let volume = 1; volume <= 60; volume++) {
        const proposee = offreQuiCouvre(actuel, volume)
        const plafond = BOOKING_QUOTA[proposee]
        if (plafond !== null) expect(plafond).toBeGreaterThanOrEqual(volume)
      }
    }
  })
})
