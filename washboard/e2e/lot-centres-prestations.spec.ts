import { test, expect, type Page } from '@playwright/test'

// Lot du 2026-11-12 : plusieurs centres auto, prestation limitée à un lieu, à certaines heures
// et à certains centres, et correctif de l'acompte sur la page personnalisée.
// Données fictives (/dev/booking-preview), aucun appel à une base, aucune réservation réelle.
//   ?centre=3  : deux centres (Nord, Sud), déplacement proposé aussi ; ?centre=2 : centre seulement.
//   ?prest=1   : Extérieur = déplacement seulement, 10 h et 14 h ; Intérieur = centre seulement ;
//                Complet = centre Sud seulement.

const NORD = '8 avenue Foch, 69006 Lyon'
const SUD = '3 rue du Port, 13002 Marseille'

async function fixture(page: Page, chemin: string) {
  await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+02:00'))
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname === '/api/zone/check') body = { allowed: true }
    if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] }
    if (url.pathname === '/api/travel-fee') body = { fee: 10 }
    if (url.pathname === '/api/slots/smart') body = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }
    if (url.pathname === '/api/bookings') body = { data: { id: '00000000-0000-4000-8000-000000000099', booked_price: 75 } }
    await route.fulfill({ json: body })
  })
  await page.goto(chemin)
  await expect(page.getByRole('heading', { name: 'Que faut-il laver ?' })).toBeVisible()
}

/** Véhicule, prestation (par son nom), puis « Choisir le créneau ». */
async function choisirPrestation(page: Page, nom: RegExp) {
  await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
  await page.getByRole('radio', { name: nom }).check()
  await page.getByTestId('booking-continue').click()
}

const creneaux = (page: Page) => page.locator('#wb-section-2').getByRole('button', { name: /^\d{1,2} h/ })

