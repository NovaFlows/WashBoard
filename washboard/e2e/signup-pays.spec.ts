import { test, expect } from '@playwright/test'

// Inscription : la liste déroulante du pays du téléphone (2026-11-14). Aucun appel à une base : la
// route d'inscription est interceptée, on lit seulement ce que la page envoie.

async function ouvrir(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/signup', async route => {
    await route.fulfill({ status: 400, json: { error: 'arrêt du test' } })
  })
  await page.goto('/signup')
  await expect(page.getByRole('button', { name: 'Pays du téléphone' })).toBeVisible()
}

/** Ouvre la liste puis choisit le pays par son nom. */
async function choisirPays(page: import('@playwright/test').Page, nom: string) {
  await page.getByRole('button', { name: 'Pays du téléphone' }).click()
  await page.getByRole('option', { name: new RegExp(nom) }).click()
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
  await page.getByRole('button', { name: /Lancer mes \d+ jours gratuits/ }).last().click()
  return (await requete).postDataJSON()
}

test('la liste propose France, Belgique et Suisse, et l’exemple suit le pays', async ({ page }, testInfo) => {
  await ouvrir(page)
  await expect(page.getByRole('button', { name: 'Pays du téléphone' })).toContainText('+33')
  await page.getByRole('button', { name: 'Pays du téléphone' }).click()
  const options = page.getByRole('option')
  // Le banc d'essai ouvre aussi le Luxembourg et le Québec (NEXT_PUBLIC_PAYS_INSCRIPTION, voir la config).
  await expect(options).toHaveCount(5)
  await expect(options.nth(0)).toContainText('France')
  await expect(options.nth(1)).toContainText('Belgique')
  await expect(options.nth(2)).toContainText('Suisse')
  await expect(options.nth(3)).toContainText('Luxembourg')
  await expect(options.nth(4)).toContainText('Québec')
  await page.screenshot({ path: testInfo.outputPath('signup-pays-ouvert.png'), scale: 'css' })
  await options.nth(0).click()
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '06 12 34 56 78')
  await choisirPays(page, 'Belgique')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '0470 12 34 56')
  await choisirPays(page, 'Suisse')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '079 123 45 67')
  await page.screenshot({ path: testInfo.outputPath('signup-pays.png'), scale: 'css' })
})

test('Suisse : un 079… part en +41, pas en 07 français', async ({ page }) => {
  await ouvrir(page)
  await choisirPays(page, 'Suisse')
  await remplir(page, '079 123 45 67')
  expect((await envoyer(page)).phone).toBe('+41791234567')
})

test('Belgique : un 0470… part en +32', async ({ page }) => {
  await ouvrir(page)
  await choisirPays(page, 'Belgique')
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
  await choisirPays(page, 'Suisse')
  await remplir(page, '12')
  await page.getByRole('button', { name: /Lancer mes \d+ jours gratuits/ }).last().click()
  await expect(page.getByText(/invalide pour Suisse.*079 123 45 67/)).toBeVisible()
})

test('Luxembourg : un 621… part en +352, sans zéro de tête', async ({ page }) => {
  await ouvrir(page)
  await choisirPays(page, 'Luxembourg')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '621 123 456')
  await remplir(page, '621 123 456')
  expect((await envoyer(page)).phone).toBe('+352621123456')
})

test('Québec : un 514… part en +1', async ({ page }) => {
  await ouvrir(page)
  await choisirPays(page, 'Québec')
  await expect(page.locator('#phone')).toHaveAttribute('placeholder', '514 234 5678')
  await remplir(page, '(514) 234-5678')
  expect((await envoyer(page)).phone).toBe('+15142345678')
})

test('Québec : un indicatif d’un autre endroit (Toronto, 416) est refusé', async ({ page }) => {
  await ouvrir(page)
  await choisirPays(page, 'Québec')
  await remplir(page, '416 234 5678')
  await page.getByRole('button', { name: /Lancer mes \d+ jours gratuits/ }).last().click()
  await expect(page.getByText(/invalide pour Québec/)).toBeVisible()
})
