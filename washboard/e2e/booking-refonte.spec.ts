import { test, expect, type Page } from '@playwright/test'

// Contrat UI sur données fictives. Aucun appel à une base ni création de réservation réelle.
async function fixture(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+02:00'))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname === '/api/zone/check') body = { allowed: true }
    if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] }
    if (url.pathname === '/api/slots/smart') {
      const date = url.searchParams.get('date')!
      body = { smartWindows: [{ start: `${date}T14:00:00+02:00`, end: `${date}T14:30:00+02:00` }], bookingConstraints: [], discountType: 'fixed', discountValue: 10 }
    }
    if (url.pathname === '/api/bookings') body = { data: { id: '00000000-0000-4000-8000-000000000099', booked_price: 75 } }
    await route.fulfill({ json: body })
  })
  await page.goto('/dev/booking-preview')
  await expect(page.getByRole('heading', { name: 'Que faut-il laver ?' })).toBeVisible()
}

async function chooseService(page: Page) {
  await page.getByRole('radio', { name: /^Intérieur/ }).check()
  await page.getByRole('checkbox', { name: /Shampoing/ }).check()
  await expect(page.locator('.wb-booking-footer')).toContainText('75€')
  await page.getByTestId('booking-continue').click()
}

async function chooseSlot(page: Page) {
  await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
  await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
  await page.getByRole('button', { name: /^14 h −10/ }).click()
  await expect(page.locator('.wb-booking-footer')).toContainText('65€')
  await expect(page.getByTestId('booking-continue')).toBeEnabled()
}

