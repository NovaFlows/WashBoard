import { describe, it, expect, beforeEach, vi } from 'vitest'

// STRIPE_PRICE_IDS lit les variables d'env au chargement du module → on les stub
// puis on ré-importe le module frais pour tester planFromPriceId.
describe('planFromPriceId', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('STRIPE_PRICE_ID_ESSENTIEL', 'price_ess')
    vi.stubEnv('STRIPE_PRICE_ID_PRO', 'price_pro')
    vi.stubEnv('STRIPE_PRICE_ID_BUSINESS', 'price_biz')
  })

  it('mappe un price id connu vers son plan', async () => {
    const { planFromPriceId } = await import('./stripe')
    expect(planFromPriceId('price_ess')).toBe('essentiel')
    expect(planFromPriceId('price_pro')).toBe('pro')
    expect(planFromPriceId('price_biz')).toBe('business')
  })

  it('retourne null pour un price id inconnu', async () => {
    const { planFromPriceId } = await import('./stripe')
    expect(planFromPriceId('price_inconnu')).toBeNull()
    expect(planFromPriceId('')).toBeNull()
  })

  it('STRIPE_PRICE_IDS expose les 3 plans', async () => {
    const { STRIPE_PRICE_IDS } = await import('./stripe')
    expect(Object.keys(STRIPE_PRICE_IDS).sort()).toEqual(['business', 'essentiel', 'pro'])
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