async function validerEtRecupererReservation(page: Page) {
  await page.getByTestId('booking-continue').click()
  await page.getByLabel('Nom et prénom').fill('Client Démo')
  await page.getByLabel('Téléphone', { exact: true }).fill('0612345678')
  await page.getByLabel(/Email pour/).fill('client@example.test')
  await page.getByLabel('Modèle du véhicule').fill('Peugeot 208 grise')
  const requete = page.waitForRequest(r => new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
  await page.getByTestId('booking-continue').click()
  const payload = (await requete).postDataJSON()
  await expect(page.getByRole('heading', { name: 'Réservation envoyée !' })).toBeVisible()
  return payload
}

test.describe('plusieurs centres auto', () => {
  test('le client choisit son centre et l’adresse du centre part avec la réservation', async ({ page }, testInfo) => {
    const erreurs: string[] = []
    page.on('pageerror', e => erreurs.push(e.message))
    await fixture(page, '/dev/booking-preview?centre=3')
    await choisirPrestation(page, /^Intérieur/)
    await page.getByRole('radio', { name: 'En centre auto' }).click()
    const centres = page.getByRole('radiogroup', { name: 'Centre auto' })
    await expect(page.getByText('Choisissez votre centre auto')).toBeVisible()
    await expect(centres.getByRole('radio')).toHaveCount(2)
    await expect(centres.getByRole('radio', { name: /Nord/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByLabel('Adresse du lavage')).toHaveCount(0)
    await centres.getByRole('radio', { name: /Sud/ }).click()
    await expect(centres.getByRole('radio', { name: /Sud/ })).toHaveAttribute('aria-checked', 'true')
    await page.screenshot({ path: testInfo.outputPath('centres-01-choix.png'), scale: 'css' })
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await page.getByRole('button', { name: /^10 h$/ }).click()
    const payload = await validerEtRecupererReservation(page)
    expect(payload).toMatchObject({ lieu: 'centre', address: SUD, travel_fee: 0 })
    expect(erreurs).toEqual([])
  })

  test('à domicile, aucun choix de centre', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?centre=3')
    await choisirPrestation(page, /^Intérieur/)
    await expect(page.getByRole('radio', { name: 'À domicile' })).toBeChecked()
    await expect(page.getByRole('radiogroup', { name: 'Centre auto' })).toHaveCount(0)
    await expect(page.getByLabel('Adresse du lavage')).toBeVisible()
  })

  test('feuille « Centre auto » : deux centres, ajout, retrait, identifiants conservés', async ({ page }, testInfo) => {
    await page.route('**/api/**', route => route.fulfill({ json: { suggestions: [] } }))
    await page.goto('/dev/booking-preview?mode=centre-auto&centre=3')
    await expect(page.getByText('Vos centres')).toBeVisible()
    await expect(page.getByLabel('Nom du centre 1')).toHaveValue('Nord')
    await expect(page.getByLabel('Nom du centre 2')).toHaveValue('Sud')
    await page.getByRole('button', { name: '+ Ajouter un autre centre' }).click()
    await expect(page.getByText('Centre 3', { exact: true })).toBeVisible()
    await page.getByLabel('Nom du centre 3').fill('Est')
    await page.locator('#centre-auto-adresse-2').fill('5 place Bellecour, 69002 Lyon')
    await page.screenshot({ path: testInfo.outputPath('centres-02-feuille.png'), scale: 'css' })
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    const reglage = await page.evaluate(() => (window as unknown as { __centreEnregistre: { adresse: string; centres: { id: string; nom: string; adresse: string }[] } }).__centreEnregistre)
    expect(reglage.adresse).toBe(NORD)
    expect(reglage.centres.map(c => c.nom)).toEqual(['Nord', 'Sud', 'Est'])
    // Les centres existants gardent leur identifiant (les prestations y sont rattachées) ; le nouveau en reçoit un.
    expect(reglage.centres[0].id).toBe('a1')
    expect(reglage.centres[1].id).toBe('b2')
    expect(reglage.centres[2].id).toMatch(/^[0-9a-f]{8}$/)
  })

  test('feuille « Centre auto » : retirer un centre ramène à une seule adresse', async ({ page }) => {
    await page.goto('/dev/booking-preview?mode=centre-auto&centre=3')
    await page.getByRole('button', { name: 'Retirer' }).last().click()
    await expect(page.getByText('Adresse du centre')).toBeVisible()
    await expect(page.getByText('Vos centres')).toHaveCount(0)
  })
})

test.describe('prestation limitée à un lieu', () => {
  test('déplacement seulement : pas de centre, adresse demandée', async ({ page }, testInfo) => {
    await fixture(page, '/dev/booking-preview?centre=3&prest=1')
    await choisirPrestation(page, /^Extérieur/)
    await expect(page.getByRole('radio', { name: 'En centre auto' })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'À domicile' })).toHaveCount(0)
    await expect(page.getByLabel('Adresse du lavage')).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('lieu-01-deplacement.png'), scale: 'css' })
  })

  test('centre seulement : pas de domicile, choix du centre, aucune adresse à saisir', async ({ page }, testInfo) => {
    await fixture(page, '/dev/booking-preview?centre=3&prest=1')
    await choisirPrestation(page, /^Intérieur/)
    await expect(page.getByRole('radio', { name: 'À domicile' })).toHaveCount(0)
    await expect(page.getByLabel('Adresse du lavage')).toHaveCount(0)
    await expect(page.getByText('Choisissez votre centre auto')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Centre auto' }).getByRole('radio')).toHaveCount(2)
    await page.screenshot({ path: testInfo.outputPath('lieu-02-centre.png'), scale: 'css' })
  })

  test('sans restriction : les deux lieux restent proposés (comportement par défaut)', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?centre=3')
    await choisirPrestation(page, /^Extérieur/)
    await expect(page.getByRole('radio', { name: 'À domicile' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'En centre auto' })).toBeVisible()
  })

  test('laveur « centre seulement » : une prestation « déplacement » n’est pas proposée du tout', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?centre=2&prest=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await expect(page.getByRole('radio', { name: /^Intérieur/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Complet/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Extérieur/ })).toHaveCount(0)
  })

  test('laveur sans centre : une prestation « centre » n’est pas proposée', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?prest=1')
    await page.getByLabel('Type de véhicule').getByRole('button', { name: 'Citadine', exact: true }).click()
    await expect(page.getByRole('radio', { name: /^Extérieur/ })).toBeVisible()
    await expect(page.getByRole('radio', { name: /^Intérieur/ })).toHaveCount(0)
  })
})

