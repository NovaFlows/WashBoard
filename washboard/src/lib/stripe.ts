import Stripe from 'stripe'
import type { Plan } from '@/lib/plan'

let _stripe: Stripe | undefined
export function getStripe() {
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!))
}

// Découverte est gratuite : elle n'a volontairement PAS d'identifiant de prix.
// Un `Partial` plutôt qu'un `Record` complet, pour que le compilateur oblige
// les appelants à traiter le cas « offre sans paiement » au lieu de créer une
// session Stripe sur une chaîne vide.
export const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = {
  starter:  process.env.STRIPE_PRICE_ID_STARTER,
  pro:      process.env.STRIPE_PRICE_ID_PRO,
  business: process.env.STRIPE_PRICE_ID_BUSINESS,
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    // Une variable d'environnement absente vaut `undefined` : sans ce garde-fou,
    // deux offres non configurées se ressembleraient et un webhook portant un
    // prix inconnu ferait basculer le laveur sur la première d'entre elles.
    if (id && id === priceId) return plan as Plan
  }
  return null
}
