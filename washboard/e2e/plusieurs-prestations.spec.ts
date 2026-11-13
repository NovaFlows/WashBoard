import { test, expect, type Page } from '@playwright/test'

// Lot du 2026-11-13 : plusieurs prestations dans une réservation (réglage du laveur) et silhouette
// du véhicule en couleur ou grisée. Données fictives (/dev/booking-preview), aucune base, aucune
// réservation réelle.
//   ?multi=1  : le laveur laisse cumuler plusieurs prestations ; ?teinte=1 : silhouette en couleur.
//   ?prest=1&centre=3 : Extérieur = déplacement seulement, Intérieur = centre seulement,
//                       Complet = centre Sud seulement.
// Prix du banc d'essai : Extérieur 35 € (60 min), Intérieur 45 € (75 min), Complet 75 € (120 min) ;
// un SUV coûte 10 € de plus par prestation.

const EXTERIEUR = '00000000-0000-4000-8000-000000000011'
const INTERIEUR = '00000000-0000-4000-8000-000000000012'

async function mock(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+02:00'))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname === '/api/zone/check') body = { allowed: true }
    if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] }
    if (url.pathname === '/api/travel-fee') body = { fee: 0 }
    if (url.pathname === '/api/slots/smart') body = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }
    if (url.pathname === '/api/bookings') body = { data: { id: '00000000-0000-4000-8000-000000000099', booked_price: 80 } }
    await route.fulfill({ json: body })
  })
}

async function ouvrir(page: Page, chemin: string) {
  await mock(page)
  await page.goto(chemin)
  await expect(page.getByRole('heading', { name: 'Que faut-il laver ?' })).toBeVisible()
}

test.describe('plusieurs prestations — page par défaut', () => {
  test('sans le réglage, une seule prestation : des boutons radio', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await expect(page.getByRole('radio', { name: /^Extérieur/ })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /^Extérieur/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'La prestation' })).toBeVisible()
  })

  test('avec le réglage, on coche plusieurs prestations : prix, durée et réservation les comptent', async ({ page }, testInfo) => {
    const erreurs: string[] = []
    page.on('pageerror', e => erreurs.push(e.message))
    await ouvrir(page, '/dev/booking-preview?multi=1')
    await expect(page.getByRole('heading', { name: 'Les prestations' })).toBeVisible()
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).check()
    await expect(page.locator('.wb-booking-footer')).toContainText('35')
    await page.getByRole('checkbox', { name: /^Intérieur/ }).check()
    // 35 + 45 : les deux prestations s'additionnent.
    await expect(page.locator('.wb-booking-footer')).toContainText('80')
    await expect(page.getByRole('checkbox', { name: /^Extérieur/ })).toBeChecked()
    await page.screenshot({ path: testInfo.outputPath('multi-01-cases.png'), scale: 'css' })
    // Le détail du prix nomme les deux.
    await page.getByRole('button', { name: 'Détail du prix' }).click()
    await expect(page.locator('dialog')).toContainText('Extérieur · Citadine')
    await expect(page.locator('dialog')).toContainText('Intérieur')
    await page.getByRole('button', { name: 'Fermer le détail du prix' }).click()

    await page.getByTestId('booking-continue').click()
    await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await page.getByRole('button', { name: /^10 h$/ }).click()
    await page.getByTestId('booking-continue').click()
    await page.getByLabel('Nom et prénom').fill('Client Démo')
    await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
    await page.getByLabel(/Email pour/).fill('client@example.test')
    await page.getByLabel('Modèle du véhicule').fill('Peugeot 208 grise')
    const requete = page.waitForRequest(r => new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
    await page.getByTestId('booking-continue').click()
    const payload = (await requete).postDataJSON()
    expect(payload.service_id).toBe(EXTERIEUR)
    // La deuxième prestation voyage comme option du véhicule ; le serveur la retarifie.
    expect(payload.vehicles_detail[0].addons).toEqual([
      { id: `prestation:${INTERIEUR}`, label: 'Intérieur', price: 45, category: 'prestation', duration_minutes: 75 },
    ])
    expect(payload.booked_price).toBe(80)
    expect(erreurs).toEqual([])
  })

  test('décocher la première prestation fait passer la suivante en tête', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview?multi=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).check()
    await page.getByRole('checkbox', { name: /^Intérieur/ }).check()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).uncheck()
    await expect(page.locator('.wb-booking-footer')).toContainText('45')
    // Il ne reste que l'Intérieur : sa liste d'options (« En plus, si besoin ») s'affiche.
    await expect(page.getByText('En plus, si besoin')).toBeVisible()
  })

  test('changer de type de véhicule retarife toutes les prestations cochées (SUV : +10 € chacune)', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview?multi=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).check()
    await page.getByRole('checkbox', { name: /^Intérieur/ }).check()
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'SUV', exact: true }).click()
    // (35 + 10) + (45 + 10) = 100
    await expect(page.locator('.wb-booking-footer')).toContainText('100')
    await expect(page.getByRole('checkbox', { name: /^Extérieur/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /^Intérieur/ })).toBeChecked()
  })

  test('deux véhicules : chacun porte les deux prestations', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview?multi=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).check()
    await page.getByRole('checkbox', { name: /^Intérieur/ }).check()
    await page.getByRole('button', { name: 'Ajouter un véhicule (citadine)' }).click()
    await expect(page.locator('.wb-booking-footer')).toContainText('160')
  })

  test('une prestation « déplacement seulement » ne se cumule pas avec une « centre seulement »', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview?multi=1&prest=1&centre=3')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await page.getByRole('checkbox', { name: /^Extérieur/ }).check()
    await expect(page.getByRole('checkbox', { name: /^Intérieur/ })).toBeDisabled()
    await expect(page.getByText('Ne se fait pas avec les prestations déjà choisies.')).toBeVisible()
    // En décochant, elle redevient disponible.
    await page.getByRole('checkbox', { name: /^Extérieur/ }).uncheck()
    await expect(page.getByRole('checkbox', { name: /^Intérieur/ })).toBeEnabled()
  })
})

