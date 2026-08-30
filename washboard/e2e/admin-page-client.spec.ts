import { test, expect } from '@playwright/test'
import { e2eLabel, expectNoAppError, hasWasherCredentials, cleanupE2eObjects } from './helpers'

// Administration de la page client : identité, prestations, disponibilités.
//
// ⚠️ Ces tests écrivent dans la vraie base (pas de séparation dev/prod). Tout
// objet créé est préfixé `[E2E]` et supprimé en fin de test, y compris si
// l'assertion échoue — un `afterEach` de nettoyage plutôt qu'une suppression
// en fin de corps, sinon un échec laisserait des déchets en base à chaque
// exécution ratée.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Administration — navigation', () => {
  test('les trois onglets sont accessibles et rendent leur contenu', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await expectNoAppError(page)

    await expect(page.getByTestId('admin-tab-identite')).toBeVisible()
    await expect(page.getByTestId('admin-tab-prestations')).toBeVisible()
    await expect(page.getByTestId('admin-tab-disponibilites')).toBeVisible()

    await page.getByTestId('admin-tab-prestations').click()
    await expect(page.locator('text=+ Ajouter une prestation')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('admin-tab-disponibilites').click()
    await expectNoAppError(page)

    await page.getByTestId('admin-tab-identite').click()
    await expectNoAppError(page)
  })
})

test.describe('Identité de la page client', () => {
  test('le formulaire expose le message d’accueil et le site web', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-identite').click()
    await expectNoAppError(page)
    // Le message d'accueil et l'URL du site sont les deux champs qui alimentent
    // la page publique (le site sert aussi à récupérer les avis clients).
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 })
  })

  test('toutes les sections de configuration sont rendues', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-identite').click()
    await expectNoAppError(page)

    // Cet onglet ne porte pas que l'identité : il concentre aussi la zone
    // d'intervention, les créneaux intelligents et Google Agenda. Une section
    // qui disparaît (erreur de rendu conditionnel) rendrait un réglage
    // inatteignable sans aucun message d'erreur.
    for (const section of [
      "Couleur de la marque",
      "Fond de la page client",
      "Zone d'intervention",
      'Créneaux intelligents',
      'Google Agenda',
    ]) {
      await expect(page.locator(`text=${section}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('la zone d’intervention propose ses modes de délimitation', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-identite').click()
    // La zone décide si un client peut réserver : elle conditionne une
    // autorisation, donc son interrupteur doit rester présent.
    await expect(page.locator("text=Zone d'intervention").first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Mode de délimitation').first()).toBeVisible()
  })

  test('les créneaux intelligents exposent leur remise', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-identite').click()
    await expect(page.locator('text=Créneaux intelligents').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Remise proposée').first()).toBeVisible()
  })
})

test.describe('Prestations — cycle de vie complet', () => {
  test.afterEach(async ({ page }) => {
    await cleanupE2eObjects(page)
  })

  test('créer, retrouver puis supprimer une prestation', async ({ page }) => {
    const nom = e2eLabel('Prestation')

    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-prestations').click()
    await page.locator('text=+ Ajouter une prestation').click()

    await page.locator('input[placeholder="Lavage intérieur + extérieur"]').fill(nom)
    await page.locator('input[placeholder="80"]').fill('42')
    await page.locator('input[placeholder="90"]').fill('30')

    // Une catégorie est obligatoire pour choisir des types ; on prend la
    // première disponible plutôt que d'en supposer une en particulier.
    const categorySelect = page.locator('select').first()
    const options = await categorySelect.locator('option').count()
    if (options > 1) {
      await categorySelect.selectOption({ index: 1 })
      // Les types de la catégorie apparaissent : en cocher un rend le formulaire valide.
      const firstType = page.locator('input[type="checkbox"]').first()
      if (await firstType.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstType.check().catch(() => {})
      }
    }

    const save = page.locator('button', { hasText: 'Enregistrer' }).first()
    await expect(save).toBeEnabled({ timeout: 10_000 })
    await save.click()

    // La prestation apparaît dans la liste après enregistrement.
    await expect(page.locator(`text=${nom}`).first()).toBeVisible({ timeout: 15_000 })

    // Et elle est réellement persistée : un rechargement la retrouve.
    await page.reload()
    await page.getByTestId('admin-tab-prestations').click()
    await expect(page.locator(`text=${nom}`).first()).toBeVisible({ timeout: 15_000 })
  })

  test('le bouton Enregistrer reste inactif tant que le nom est vide', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-prestations').click()
    await page.locator('text=+ Ajouter une prestation').click()

    await page.locator('input[placeholder="80"]').fill('42')
    const save = page.locator('button', { hasText: 'Enregistrer' }).first()
    await expect(save).toBeDisabled()
  })

  test('annuler referme le formulaire sans rien créer', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-prestations').click()
    await page.locator('text=+ Ajouter une prestation').click()

    const nom = e2eLabel('Annulee')
    await page.locator('input[placeholder="Lavage intérieur + extérieur"]').fill(nom)
    await page.locator('button', { hasText: 'Annuler' }).first().click()

    await expect(page.locator('text=+ Ajouter une prestation')).toBeVisible()
    await expect(page.locator(`text=${nom}`)).toHaveCount(0)
  })
})

test.describe('Disponibilités', () => {
  test('les sept jours de la semaine sont proposés', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-disponibilites').click()
    await expectNoAppError(page)

    // Le laveur doit pouvoir ouvrir n'importe quel jour : si un jour manque,
    // des créneaux deviennent inatteignables côté client sans message d'erreur.
    for (const jour of ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']) {
      await expect(page.locator(`text=${jour}`).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('la section de blocage de période est accessible', async ({ page }) => {
    await page.goto('/dashboard/admin')
    await page.getByTestId('admin-tab-disponibilites').click()
    // Les congés sont ce qui a déjà causé un bug de production (RDV acceptés
    // pendant une absence) : la section doit rester présente et fonctionnelle.
    await expect(page.locator('input[placeholder="Ou saisissez un motif libre..."]')).toBeVisible({ timeout: 10_000 })
  })
})
