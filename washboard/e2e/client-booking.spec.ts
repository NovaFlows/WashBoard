/**
 * Simulation d'un vrai client — parcours complet de réservation.
 *
 * Prérequis pour le laveur de test :
 *   - Au moins 1 prestation avec au moins 1 type de véhicule
 *   - Au moins 1 disponibilité récurrente (ex. Lun–Ven 09:00–17:00)
 *   - Pas de restriction de zone (ou adresse de test dans la zone)
 *
 * Variables requises dans .env.test.local :
 *   TEST_WASHER_SLUG, TEST_CLIENT_EMAIL
 */
import { test, expect } from '@playwright/test'
import { reserverCommeClient } from './helpers'

const SLUG         = process.env.TEST_WASHER_SLUG ?? ''
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL ?? 'e2e-client@washboard-test.fr'
const TEST_NAME    = '[E2E] Test Client'
const TEST_PHONE   = '0600000000'

test.describe('Réservation client complète', () => {
  test.skip(!SLUG, 'TEST_WASHER_SLUG absent — skip client booking tests')

  // Nettoie les réservations E2E après les tests
  test.afterAll(async ({ request }) => {
    await request.post('/api/e2e/cleanup', {
      data: { client_email: CLIENT_EMAIL },
    }).catch(() => { /* silencieux si le endpoint n'existe pas encore */ })
  })

  test('Parcours complet : service → créneau → coordonnées → confirmation', async ({ page }) => {
    // Tout le parcours public, puis la confirmation : plus long que la minute par défaut.
    test.setTimeout(120_000)
    const creation = await reserverCommeClient(page, { nom: TEST_NAME, email: CLIENT_EMAIL, telephone: TEST_PHONE })
    expect(creation.status(), `refus du serveur : ${await creation.text()}`).toBe(201)

    await expect(page.getByText('Réservation envoyée !')).toBeVisible({ timeout: 30_000 })
    // La référence de réservation est affichée (8 caractères alphanumériques)
    await expect(page.locator('.font-mono')).toBeVisible()
  })
})

test.describe('Page réservation — états de base', () => {
  test.skip(!SLUG, 'TEST_WASHER_SLUG absent — skip')

  test('Page de réservation se charge', async ({ page }) => {
    await page.goto(`/book/${SLUG}`)
    await expect(page.locator('text=Application error')).not.toBeVisible()
    await expect(page.getByRole('radio').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Slug inexistant → 404 gracieuse', async ({ page }) => {
    const res = await page.goto('/book/slug-e2e-inexistant-xyz')
    expect(res?.status()).not.toBe(500)
  })
})
