import { test, expect } from '@playwright/test'

// Inscription : la liste déroulante du pays du téléphone (2026-11-14). Aucun appel à une base : la
// route d'inscription est interceptée, on lit seulement ce que la page envoie.

async function ouvrir(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/signup', async route => {
    await route.fulfill({ status: 400, json: { error: 'arrêt du test' } })
  })
  await page.goto('/signup')
  await expect(page.getByLabel('Pays du téléphone')).toBeVisible()
}

async function remplir(page: import('@playwright/test').Page, numero: string) {
  await page.getByLabel('Nom de ton entreprise').fill('CleanCar')
  await page.getByLabel('Email').fill('toi@exemple.fr')
  await page.locator('#phone').fill(numero)
  await page.locator('#password').fill('motdepasse')
  await page.locator('#confirm').fill('motdepasse')
  await page.getByLabel(/J’ai lu et j’accepte/).check()
}

async function envoyer(page: import('@playwright/test').Page) {
  const requete = page.waitForRequest(r => new URL(r.url()).pathname === '/api/auth/signup')
  await page.getByRole('button', { name: /Lancer mon mois gratuit/ }).last().click()
  return (await requete).postDataJSON()
}

test('la liste propose France, Belgique et Suisse, et l’exemple suit le pays', async ({ page }, testInfo) => {
  await ouvrir(page)
  const liste = page.getByLabel('Pays du téléphone')
  await expect(liste.locator('option')).toHaveText(['FR +33', 'BE +32', 'CH +41'])
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '06 12 34 56 78')
  await liste.selectOption('BE')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '0470 12 34 56')
  await liste.selectOption('CH')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '079 123 45 67')
  await page.screenshot({ path: testInfo.outputPath('signup-pays.png'), scale: 'css' })
})

test('Suisse : un 079… part en +41, pas en 07 français', async ({ page }) => {
  await ouvrir(page)
  await page.getByLabel('Pays du téléphone').selectOption('CH')
  await remplir(page, '079 123 45 67')
  expect((await envoyer(page)).phone).toBe('+41791234567')
})

test('Belgique : un 0470… part en +32', async ({ page }) => {
  await ouvrir(page)
  await page.getByLabel('Pays du téléphone').selectOption('BE')
  await remplir(page, '0470 12 34 56')
  expect((await envoyer(page)).phone).toBe('+32470123456')
})

test('France : le numéro reste en 10 chiffres', async ({ page }) => {
  await ouvrir(page)
  await remplir(page, '06 12 34 56 78')
  expect((await envoyer(page)).phone).toBe('0612345678')
})

test('un numéro invalide pour le pays choisi est refusé avant l’envoi, avec l’exemple du pays', async ({ page }) => {
  await ouvrir(page)
  await page.getByLabel('Pays du téléphone').selectOption('CH')
  await remplir(page, '12')
  await page.getByRole('button', { name: /Lancer mon mois gratuit/ }).last().click()
  await expect(page.getByText(/invalide pour Suisse.*079 123 45 67/)).toBeVisible()
})