test.describe('heures de début d’une prestation', () => {
  test('seules les heures autorisées sont proposées, jamais 11 h', async ({ page }, testInfo) => {
    await fixture(page, '/dev/booking-preview?centre=3&prest=1')
    await choisirPrestation(page, /^Extérieur/)
    await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await expect(creneaux(page)).toHaveCount(2)
    await expect(creneaux(page).nth(0)).toHaveText(/^10 h/)
    await expect(creneaux(page).nth(1)).toHaveText(/^14 h/)
    await expect(page.getByRole('button', { name: /^11 h/ })).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('heures-01-creneaux.png'), scale: 'css' })
  })

  test('une prestation sans restriction garde toutes les heures', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?centre=3')
    await choisirPrestation(page, /^Extérieur/)
    await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await expect(page.getByRole('button', { name: '11 h', exact: true })).toBeVisible()
    expect(await creneaux(page).count()).toBeGreaterThan(2)
  })

  test('on réserve à une heure autorisée', async ({ page }) => {
    await fixture(page, '/dev/booking-preview?centre=3&prest=1')
    await choisirPrestation(page, /^Extérieur/)
    await page.getByLabel('Adresse du lavage').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await creneaux(page).nth(0).click()
    const payload = await validerEtRecupererReservation(page)
    expect(payload.scheduled_at).toContain('T08:00:00') // 10 h à Paris (été, UTC+2)
    expect(payload.lieu).toBe('domicile')
  })
})

test.describe('prestation rattachée à certains centres', () => {
  test('un seul centre rattaché : pas de choix, c’est son adresse qui part', async ({ page }, testInfo) => {
    await fixture(page, '/dev/booking-preview?centre=3&prest=1')
    await choisirPrestation(page, /^Complet/)
    await page.getByRole('radio', { name: 'En centre auto' }).click()
    await expect(page.getByRole('radiogroup', { name: 'Centre auto' })).toHaveCount(0)
    await expect(page.getByText(SUD)).toBeVisible()
    await expect(page.getByText(NORD)).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('centres-03-un-seul.png'), scale: 'css' })
    await page.getByRole('button', { name: /dimanche 4 octobre/i }).click()
    await page.getByRole('button', { name: /^10 h$/ }).click()
    const payload = await validerEtRecupererReservation(page)
    expect(payload).toMatchObject({ lieu: 'centre', address: SUD })
  })
})