test.describe('plusieurs prestations — page personnalisée', () => {
  test('sans le réglage, une seule prestation est cochée à la fois', async ({ page }) => {
    await mock(page)
    await page.goto('/dev/booking-preview?mode=custom')
    await page.getByRole('button', { name: /^Extérieur/ }).click()
    await page.getByRole('button', { name: /^Intérieur/ }).click()
    await expect(page.locator(`[data-service-id="${EXTERIEUR}"]`)).toHaveAttribute('data-selected', 'false')
    await expect(page.locator(`[data-service-id="${INTERIEUR}"]`)).toHaveAttribute('data-selected', 'true')
  })

  test('avec le réglage, on cumule les prestations jusqu’à la réservation', async ({ page }, testInfo) => {
    await mock(page)
    await page.goto('/dev/booking-preview?mode=custom&multi=1')
    await expect(page.getByRole('heading', { name: 'Choisissez vos prestations' })).toBeVisible()
    // L'Intérieur d'abord : c'est la prestation de la réservation, et elle a des options.
    await page.getByRole('button', { name: /^Intérieur/ }).click()
    await page.getByRole('button', { name: /^Extérieur/ }).click()
    await expect(page.locator(`[data-service-id="${EXTERIEUR}"]`)).toHaveAttribute('data-selected', 'true')
    await expect(page.locator(`[data-service-id="${INTERIEUR}"]`)).toHaveAttribute('data-selected', 'true')
    await page.locator('[data-testid="vehicle-increment"][data-vehicle-type="citadine"]').click()
    // 35 + 45 pour une citadine.
    await expect(page.getByText('Total (1 élément)').locator('..')).toContainText('80')
    await page.getByPlaceholder('Modèle du véhicule').fill('Peugeot 208 grise')
    await page.screenshot({ path: testInfo.outputPath('multi-02-classique.png'), scale: 'css' })
    await page.getByTestId('service-continue').click()
    // L'Intérieur a des options : l'étape 2 s'affiche ; la prestation ajoutée reste comptée dans le total.
    await expect(page.getByRole('heading', { name: /Options/ })).toBeVisible()
    await expect(page.getByText('Total estimé').locator('..')).toContainText('80€')
    // 75 min d'Intérieur + 60 min d'Extérieur ajouté : la durée bloquée les additionne.
    await expect(page.getByText('135 min')).toBeVisible()
    await page.getByTestId('options-continue').click()
    await page.getByPlaceholder('12 rue de la Paix, 75001 Paris').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: '4 octobre', exact: true }).click()
    await page.getByRole('button', { name: '10:00', exact: true }).click()
    await page.getByRole('button', { name: 'Continuer', exact: true }).click()
    await page.getByPlaceholder('Jean Dupont').fill('Client Démo')
    await page.getByPlaceholder('jean@email.com').fill('client@example.test')
    await page.getByPlaceholder('06 00 00 00 00').fill('0612345678')
    const requete = page.waitForRequest(r => new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
    await page.getByRole('button', { name: 'Confirmer la réservation' }).click()
    const payload = (await requete).postDataJSON()
    expect(payload.service_id).toBe(INTERIEUR)
    expect(payload.vehicles_detail[0].addons.map((a: { id: string }) => a.id)).toEqual([`prestation:${EXTERIEUR}`])
    expect(payload.booked_price).toBe(80)
  })
})

test.describe('silhouette du véhicule : grisée ou en couleur', () => {
  test('grisée par défaut : l’image grise du véhicule', async ({ page }) => {
    await ouvrir(page, '/dev/booking-preview')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await expect(page.locator('.wb-sv')).toBeVisible()
    await expect(page.locator('.wb-sv-dessin').first()).toHaveAttribute('src', /\/silhouettes\/citadine\.webp/)
  })

  test('en couleur : la voiture dans ses couleurs d’origine', async ({ page }, testInfo) => {
    await ouvrir(page, '/dev/booking-preview?teinte=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await expect(page.locator('.wb-sv')).toBeVisible()
    await expect(page.locator('.wb-sv-dessin').first()).toHaveAttribute('src', /\/silhouettes\/couleur\/citadine\.webp/)
    // L'animation ne démarre qu'une fois la voiture à l'écran.
    await page.locator('.wb-sv').scrollIntoViewIfNeeded()
    await page.waitForTimeout(2600)
    await page.locator('.wb-sv').screenshot({ path: testInfo.outputPath('silhouette-couleur.png') })
  })

  test('page personnalisée : mêmes deux états', async ({ page }) => {
    await mock(page)
    await page.goto('/dev/booking-preview?mode=custom&teinte=1')
    await page.getByRole('button', { name: /^Extérieur/ }).click()
    await page.locator('[data-testid="vehicle-increment"][data-vehicle-type="citadine"]').click()
    await expect(page.locator('.wb-sv-dessin').first()).toHaveAttribute('src', /\/silhouettes\/couleur\/citadine\.webp/)
  })
})
