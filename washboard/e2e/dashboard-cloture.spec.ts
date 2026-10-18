import { test, expect, type Page, type TestInfo } from '@playwright/test'
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

// v2 (2026-10-18) : l'accueil marque « À clôturer » un rendez-vous fini mais pas clôturé ;
// son détail, dans l'Agenda, propose « Marquer terminé » (ou « Terminé » s'il était resté
// en attente), qui pose la question. L'ancien bouton « Clôturer » de l'accueil v1 n'existe
// plus : le test le comptait dans le rendu serveur, avant que la v2 ne le remplace, puis
// attendait indéfiniment de cliquer dessus.
async function ouvrirQuestion(page: Page, testInfo: TestInfo) {
  await page.goto('/dashboard')
  await expectNoAppError(page)
  await expect(page.getByRole('navigation', { name: 'Navigation' })).toBeVisible({ timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  const aCloturer = page.getByRole('main').getByRole('link').filter({ hasText: 'À clôturer' }).first()
  testInfo.skip(await aCloturer.count() === 0, 'aucun créneau passé à clôturer sur le compte de test')

  await aCloturer.click()
  await page.getByRole('button', { name: /^(Marquer terminé|Terminé)$/ }).first().click()
  const question = page.getByRole('dialog', { name: /Avez-vous fait ce rendez-vous/ })
  await expect(question).toBeVisible({ timeout: 10_000 })
  return question
}

test.describe('Clôture d’un créneau passé', () => {
  test('la question s’ouvre, propose les deux réponses, et « Revenir » ne change rien', async ({ page }, testInfo) => {
    const question = await ouvrirQuestion(page, testInfo)
    await expect(question.getByRole('button', { name: /Oui, je l’ai fait/ })).toBeVisible()
    await expect(question.getByRole('button', { name: /Non, il n’a pas eu lieu/ })).toBeVisible()

    // Sortie sans effet : le rendez-vous reste tel quel, et son bouton aussi.
    await question.getByRole('button', { name: 'Revenir' }).click()
    await expect(question).toBeHidden()
    await expect(page.getByRole('button', { name: /^(Marquer terminé|Terminé)$/ }).first()).toBeVisible()
    await expectNoAppError(page)
  })

  test('la touche Échap ferme la question sans rien clôturer', async ({ page }, testInfo) => {
    const question = await ouvrirQuestion(page, testInfo)
    await page.keyboard.press('Escape')
    await expect(question).toBeHidden()
    await expect(page.getByRole('button', { name: /^(Marquer terminé|Terminé)$/ }).first()).toBeVisible()
  })
})
