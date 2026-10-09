import { test, expect } from '@playwright/test'
import { TEST_WASHER_SLUG, hasWasherCredentials } from './helpers'

// Une réservation annulée est définitive (voir PATCH /api/bookings/[id]) : sans ce
// garde-fou, annuler une réservation DANS le quota puis la repasser en "pending"
// sortait un instant du compte de la période — assez pour déverrouiller en clair la
// réservation suivante, la confirmer, puis annuler l'opération une fois fait. Deux
// appels, aucune trace. Trouvé par `cyber` le 2026-10-02, tranché par Ryan le
// 2026-10-04 (rendre `cancelled` définitif plutôt que de compter les annulations
// dans le quota, qui pénaliserait un laveur pour une annulation faite par son client).
//
// La réservation est créée par le PARCOURS PUBLIC réel (comme un vrai client), pas
// fabriquée en base : c'est le même moyen que `client-booking.spec.ts`, l'id complet
// est capturé depuis la réponse réseau du POST plutôt que depuis la référence
// tronquée affichée à l'écran. Les appels PATCH qui suivent, eux, reproduisent
// exactement le contournement décrit ci-dessus — avec la session laveur réelle.
const SLUG          = TEST_WASHER_SLUG
const CLIENT_EMAIL  = 'e2e-annulation@washboard-test.fr'
const TEST_ADDRESS  = '15 Rue du Général de Gaulle, Paris'
const TEST_NAME     = '[E2E] Test Annulation'
const TEST_PHONE    = '0600000000'

test.describe('Annulation définitive d’une réservation', () => {
  test.skip(!SLUG || !hasWasherCredentials, 'TEST_WASHER_SLUG ou identifiants laveur absents')

  test.afterAll(async ({ request }) => {
    await request.post('/api/e2e/cleanup', { data: { client_email: CLIENT_EMAIL } }).catch(() => {})
  })

  test('une fois annulée, elle ne peut plus changer de statut par l’API', async ({ page }, testInfo) => {
    // ── Réservation réelle, par le parcours public ──────────────────────────
    await page.goto(`/book/${SLUG}`)
    await expect(page.locator('text=Application error')).not.toBeVisible()

    const service = page.getByRole('radio').first()
    await expect(service).toBeVisible({ timeout: 15_000 })
    await service.check()
    await page.getByTestId('booking-continue').click()

    await expect(page.getByRole('heading', { name: 'Où et quand ?' })).toBeVisible()
    await page.getByLabel('Adresse du lavage').fill(TEST_ADDRESS)
    await page.keyboard.press('Escape')
    await page.locator('[aria-label="Jours disponibles"] button').first().click()
    const slot = page.locator('#wb-section-2 .grid.grid-cols-3 button').first()
    await expect(slot).toBeVisible({ timeout: 15_000 })
    await slot.click()
    await expect(page.getByTestId('booking-continue')).toBeEnabled({ timeout: 15_000 })
    await page.getByTestId('booking-continue').click()

    await expect(page.getByRole('heading', { name: 'Vos coordonnées' })).toBeVisible()
    await page.getByLabel('Nom et prénom').fill(TEST_NAME)
    await page.getByLabel(/Email pour/).fill(CLIENT_EMAIL)
    await page.getByLabel('Téléphone', { exact: true }).fill(TEST_PHONE)
    const model = page.getByLabel('Modèle du véhicule')
    if (await model.isVisible()) await model.fill('Peugeot 208 E2E')

    const confirmer = page.getByRole('button', { name: 'Confirmer la réservation' })
    await expect(confirmer).toBeEnabled({ timeout: 5_000 })

    // L'id COMPLET vient de la réponse réseau : l'écran n'affiche que les 8
    // premiers caractères (en majuscules), inutilisables pour un appel API.
    const [creation] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST'),
      confirmer.click(),
    ])
    expect(creation.status()).toBe(201)
    const { data } = await creation.json()
    const bookingId = data.id as string
    expect(bookingId).toBeTruthy()

    await expect(page.locator('text=Réservation envoyée !')).toBeVisible({ timeout: 30_000 })

    // ── Le contournement, avec la vraie session laveur ──────────────────────
    const annulation = await page.request.patch(`/api/bookings/${bookingId}`, { data: { status: 'cancelled' } })
    // Un compte de test déjà au-delà de son quota verrouille cette réservation
    // avant même qu'on l'annule : scénario différent, pas celui qu'on vérifie ici.
    testInfo.skip(annulation.status() === 403, 'réservation verrouillée par le quota sur le compte de test')
    expect(annulation.status()).toBe(200)

    const restauration = await page.request.patch(`/api/bookings/${bookingId}`, { data: { status: 'pending' } })
    expect(restauration.status()).toBe(409)
    expect((await restauration.json()).error).toMatch(/annulée/)

    const confirmation = await page.request.patch(`/api/bookings/${bookingId}`, { data: { status: 'confirmed' } })
    expect(confirmation.status()).toBe(409)

    // Toujours annulée : ni l'une ni l'autre tentative n'a eu d'effet.
    const reannulation = await page.request.patch(`/api/bookings/${bookingId}`, { data: { status: 'cancelled' } })
    expect(reannulation.status()).toBe(200)
  })
})
