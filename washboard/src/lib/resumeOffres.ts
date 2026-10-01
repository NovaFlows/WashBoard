import { BOOKING_QUOTA, PLAN_CARDS, type Plan, type PlanCard } from '@/lib/plan'

// Réponse « Combien coûte WashBoard ? » des FAQ des pages pilier.
//
// Une seule rédaction, partagée : recopiée à la main dans quatre pages, elle
// avait dérivé de la grille (offre Essentiel disparue, multi-laveurs annoncé
// en Pro au lieu de Business, deux offres citées sur quatre). Noms, prix et
// quotas viennent de plan.ts.

function carte(key: Plan): PlanCard {
  return PLAN_CARDS.find(c => c.key === key)!
}

/** « gratuite », « 19€/mois » ou « sur devis » — jamais le prix d'une offre
 *  dont le tarif n'est pas affiché sur la grille. */
export function tarifOffre(c: PlanCard): string {
  if (c.surDevis) return 'sur devis'
  if (c.price === 0) return 'gratuite'
  return `${c.price}€/mois`
}

export function resumeOffres(): string {
  const decouverte = carte('decouverte')
  const starter = carte('starter')
  const pro = carte('pro')
  const business = carte('business')
  return (
    `${decouverte.name} est ${tarifOffre(decouverte)}, limitée à ${BOOKING_QUOTA.decouverte} réservations par mois, et calcule déjà tes frais de déplacement. ` +
    `${starter.name}, à ${tarifOffre(starter)}, monte à ${BOOKING_QUOTA.starter} réservations par mois, avec une page personnalisée et le CRM. ` +
    `${pro.name}, à ${tarifOffre(pro)}, ajoute les réservations illimitées, les créneaux intelligents, la comptabilité, la facturation, les avis Google (email et SMS) et les relances de suivi. ` +
    `${business.name}, pour une équipe, est ${tarifOffre(business)}. ` +
    'Un mois est offert à l’inscription, sans carte bancaire.'
  )
}
