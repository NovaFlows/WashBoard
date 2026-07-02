import { test, expect } from '@playwright/test'

// ── Santé ──────────────────────────────────────────────────────────────────

test('GET /api/health → status ok + DB connectée', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.status).toBe('ok')
  expect(json.checks.database).toBe('ok')
})

// ── Pages publiques ────────────────────────────────────────────────────────

test('Landing page se charge', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
  // Pas de page d'erreur Next.js
  await expect(page.locator('text=Application error')).not.toBeVisible()
})

test('Page login — formulaire email + mot de passe', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Espace Laveur')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible()
})

test('Page signup se charge', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('text=Application error')).not.toBeVisible()
})

test('Page mot de passe oublié se charge', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.locator('body')).toBeVisible()
  await expect(page.locator('text=Application error')).not.toBeVisible()
})

// ── Redirection auth ────────────────────────────────────────────────────────

test('/dashboard → redirige vers /login si non connecté', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})

// ── Page de réservation ────────────────────────────────────────────────────

test('/book/slug-inexistant → 404 gracieuse (pas 500)', async ({ page }) => {
  const res = await page.goto('/book/slug-de-test-inexistant-e2e')
  expect(res?.status()).not.toBe(500)
  // Next.js appelle notFound() → page 404 standard, aucun crash
})

// ── Pages légales ──────────────────────────────────────────────────────────

test('CGV se charge', async ({ page }) => {
  await page.goto('/cgv')
  await expect(page.locator('body')).toBeVisible()
})

test('Mentions légales se charge', async ({ page }) => {
  await page.goto('/mentions-legales')
  await expect(page.locator('body')).toBeVisible()
})

test('Politique de confidentialité se charge', async ({ page }) => {
  await page.goto('/confidentialite')
  await expect(page.locator('body')).toBeVisible()
})