test.describe('éditeur de prestation (laveur à deux centres)', () => {
  test('lieu, centres et heures, tels qu’ils seront enregistrés', async ({ page }, testInfo) => {
    await page.goto('/dev/booking-preview?mode=feuille-prestation')
    const lieu = page.getByRole('group', { name: 'Lieu de la prestation' })
    await expect(lieu.getByRole('button', { name: 'Les deux' })).toHaveAttribute('aria-pressed', 'true')
    // Par défaut : les deux lieux, tous les centres.
    const centres = page.getByRole('group', { name: 'Centres de la prestation' })
    await expect(page.getByRole('heading', { name: 'Dans quels centres ?' })).toBeVisible()
    await expect(centres.getByRole('checkbox', { name: /Nord/ })).toHaveAttribute('aria-checked', 'true')
    await expect(centres.getByRole('checkbox', { name: /Sud/ })).toHaveAttribute('aria-checked', 'true')

    // On décoche Nord : seul Sud reste ; on ne peut pas décocher le dernier centre.
    await centres.getByRole('checkbox', { name: /Nord/ }).click()
    await expect(centres.getByRole('checkbox', { name: /Nord/ })).toHaveAttribute('aria-checked', 'false')
    await centres.getByRole('checkbox', { name: /Sud/ }).click()
    await expect(centres.getByRole('checkbox', { name: /Sud/ })).toHaveAttribute('aria-checked', 'true')

    // « En déplacement » : la question des centres disparaît.
    await lieu.getByRole('button', { name: 'En déplacement' }).click()
    await expect(page.getByRole('heading', { name: 'Dans quels centres ?' })).toHaveCount(0)
    await lieu.getByRole('button', { name: 'En centre auto' }).click()
    await expect(page.getByRole('heading', { name: 'Dans quels centres ?' })).toBeVisible()

    // Heures de début : 8 h 30 puis 13 h.
    await page.getByRole('button', { name: /^Heures de début/ }).click()
    await page.getByLabel('Ajouter une heure de début').selectOption('13:00')
    await page.getByLabel('Ajouter une heure de début').selectOption('08:30')
    await expect(page.getByRole('button', { name: 'Retirer 8 h 30' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retirer 13 h' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Heures de début/ })).toContainText('8 h 30 · 13 h')
    await page.screenshot({ path: testInfo.outputPath('editeur-01.png'), scale: 'css' })

    await page.getByRole('button', { name: 'Enregistrer' }).click()
    const enregistre = await page.evaluate(() => (window as unknown as { __prestationEnregistree: Record<string, unknown> }).__prestationEnregistree)
    expect(enregistre).toMatchObject({ lieu_restreint: 'centre', centres_ids: ['b2'], heures_debut: ['08:30', '13:00'] })
  })

  test('recocher tous les centres retire la restriction ; « Toutes » retire les heures', async ({ page }) => {
    await page.goto('/dev/booking-preview?mode=feuille-prestation')
    const centres = page.getByRole('group', { name: 'Centres de la prestation' })
    await centres.getByRole('checkbox', { name: /Nord/ }).click()
    await centres.getByRole('checkbox', { name: /Nord/ }).click()
    await page.getByRole('button', { name: /^Heures de début/ }).click()
    await page.getByLabel('Ajouter une heure de début').selectOption('13:00')
    await page.getByRole('button', { name: 'Toutes', exact: true }).click()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    const enregistre = await page.evaluate(() => (window as unknown as { __prestationEnregistree: Record<string, unknown> }).__prestationEnregistree)
    expect(enregistre.centres_ids ?? null).toBeNull()
    expect(enregistre.heures_debut ?? null).toBeNull()
  })
})

test.describe('page personnalisée avec acompte (correctif)', () => {
  test('la réservation part avec la preuve d’acceptation de l’acompte', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-03T10:00:00+02:00'))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      let body: unknown = { bookings: [], unavailabilities: [] }
      if (url.pathname === '/api/zone/check') body = { allowed: true }
      if (url.pathname === '/api/places/autocomplete') body = { suggestions: [] }
      if (url.pathname === '/api/travel-fee') body = { fee: 0 }
      if (url.pathname === '/api/slots/smart') body = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }
      if (url.pathname === '/api/bookings') body = { data: { id: '00000000-0000-4000-8000-000000000099', booked_price: 45 } }
      await route.fulfill({ json: body })
    })
    await page.goto('/dev/booking-preview?mode=custom&acompte=1')
    await page.getByRole('button', { name: /^Intérieur/ }).click()
    await page.locator('[data-testid="vehicle-increment"][data-vehicle-type="citadine"]').click()
    await page.getByPlaceholder('Modèle du véhicule').fill('Peugeot 208 grise')
    await page.getByTestId('service-continue').click()
    await page.getByTestId('options-continue').click()
    await expect(page.getByRole('heading', { name: 'Choisissez un créneau' })).toBeVisible()
    await page.getByPlaceholder('12 rue de la Paix, 75001 Paris').fill('12 rue Mercière, 69002 Lyon')
    await page.getByRole('button', { name: '4 octobre', exact: true }).click()
    await page.getByRole('button', { name: '10:00', exact: true }).click()
    await page.getByRole('button', { name: 'Continuer', exact: true }).click()
    await page.getByPlaceholder('Jean Dupont').fill('Client Démo')
    await page.getByPlaceholder('jean@email.com').fill('client@example.test')
    await page.getByPlaceholder('06 00 00 00 00').fill('0612345678')
    // La case est obligatoire : sans elle, impossible de confirmer.
    const confirmer = page.getByRole('button', { name: 'Confirmer la réservation' })
    await expect(confirmer).toBeDisabled()
    await page.getByLabel(/J’ai lu et j’accepte les conditions de l’acompte/).check()
    await expect(confirmer).toBeEnabled()
    const requete = page.waitForRequest(r => new URL(r.url()).pathname === '/api/bookings' && r.method() === 'POST')
    await confirmer.click()
    // Le serveur refuse sans cette valeur (400) : c'était le bug de Pimp My Car.
    expect((await requete).postDataJSON()).toMatchObject({ acompte_accepte: true })
  })
})
