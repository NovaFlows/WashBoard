import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'

// Clôture d'un créneau passé : « Terminé » émet la facture, donc l'application
// demande d'abord si le rendez-vous a bien eu lieu.
//
// Deux limites assumées, plutôt qu'un test qui mentirait :
//
//  1. Le test ne CRÉE pas son rendez-vous passé. La route de réservation refuse
//     une date passée (« Ce créneau est déjà passé »), et il n'existe pas de
//     base de test séparée : fabriquer la donnée demanderait un accès direct à
//     la base de production. Le test se déclare donc ignoré quand le compte de
//     test n'a aucun créneau passé à clôturer.
//  2. Le cas inverse — un rendez-vous à VENIR se clôture d'un seul clic, sans
//     question — n'est pas testé ici : le vérifier voudrait dire cliquer, donc
//     clôturer pour de vrai un rendez-vous et émettre une facture sur le compte
//     de test. Il est couvert par `src/lib/cloture.test.ts`, qui teste la règle
//     de décision elle-même.
//
// Ce que ce test garantit : quand la question s'ouvre, elle propose bien les
// deux réponses, et « Revenir » ne change rien.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Clôture d’un créneau passé', () => {
  test('la question s’ouvre, propose les deux réponses, et « Revenir » ne change rien', async ({ page }, testInfo) => {
    await page.goto('/dashboard')
    await expectNoAppError(page)

    const cloturer = page.getByRole('button', { name: 'Clôturer' }).first()
    testInfo.skip(await cloturer.count() === 0, 'aucun créneau passé à clôturer sur le compte de test')

    await cloturer.click()

    const question = page.getByRole('dialog', { name: /Avez-vous fait ce rendez-vous/ })
    await expect(question).toBeVisible({ timeout: 10_000 })
    await expect(question.getByRole('button', { name: /Oui, je l’ai fait/ })).toBeVisible()
    await expect(question.getByRole('button', { name: /Non, il n’a pas eu lieu/ })).toBeVisible()

    // Sortie sans effet : le rendez-vous reste tel quel, et son bouton aussi.
    await question.getByRole('button', { name: 'Revenir' }).click()
    await expect(question).toBeHidden()
    await expect(page.getByRole('button', { name: 'Clôturer' }).first()).toBeVisible()
    await expectNoAppError(page)
  })

  test('la touche Échap ferme la question sans rien clôturer', async ({ page }, testInfo) => {
    await page.goto('/dashboard')
    const cloturer = page.getByRole('button', { name: 'Clôturer' }).first()
    testInfo.skip(await cloturer.count() === 0, 'aucun créneau passé à clôturer sur le compte de test')

    await cloturer.click()
    const question = page.getByRole('dialog', { name: /Avez-vous fait ce rendez-vous/ })
    await expect(question).toBeVisible({ timeout: 10_000 })

    await page.keyboard.press('Escape')
    await expect(question).toBeHidden()
    await expect(page.getByRole('button', { name: 'Clôturer' }).first()).toBeVisible()
  })
})
