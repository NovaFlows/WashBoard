import { test, expect, type Page } from '@playwright/test'

// Plage horaire bloquée par le laveur (« Autre activité », dimanche 4 octobre de 9h à 12h) :
// le client ne voit plus ces heures, le reste de la journée et les autres jours restent ouverts.
// Données fictives, aucun appel à une base.
async function fixture(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+02:00'))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname === '/api/zone/check') body = { allowed: true }
    if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] }
    if (url.pathname === '/api/travel-fee') body = { fee: 0 }
    if (url.pathname === '/api/slots/smart') body = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }
    await route.fulfill({ json: body })
  })
  await page.goto('/dev/booking-preview?scenario=plage-bloquee')
  await expect(page.getByRole('heading', { name: 'Que faut-il laver ?' })).toBeVisible()
  const citadine = page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true })
  if (await citadine.count()) await citadine.click()
  await page.getByRole('radio', { name: /^Extérieur/ }).check()
  await page.getByTestId('booking-continue').click()
  await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
}

const creneau = (page: Page, heure: number) => page.getByRole('button', { name: new RegExp(`^${String(heure).padStart(2, '0')} h`) })

test('la plage bloquée disparaît, l après-midi reste réservable', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await fixture(page)

  await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
  await expect(creneau(page, 12).first()).toBeVisible()
  for (const h of [9, 10, 11]) await expect(creneau(page, h)).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('plage-bloquee.png'), scale: 'css' })

  await creneau(page, 12).first().click()
  await expect(page.getByTestId('booking-continue')).toBeEnabled()
  expect(errors).toEqual([])
})

test('les autres jours ne changent pas', async ({ page }) => {
  await fixture(page)
  await page.getByRole('button', { name: /lundi 5 octobre/i }).click()
  await expect(creneau(page, 9).first()).toBeVisible()
})
