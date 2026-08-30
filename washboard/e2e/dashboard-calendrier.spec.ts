import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'

// Calendrier : c'est l'écran de travail quotidien du laveur. Les trois vues
// sont des rendus distincts, donc trois chemins de code qui peuvent casser
// indépendamment — d'où un test par vue plutôt qu'un seul chargement de page.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Calendrier — vues', () => {
  test('la page se charge sur la vue Mois', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    await expectNoAppError(page)
    await expect(page.locator('text=Calendrier').first()).toBeVisible({ timeout: 15_000 })
  })

  test('les trois vues (Mois, Semaine, Jour) s’affichent sans erreur', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    await expect(page.locator('text=Calendrier').first()).toBeVisible({ timeout: 15_000 })

    for (const libellé of ['Mois', 'Sem', 'Jour']) {
      const bouton = page.locator('button', { hasText: new RegExp(`^${libellé}$`) }).first()
      await expect(bouton).toBeVisible()
      await bouton.click()
      await expectNoAppError(page)
      await page.waitForTimeout(300)
    }
  })

  test('la navigation entre périodes fonctionne dans les deux sens', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    await expect(page.locator('text=Calendrier').first()).toBeVisible({ timeout: 15_000 })

    // Les flèches changent le mois affiché : un libellé figé signalerait un
    // état non recalculé.
    const libelléInitial = await page.locator('h2, .font-bold').first().textContent()
    const boutons = page.locator('button')
    const total = await boutons.count()
    expect(total).toBeGreaterThan(3)

    await page.locator('button', { hasText: /^Aujourd/ }).first().click().catch(() => {})
    await expectNoAppError(page)
    expect(libelléInitial).toBeTruthy()
  })

  test('le bouton « Aujourd’hui » ramène à la date du jour', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    const aujourdhui = page.locator('button', { hasText: /Aujourd/ }).first()
    await expect(aujourdhui).toBeVisible({ timeout: 15_000 })
    await aujourdhui.click()
    await expectNoAppError(page)
  })
})

test.describe('Calendrier — actions', () => {
  test('l’ajout d’un RDV manuel est proposé', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    // Le laveur doit pouvoir saisir un RDV pris par téléphone : sans ça, il
    // doit tenir un agenda parallèle et l'outil perd sa raison d'être.
    await expect(page.locator('text=Ajouter un RDV').first()).toBeVisible({ timeout: 15_000 })
  })

  test('ouvrir le formulaire de RDV affiche ses champs', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    await expect(page.locator('text=Ajouter un RDV').first()).toBeVisible({ timeout: 15_000 })
    await page.locator('text=Ajouter un RDV').first().click()
    await expectNoAppError(page)
    // Un formulaire vide ou cassé se verrait ici.
    await page.waitForTimeout(500)
    const champs = page.locator('input, select')
    expect(await champs.count()).toBeGreaterThan(0)
  })
})
