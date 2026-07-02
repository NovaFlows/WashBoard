import Stripe from 'stripe'
import type { Plan } from '@/lib/plan'

let _stripe: Stripe | undefined
export function getStripe() {
  return (_stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY!))
}

export const STRIPE_PRICE_IDS: Record<Plan, string> = {
  essentiel: process.env.STRIPE_PRICE_ID_ESSENTIEL!,
  pro:       process.env.STRIPE_PRICE_ID_PRO!,
  business:  process.env.STRIPE_PRICE_ID_BUSINESS!,
}

export function planFromPriceId(priceId: string): Plan | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId) return plan as Plan
  }
  return null
}
