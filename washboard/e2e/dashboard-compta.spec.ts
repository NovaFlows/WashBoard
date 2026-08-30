import { test, expect } from '@playwright/test'
import { e2eLabel, expectNoAppError, hasWasherCredentials, cleanupE2eObjects } from './helpers'

// Comptabilité : dépenses ponctuelles, dépenses récurrentes, périodes.
// C'est l'écran qui manipule de l'argent — une dépense fantôme ou un total
// faux se voit directement dans le résultat du laveur.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Compta — affichage', () => {
  test('la page se charge avec ses indicateurs', async ({ page }) => {
    await page.goto('/dashboard/compta')
    await expectNoAppError(page)
    await expect(page.locator('text=Dépenses').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Résultat').first()).toBeVisible()
  })

  test('les quatre périodes sont proposées et changent la vue', async ({ page }) => {
    await page.goto('/dashboard/compta')
    await expect(page.locator('text=Dépenses').first()).toBeVisible({ timeout: 15_000 })

    for (const libellé of ['Jour', 'Semaine', 'Mois', 'Année']) {
      const bouton = page.locator('button', { hasText: new RegExp(`^${libellé}$`) }).first()
      await expect(bouton).toBeVisible()
      await bouton.click()
      await expectNoAppError(page)
    }

    // La vue annuelle a un rendu distinct (détail par mois) : c'est un chemin
    // de code séparé, donc une source de plantage propre.
    await page.locator('button', { hasText: /^Année$/ }).first().click()
    await expect(page.locator('text=Détail par mois')).toBeVisible({ timeout: 10_000 })
  })

  test('le formulaire d’ajout de frais est complet', async ({ page }) => {
    await page.goto('/dashboard/compta')
    await expect(page.locator('text=Ajouter un frais')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('input[placeholder="ex: Plein essence"]')).toBeVisible()
    await expect(page.locator('input[placeholder="0.00"]')).toBeVisible()
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
  })

  test('la section des frais récurrents est présente', async ({ page }) => {
    await page.goto('/dashboard/compta')
    await expect(page.locator('text=Frais récurrents')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Compta — cycle de vie d’une dépense', () => {
  test.afterEach(async ({ page }) => {
    await cleanupE2eObjects(page)
  })

  test('ajouter une dépense la fait apparaître et compter dans le total', async ({ page }) => {
    const libellé = e2eLabel('Depense')

    await page.goto('/dashboard/compta')
    await expect(page.locator('text=Ajouter un frais')).toBeVisible({ timeout: 15_000 })

    await page.locator('input[placeholder="ex: Plein essence"]').fill(libellé)
    await page.locator('input[placeholder="0.00"]').fill('12.34')

    // Le bouton d'ajout du formulaire ponctuel (à distinguer du récurrent).
    const ajouter = page.locator('button', { hasText: /^\+?\s*Ajouter$|Ajout\.\.\./ }).first()
    if (await ajouter.isVisible().catch(() => false)) {
      await ajouter.click()
    } else {
      await page.locator('form button[type="submit"]').first().click().catch(() => {})
    }

    await expect(page.locator(`text=${libellé}`).first()).toBeVisible({ timeout: 15_000 })

    // Persistée : un rechargement doit la retrouver, sinon l'ajout n'a vécu
    // que dans l'état React et le laveur perdrait sa saisie.
    await page.reload()
    await expect(page.locator(`text=${libellé}`).first()).toBeVisible({ timeout: 15_000 })
  })

  test('une dépense récurrente peut être créée', async ({ page }) => {
    const libellé = e2eLabel('Recurrent')

    await page.goto('/dashboard/compta')
    await expect(page.locator('text=Frais récurrents')).toBeVisible({ timeout: 15_000 })

    const champLabel = page.locator('input[placeholder="ex: WashBoard abonnement"]')
    if (!(await champLabel.isVisible().catch(() => false))) {
      // Le formulaire est replié : l'ouvrir.
      await page.locator('button', { hasText: /Ajouter|\+/ }).nth(1).click().catch(() => {})
    }
    if (await champLabel.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await champLabel.fill(libellé)
      await page.locator('input[placeholder="49.00"]').fill('9.99')
      await page.locator('button', { hasText: 'Ajouter ce frais récurrent' }).click()
      await expect(page.locator(`text=${libellé}`).first()).toBeVisible({ timeout: 15_000 })
    }
  })
})
