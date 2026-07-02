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
    const serviceCard = page.locator('[data-testid="service-card"]').first()
    await expect(serviceCard).toBeVisible({ timeout: 15_000 })
    await serviceCard.click()

    // La sélection des types de véhicule apparaît
    const vehicleIncrement = page.locator('[data-testid="vehicle-increment"]').first()
    await expect(vehicleIncrement).toBeVisible({ timeout: 5_000 })
    await vehicleIncrement.click()

    // Le champ modèle devient obligatoire
    const modelInput = page.locator('input[placeholder="Modèle du véhicule"]').first()
    await expect(modelInput).toBeVisible({ timeout: 5_000 })
    await modelInput.fill(TEST_MODEL)

    // Continuer (activé une fois la prestation + véhicule + modèle remplis)
    const continuService = page.locator('[data-testid="service-continue"]')
    await expect(continuService).toBeEnabled({ timeout: 5_000 })
    await continuService.click()

    // ── 3. Choisir un créneau ─────────────────────────────────────────
    // L'étape "Créneau" est rendue
    await expect(page.locator('text=Choisissez un créneau')).toBeVisible({ timeout: 10_000 })

    // Saisir l'adresse (déclenche le debounce zone 800 ms + API zone)
    const addressInput = page.locator('input[placeholder="12 rue de la Paix, 75001 Paris"]')
    await expect(addressInput).toBeVisible()
    await addressInput.fill(TEST_ADDRESS)
    // Fermer le dropdown d'autocomplete si ouvert
    await page.keyboard.press('Escape')

    // Cliquer sur le premier jour disponible (non désactivé)
    await expect(page.locator('p:has-text("Sélectionnez un jour")')).toBeVisible()
    const firstAvailableDay = page
      .locator('p:has-text("Sélectionnez un jour") + div button:not([disabled])')
      .first()
    await expect(firstAvailableDay).toBeVisible({ timeout: 5_000 })
    await firstAvailableDay.click()

    // Les créneaux horaires s'affichent
    await expect(page.locator('p:has-text("Heure")')).toBeVisible({ timeout: 5_000 })
    const firstSlot = page.locator('.grid.grid-cols-4 button').first()
    await expect(firstSlot).toBeVisible({ timeout: 5_000 })
    await firstSlot.click()

    // Attendre que la vérification de zone soit terminée + Continuer activé
    const continuerSlot = page.getByRole('button', { name: 'Continuer' })
    await expect(continuerSlot).toBeEnabled({ timeout: 10_000 })
    await continuerSlot.click()

    // ── 4. Remplir les coordonnées ────────────────────────────────────
    await expect(page.locator('text=Vos coordonnées')).toBeVisible({ timeout: 10_000 })

    await page.fill('input[placeholder="Jean Dupont"]', TEST_NAME)
    await page.fill('input[placeholder="jean@email.com"]', CLIENT_EMAIL)
    await page.fill('input[placeholder="06 00 00 00 00"]', TEST_PHONE)

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
    await expect(page.locator('[data-testid="service-card"]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('Slug inexistant → 404 gracieuse', async ({ page }) => {
    const res = await page.goto('/book/slug-e2e-inexistant-xyz')
    expect(res?.status()).not.toBe(500)
  })
})