test('parcours mobile, prix en direct, retour et confirmation', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await fixture(page)
  await expect(page.getByTestId('booking-continue')).toBeDisabled()
  await expect(page.locator('.wb-booking-footer')).toContainText('35€')
  await page.screenshot({ path: testInfo.outputPath('01-prestation.png'), scale: 'css' })
  await chooseService(page)
  await chooseSlot(page)
  await page.screenshot({ path: testInfo.outputPath('02-creneau.png'), scale: 'css' })
  await page.getByRole('button', { name: 'Détail du prix' }).click()
  await expect(page.getByRole('dialog')).toContainText('Shampoing des sièges')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByTestId('booking-continue').click()
  await page.getByLabel('Nom et prénom').fill('Client Démo')
  await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
  await page.getByLabel(/Email pour/).fill('client@example.test')
  await page.getByLabel('Modèle du véhicule').fill('Peugeot 208 grise')
  await expect(page.getByTestId('booking-continue')).toBeEnabled()
  await page.getByRole('button', { name: 'Modifier : Où et quand', exact: true }).click()
  await expect(page.getByLabel('Adresse du lavage')).toHaveValue('12 rue Mercière, 69002 Lyon')
  await expect(page.getByTestId('booking-continue')).toBeEnabled()
  await page.getByTestId('booking-continue').click()
  await expect(page.getByLabel('Nom et prénom')).toHaveValue('Client Démo')
  await page.getByLabel('Je réserve pour une entreprise').check()
  await expect(page.getByTestId('booking-continue')).toBeDisabled()
  await page.getByLabel('Nom de l’entreprise').fill('Société Démo')
  await page.getByLabel('SIRET', { exact: true }).fill('12345678901234')
  await page.screenshot({ path: testInfo.outputPath('03-contact.png'), fullPage: true })
  const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
  await page.getByTestId('booking-continue').click()
  const payload = (await request).postDataJSON()
  expect(payload).toMatchObject({ booked_price: 75, smart_discount: 10, is_professional: true, company_name: 'Société Démo' })
  expect(payload.vehicles_detail[0]).toMatchObject({ models: ['Peugeot 208 grise'], addons: [{ id: 'seats' }] })
  await expect(page.getByRole('heading', { name: 'Réservation envoyée !' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('options par véhicule et changement de prestation invalident le créneau', async ({ page }) => {
  await fixture(page)
  await chooseService(page)
  await chooseSlot(page)
  await page.getByRole('button', { name: 'Modifier : Prestation', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: /Shampoing/ })).toBeChecked()
  await page.getByRole('button', { name: 'Ajouter un véhicule (citadine)', exact: true }).click()
  await expect(page.locator('.wb-booking-footer')).toContainText('120€')
  await expect(page.getByRole('checkbox', { name: /Shampoing/ }).nth(0)).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /Shampoing/ }).nth(1)).not.toBeChecked()
  await page.getByRole('checkbox', { name: /Poils/ }).nth(1).check()
  await expect(page.locator('.wb-booking-footer')).toContainText('135€')
  await page.getByTestId('booking-continue').click()
  await expect(page.getByTestId('booking-continue')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Modifier : Où et quand', exact: true })).not.toBeVisible()
})

test('échec de vérification de zone, reprise et affichage sombre sans débordement', async ({ page }, testInfo) => {
  await fixture(page)
  await chooseService(page)
  await page.route('**/api/zone/check?**', route => route.fulfill({ status: 503, json: {} }))
  await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
  await expect(page.locator('#wb-section-2').getByRole('alert')).toContainText('Impossible de vérifier')
  await expect(page.getByTestId('booking-continue')).toBeDisabled()
  await page.unroute('**/api/zone/check?**')
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByText('Dans le secteur du laveur', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Changer le thème' }).click()
  await page.screenshot({ path: testInfo.outputPath('04-sombre.png'), scale: 'css' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('petit écran, types différents, puis affichage ordinateur', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await fixture(page)
  await page.getByRole('radio', { name: /^Intérieur/ }).check()
  await page.getByRole('button', { name: 'Ajouter un véhicule (citadine)', exact: true }).click()
  await page.getByRole('button', { name: 'Mes véhicules sont de types différents' }).click()
  await page.getByRole('button', { name: 'SUV', exact: true }).click()
  await expect(page.locator('.wb-booking-footer')).toContainText('145€')
  await page.getByRole('checkbox', { name: /Shampoing/ }).nth(2).check()
  await expect(page.locator('.wb-booking-footer')).toContainText('175€')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.locator('.wb-booking-footer')).toBeInViewport()
  const footer = await page.locator('.wb-booking-footer').boundingBox()
  expect(footer?.width).toBe(512)
  expect(footer?.x).toBe(464)
  await page.screenshot({ path: testInfo.outputPath('05-desktop.png'), scale: 'css' })
})

test('choix de page : erreur sans bascule, enregistrement et réglages conservés', async ({ page }, testInfo) => {
  const requests: unknown[] = []
  let fails = true
  await page.route('**/api/washer', async route => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ status: fails ? 500 : 200, json: fails ? { error: 'Enregistrement impossible' } : { success: true } })
  })
  // Aperçu des avis (lib/googleReviews.ts) : chargé au montage de l'écran,
  // sans rapport avec ce que ce test vérifie — réponse neutre, pas d'appel réel.
  await page.route('**/api/washer/avis-preview', route => route.fulfill({ json: { aSource: false, aggregate: null } }))
  await page.goto('/dev/booking-preview?mode=settings')
  const standard = page.getByRole('switch', { name: 'Page par défaut' })
  await expect(standard).toBeChecked()
  // Logo et Couleur restent visibles quel que soit le mode depuis le
  // 2026-10-04 (demande d'Alexandre) : seul Fond, lui, reste caché en mode
  // par défaut — c'est donc lui qui marque la bascule ici désormais.
  await expect(page.getByRole('button', { name: /Fond de la page/ })).not.toBeVisible()
  await standard.click()
  await expect(page.getByRole('region', { name: 'Votre page de réservation' }).getByRole('alert')).toHaveText('Enregistrement impossible')
  await expect(standard).toBeChecked()
  fails = false
  await standard.click()
  await expect(standard).not.toBeChecked()
  await expect(page.getByRole('button', { name: /Fond de la page/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Message d’accueil/ })).toContainText('Bienvenue chez Brillance Mobile')
  await standard.click()
  await expect(standard).toBeChecked()
  await standard.click()
  await expect(page.getByRole('button', { name: /Message d’accueil/ })).toContainText('Bienvenue chez Brillance Mobile')
  expect(requests).toEqual([{ booking_page_mode: 'custom' }, { booking_page_mode: 'custom' }, { booking_page_mode: 'default' }, { booking_page_mode: 'custom' }])
  await page.screenshot({ path: testInfo.outputPath('choix-page.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('la page classique retrouve son en-tête et son parcours séparé', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.fulfill({ json: { bookings: [], unavailabilities: [] } }))
  await page.goto('/dev/booking-preview?mode=custom')
  await expect(page.getByText('Bienvenue chez Brillance Mobile')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choisissez votre prestation' })).toBeVisible()
  await expect(page.locator('.wb-booking-footer')).toHaveCount(0)
  await page.getByRole('button', { name: /^Intérieur/ }).click()
  await page.locator('[data-testid="vehicle-increment"][data-vehicle-type="citadine"]').click()
  await page.getByPlaceholder('Modèle du véhicule').fill('Peugeot 208 grise')
  await page.getByTestId('service-continue').click()
  await expect(page.getByRole('heading', { name: 'Options & suppléments' })).toBeVisible()
  await page.getByTestId('options-continue').click()
  await expect(page.getByRole('heading', { name: 'Choisissez un créneau' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('page-classique.png'), fullPage: true })
})

test('personnalisation web : les réglages classiques se retrouvent après chaque bascule', async ({ page }) => {
  await page.route('**/api/washer', route => route.fulfill({ json: { success: true } }))
  // Aperçu des avis (lib/googleReviews.ts) : chargé au montage de l'écran,
  // sans rapport avec ce que ce test vérifie — réponse neutre, pas d'appel réel.
  await page.route('**/api/washer/avis-preview', route => route.fulfill({ json: { aSource: false, aggregate: null } }))
  await page.goto('/dev/booking-preview?mode=settings-web')
  await expect(page.locator('#identite')).toHaveCount(1)
  // Logo et Couleur restent visibles quel que soit le mode depuis le
  // 2026-10-04 (demande d'Alexandre) : seul Fond, lui, reste caché en mode
  // par défaut — c'est donc lui qui marque la bascule ici désormais.
  await expect(page.getByRole('heading', { name: 'Fond de la page client', exact: true })).not.toBeVisible()
  await page.getByRole('switch', { name: 'Page par défaut' }).click()
  await expect(page.getByRole('heading', { name: 'Fond de la page client', exact: true })).toBeVisible()
  await expect(page.locator('textarea')).toHaveValue('Bienvenue chez Brillance Mobile')
  await page.getByRole('switch', { name: 'Page par défaut' }).click()
  await expect(page.getByRole('heading', { name: 'Fond de la page client', exact: true })).not.toBeVisible()
  await page.getByRole('switch', { name: 'Page par défaut' }).click()
  await expect(page.locator('textarea')).toHaveValue('Bienvenue chez Brillance Mobile')
})
