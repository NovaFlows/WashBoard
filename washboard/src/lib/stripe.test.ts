import { describe, it, expect, beforeEach, vi } from 'vitest'

// STRIPE_PRICE_IDS lit les variables d'env au chargement du module → on les stub
// puis on ré-importe le module frais pour tester planFromPriceId.
describe('planFromPriceId', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('STRIPE_PRICE_ID_STARTER', 'price_starter')
    vi.stubEnv('STRIPE_PRICE_ID_PRO', 'price_pro')
    vi.stubEnv('STRIPE_PRICE_ID_BUSINESS', 'price_business')
  })

  it('mappe un price id connu vers son plan', async () => {
    const { planFromPriceId } = await import('./stripe')
    expect(planFromPriceId('price_starter')).toBe('starter')
    expect(planFromPriceId('price_pro')).toBe('pro')
    expect(planFromPriceId('price_business')).toBe('business')
  })

  it('retourne null pour un price id inconnu', async () => {
    const { planFromPriceId } = await import('./stripe')
    expect(planFromPriceId('price_inconnu')).toBeNull()
    expect(planFromPriceId('')).toBeNull()
  })

  it('expose les trois offres payantes, et pas l’offre gratuite', async () => {
    const { STRIPE_PRICE_IDS } = await import('./stripe')
    expect(Object.keys(STRIPE_PRICE_IDS).sort()).toEqual(['business', 'pro', 'starter'])
    expect('decouverte' in STRIPE_PRICE_IDS).toBe(false)
  })

  it('ne confond pas deux offres dont le prix n’est pas configuré', async () => {
    // Deux variables d'environnement absentes valent toutes les deux
    // `undefined` : sans garde-fou, un webhook portant un prix inconnu faisait
    // basculer le laveur sur la première offre non configurée de la liste.
    vi.resetModules()
    vi.stubEnv('STRIPE_PRICE_ID_STARTER', '')
    vi.stubEnv('STRIPE_PRICE_ID_PRO', '')
    vi.stubEnv('STRIPE_PRICE_ID_BUSINESS', '')
    const { planFromPriceId } = await import('./stripe')
    expect(planFromPriceId('price_inconnu')).toBeNull()
    expect(planFromPriceId('')).toBeNull()
  })

  it('getStripe retourne une instance Stripe utilisable', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy')
    const { getStripe } = await import('./stripe')
    const client = getStripe()
    expect(client).toBeTruthy()
    // surface de l'API attendue (pas d'appel réseau)
    expect(typeof client.checkout).toBe('object')
    expect(typeof client.billingPortal).toBe('object')
  })
})
