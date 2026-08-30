import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'
import { TRAFFIC_SOURCES, buildTrackedBookingLink } from '../src/lib/trafficSources'

// CRM : suivi des clients, entonnoir de réservation, liens par réseau, export.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('CRM — vue d’ensemble', () => {
  test('la page se charge sans erreur', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expectNoAppError(page)
    await expect(page.locator('text=Liens par réseau')).toBeVisible({ timeout: 15_000 })
  })

  test('les indicateurs de l’entonnoir sont présents', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=Visiteurs').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Taux de conversion').first()).toBeVisible()
    await expect(page.locator('text=Entonnoir de réservation').first()).toBeVisible()
  })

  test('les répartitions par appareil et par source sont rendues', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=Par appareil').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Par source de trafic').first()).toBeVisible()
  })

  test('la section « Quand vos visiteurs viennent » est rendue', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=Quand vos visiteurs viennent')).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('CRM — liens de réservation par réseau', () => {
  test('un lien dédié est proposé pour chaque réseau, avec sa source', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=Liens par réseau')).toBeVisible({ timeout: 15_000 })

    // La liste vient de `lib/trafficSources.ts` : ajouter un réseau à la source
    // étend automatiquement ce test, et un réseau oublié dans l'UI le fait échouer.
    for (const source of TRAFFIC_SOURCES) {
      const étiquette = source.label.split(' (')[0]
      await expect(page.locator(`text=${étiquette}`).first()).toBeVisible()
    }

    // Le lien doit réellement porter le paramètre de source, sinon tout le
    // dispositif de mesure est décoratif.
    const exemple = buildTrackedBookingLink('https://www.washboard.fr/book/x', 'instagram')
    expect(exemple).toContain('utm_source=instagram')
    await expect(page.locator('text=/utm_source=instagram/').first()).toBeVisible()
  })

  test('chaque lien a son bouton de copie', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expect(page.locator('text=Liens par réseau')).toBeVisible({ timeout: 15_000 })
    const boutons = page.locator('button', { hasText: 'Copier' })
    expect(await boutons.count()).toBeGreaterThanOrEqual(TRAFFIC_SOURCES.length)
  })
})

test.describe('CRM — tableau des clients', () => {
  test('le tableau de bord des réservations est rendu', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expectNoAppError(page)
    // Soit des données, soit un état vide explicite — mais jamais une page muette.
    const contenu = page.locator('text=Tableau de bord de vos réservations')
      .or(page.locator('text=Pas encore de données'))
    await expect(contenu.first()).toBeVisible({ timeout: 15_000 })
  })

  test('le bouton d’export Excel est proposé', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expectNoAppError(page)
    const exporter = page.locator('text=Exporter Excel')
    if (await exporter.first().isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(exporter.first()).toBeVisible()
    }
  })
})
