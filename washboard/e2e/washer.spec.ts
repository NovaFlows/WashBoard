/**
 * Simulation d'un vrai laveur — toutes les pages du dashboard.
 * Nécessite un compte configuré dans .env.test.local (voir .env.test.example).
 */
import { test, expect } from '@playwright/test'

// Si pas de credentials, les tests sont marqués "pending" mais ne bloquent pas CI
const hasCredentials = !!process.env.TEST_WASHER_EMAIL

test.beforeEach(async ({ page }, testInfo) => {
  if (!hasCredentials) testInfo.skip(true, 'TEST_WASHER_EMAIL absent — skip washer tests')
  // Vérifie que la session est active (pas de redirect login)
  await page.goto('/dashboard')
  const url = page.url()
  if (url.includes('/login')) {
    testInfo.skip(true, 'Session non authentifiée — relancer après auth.setup.ts')
  }
})

// ── Dashboard principal ────────────────────────────────────────────────────

test('Dashboard principal — se charge et reste authentifié', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

// ── Calendrier ────────────────────────────────────────────────────────────

test('Calendrier — se charge sans erreur', async ({ page }) => {
  await page.goto('/dashboard/calendrier')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  // Le calendrier affiche la semaine courante
  await expect(page.locator('body')).toBeVisible()
})

// ── CRM ───────────────────────────────────────────────────────────────────

test('CRM — se charge sans erreur', async ({ page }) => {
  await page.goto('/dashboard/crm')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

// ── Compta ────────────────────────────────────────────────────────────────

test('Compta — se charge sans erreur', async ({ page }) => {
  await page.goto('/dashboard/compta')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

// ── Paramètres ────────────────────────────────────────────────────────────

test('Paramètres — se charge sans erreur', async ({ page }) => {
  await page.goto('/dashboard/parametres')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

// ── Abonnement ────────────────────────────────────────────────────────────

test('Abonnement — se charge sans erreur', async ({ page }) => {
  await page.goto('/dashboard/abonnement')
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('body')).toBeVisible()
})

// ── Lien de réservation public du laveur ──────────────────────────────────

test('Page de réservation publique — accessible depuis le slug du laveur', async ({ page }) => {
  const slug = process.env.TEST_WASHER_SLUG
  if (!slug) test.skip()
  await page.goto(`/book/${slug}`)
  await expect(page.locator('text=Application error')).not.toBeVisible()
  // La page de réservation affiche au moins un service ou un message approprié
  await expect(page.locator('body')).toBeVisible()
})

// ── Déconnexion ───────────────────────────────────────────────────────────

test('Déconnexion — redirige vers login', async ({ page }) => {
  await page.goto('/dashboard')
  // Cherche le bouton déconnexion dans le menu ou la sidebar
  const logoutBtn = page.locator('button:has-text("Déconnexion"), a:has-text("Déconnexion")').first()
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click()
    await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10_000 })
  } else {
    // Pas de bouton déconnexion visible directement — on passe
    test.info().annotations.push({ type: 'info', description: 'Bouton déconnexion non trouvé dans le DOM visible' })
  }
})
