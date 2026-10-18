import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'

// Agenda : c'est l'écran de travail quotidien du laveur. Les trois vues sont des
// rendus distincts, donc trois chemins de code qui peuvent casser indépendamment —
// d'où un test par vue plutôt qu'un seul chargement de page.
//
// Écrits pour l'Agenda v2 (2026-10-18) : sur ordinateur, tous les laveurs l'ont depuis
// le 2026-10-12 (`BUREAU_POUR_TOUS`), et c'est lui que reçoit le navigateur des tests.
// L'ancien calendrier (« Calendrier », boutons « Mois / Sem / Jour ») n'est plus servi
// qu'aux tablettes sans souris.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

async function ouvrirAgenda(page: import('@playwright/test').Page) {
  await page.goto('/dashboard/calendrier')
  await expectNoAppError(page)
  await expect(page.getByRole('heading', { name: 'Agenda', level: 1 })).toBeVisible({ timeout: 15_000 })
}

test.describe('Agenda — vues', () => {
  test('la page se charge sur la vue Jour', async ({ page }) => {
    await ouvrirAgenda(page)
    await expect(page.getByRole('button', { name: 'Jour', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('les trois vues (Jour, Semaine, Mois) s’affichent sans erreur', async ({ page }) => {
    await ouvrirAgenda(page)
    for (const vue of ['Semaine', 'Mois', 'Jour']) {
      const bouton = page.getByRole('button', { name: vue, exact: true })
      await bouton.click()
      await expect(bouton).toHaveAttribute('aria-pressed', 'true')
      await expectNoAppError(page)
    }
  })

  test('la navigation entre jours fonctionne dans les deux sens', async ({ page }) => {
    await ouvrirAgenda(page)
    // « Aujourd’hui » n'apparaît que loin du jour même : sa présence dit si la date a
    // vraiment changé, ce qu'un libellé figé ne montrerait pas.
    const retour = page.getByRole('main').getByRole('button', { name: 'Aujourd’hui', exact: true })
    await expect(retour).toHaveCount(0)
    await page.getByRole('button', { name: 'Jour suivant' }).click()
    await expect(retour).toBeVisible()
    await page.getByRole('button', { name: 'Jour précédent' }).click()
    await expect(retour).toHaveCount(0)
    await expectNoAppError(page)
  })

  test('le bouton « Aujourd’hui » ramène à la date du jour', async ({ page }) => {
    await ouvrirAgenda(page)
    await page.getByRole('button', { name: 'Jour suivant' }).click()
    await page.getByRole('button', { name: 'Jour suivant' }).click()
    const retour = page.getByRole('main').getByRole('button', { name: 'Aujourd’hui', exact: true })
    await retour.click()
    await expect(retour).toHaveCount(0)
    await expect(page.getByText(/rendez-vous aujourd’hui/).first()).toBeVisible()
  })
})

test.describe('Agenda — actions', () => {
  test('l’ajout d’un RDV manuel est proposé', async ({ page }) => {
    // Le laveur doit pouvoir saisir un RDV pris par téléphone : sans ça, il
    // doit tenir un agenda parallèle et l'outil perd sa raison d'être.
    await ouvrirAgenda(page)
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    const choix = page.getByRole('dialog', { name: 'Ajouter' })
    await expect(choix.getByRole('button', { name: /Nouveau rendez-vous/ })).toBeVisible()
    await expect(choix.getByRole('button', { name: /Bloquer une période/ })).toBeVisible()
  })

  test('ouvrir le formulaire de RDV affiche ses champs', async ({ page }) => {
    await ouvrirAgenda(page)
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
    await page.getByRole('dialog', { name: 'Ajouter' }).getByRole('button', { name: /Nouveau rendez-vous/ }).click()
    const formulaire = page.getByRole('dialog', { name: 'Nouveau rendez-vous' })
    await expect(formulaire).toBeVisible()
    // Un formulaire vide ou cassé se verrait ici. On referme sans rien créer.
    for (const champ of ['Date', 'Heure', 'Service', 'Nom complet *', 'Téléphone *']) {
      await expect(formulaire.getByLabel(champ, { exact: true })).toBeVisible()
    }
    await expect(formulaire.getByRole('button', { name: 'Créer le rendez-vous' })).toBeVisible()
    await formulaire.getByRole('button', { name: 'Annuler' }).click()
    await expect(formulaire).toBeHidden()
  })
})
