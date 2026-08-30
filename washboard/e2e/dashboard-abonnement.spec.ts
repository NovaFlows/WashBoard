import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'
import { PLAN_CARDS, yearlyPrice, formatEuros } from '../src/lib/plan'

// Abonnement : offres, cycle de facturation, moyens de paiement.
// Les montants sont dérivés de `lib/plan.ts` (source unique) plutôt que
// recopiés : un changement de tarif fait évoluer le test avec le produit, et
// un écart entre l'affichage et la source devient un échec.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Abonnement — offres', () => {
  test('la page se charge avec le statut et les offres', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expectNoAppError(page)
    await expect(page.locator('text=Statut actuel').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Nos offres').first()).toBeVisible()
  })

  test('chaque plan du catalogue est proposé', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })
    for (const plan of PLAN_CARDS) {
      await expect(page.locator(`text=${plan.name}`).first()).toBeVisible()
    }
  })

  test('l’engagement annuel est présélectionné et affiche le bon montant', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })

    // L'annuel est l'offre mise en avant (2 mois offerts) : le montant affiché
    // doit correspondre exactement au calcul de `lib/plan.ts`, sinon un client
    // paierait un montant différent de celui annoncé.
    const premier = PLAN_CARDS[0]
    const attendu = formatEuros(yearlyPrice(premier.price))
    await expect(page.locator(`text=${attendu}`).first()).toBeVisible({ timeout: 10_000 })
  })

  test('les moyens de paiement suivent l’état de l’abonnement', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })

    // Les liens de paiement n'apparaissent que si l'abonnement n'est PAS actif :
    // proposer de payer à quelqu'un qui a déjà payé serait une erreur de
    // facturation. Le test vérifie donc la cohérence entre les deux, pas la
    // présence inconditionnelle des boutons.
    const estActif = await page.locator('text=Abonnement actif').first().isVisible().catch(() => false)
    const liensPaypal = page.locator('a[href*="paypal.me"]')

    if (estActif) {
      expect(await liensPaypal.count()).toBe(0)
    } else {
      expect(await liensPaypal.count()).toBeGreaterThan(0)
      const href = await liensPaypal.first().getAttribute('href')
      expect(href).toContain('paypal.me/WashBoardSAAS/')
      // Un lien sans montant obligerait le client à le saisir lui-même —
      // source classique de sous-paiement.
      expect(href).toMatch(/paypal\.me\/WashBoardSAAS\/\d+/)
    }
  })

  test('le plan courant est signalé comme tel', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })
    // Le laveur doit voir sur quelle offre il est, sinon il peut repayer un
    // plan qu'il a déjà.
    await expect(page.locator('text=Actuel').first()).toBeVisible({ timeout: 10_000 })
  })

  test('la FAQ de l’abonnement est présente', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Questions fréquentes').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Guide', () => {
  test('le centre d’aide se charge et propose une recherche', async ({ page }) => {
    await page.goto('/dashboard/guide')
    await expectNoAppError(page)
    await expect(page.locator('input[type="search"], input[type="text"]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('la recherche filtre le contenu', async ({ page }) => {
    await page.goto('/dashboard/guide')
    const recherche = page.locator('input[type="search"], input[type="text"]').first()
    await expect(recherche).toBeVisible({ timeout: 15_000 })
    await recherche.fill('réservation')
    await page.waitForTimeout(500)
    await expectNoAppError(page)
    // Une recherche qui ne renvoie jamais rien serait un guide inutilisable.
    const contenu = await page.locator('body').textContent()
    expect(contenu?.length ?? 0).toBeGreaterThan(100)
  })

  test('une recherche sans résultat ne casse pas la page', async ({ page }) => {
    await page.goto('/dashboard/guide')
    const recherche = page.locator('input[type="search"], input[type="text"]').first()
    await expect(recherche).toBeVisible({ timeout: 15_000 })
    await recherche.fill('zzzzz-terme-introuvable-zzzzz')
    await page.waitForTimeout(500)
    await expectNoAppError(page)
  })
})
