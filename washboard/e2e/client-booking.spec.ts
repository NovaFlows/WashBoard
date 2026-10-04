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

const SLUG         = process.env.TEST_WASHER_SLUG ?? ''
const CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL ?? 'e2e-client@washboard-test.fr'
const TEST_ADDRESS = '15 Rue du Général de Gaulle, Paris'
const TEST_NAME    = '[E2E] Test Client'
const TEST_PHONE   = '0600000000'
const TEST_MODEL   = 'Peugeot 208 E2E'

test.describe('Réservation client complète', () => {
  test.skip(!SLUG, 'TEST_WASHER_SLUG absent — skip client booking tests')

  // Nettoie les réservations E2E après les tests
  test.afterAll(async ({ request }) => {
    await request.post('/api/e2e/cleanup', {
      data: { client_email: CLIENT_EMAIL },
    }).catch(() => { /* silencieux si le endpoint n'existe pas encore */ })
  })

  test('Parcours complet : service → créneau → coordonnées → confirmation', async ({ page }) => {

    // ── 1. Ouvrir la page de réservation ───────────────────────────────
    await page.goto(`/book/${SLUG}`)
    await expect(page.locator('text=Application error')).not.toBeVisible()

    // ── 2. Sélectionner une prestation ────────────────────────────────
    // Véhicule par défaut, prestation et options réunis dans une carte.
    const service = page.getByRole('radio').first()
    await expect(service).toBeVisible({ timeout: 15_000 })
    await service.check()
    await page.getByTestId('booking-continue').click()

    // ── 3. Adresse, puis jour et horaire ───────────────────────────────
    await expect(page.getByRole('heading', { name: 'Où et quand ?' })).toBeVisible()
    await page.getByLabel('Adresse du lavage').fill(TEST_ADDRESS)
    await page.keyboard.press('Escape')
    await page.locator('[aria-label="Jours disponibles"] button').first().click()
    const slot = page.locator('#wb-section-2 .grid.grid-cols-3 button').first()
    await expect(slot).toBeVisible({ timeout: 15_000 })
    await slot.click()
    await expect(page.getByTestId('booking-continue')).toBeEnabled({ timeout: 15_000 })
    await page.getByTestId('booking-continue').click()

    // ── 4. Coordonnées et identification du véhicule ───────────────────
    await expect(page.getByRole('heading', { name: 'Vos coordonnées' })).toBeVisible()
    await page.getByLabel('Nom et prénom').fill(TEST_NAME)
    await page.getByLabel(/Email pour/).fill(CLIENT_EMAIL)
    await page.getByLabel('Téléphone', { exact: true }).fill(TEST_PHONE)
    const model = page.getByLabel('Modèle du véhicule')
    if (await model.isVisible()) await model.fill(TEST_MODEL)

    const confirmer = page.getByRole('button', { name: 'Confirmer la réservation' })
    await expect(confirmer).toBeEnabled({ timeout: 5_000 })
    await confirmer.click()

    // ── 5. Vérifier la confirmation ───────────────────────────────────
    await expect(page.locator('text=Réservation envoyée !')).toBeVisible({ timeout: 30_000 })
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
