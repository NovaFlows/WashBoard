import type { Page, Response } from '@playwright/test'

// ⚠️ Ce projet n'a PAS de séparation base dev / base prod (voir TODO.md) : les
// tests E2E écrivent donc dans la vraie base. Deux garde-fous en conséquence :
//
//  1. Tout ce que les tests créent est préfixé `[E2E]` — repérable d'un coup
//     d'œil en base, et supprimable sans hésiter si un nettoyage échoue.
//  2. Les tests ne touchent QUE le compte de test (`TEST_WASHER_SLUG`, Kooki
//     Clean). Le vrai client (Kookii Clean, deux « i ») ne doit jamais être
//     écrit — d'où l'absence totale d'identifiant en dur ici.
export const E2E_PREFIX = '[E2E]'

/** Étiquette unique pour un objet créé par un test — évite les collisions
 *  entre exécutions concurrentes et rend l'origine évidente en base. */
export function e2eLabel(what: string): string {
  return `${E2E_PREFIX} ${what} ${Date.now().toString().slice(-6)}`
}

export const TEST_WASHER_SLUG = process.env.TEST_WASHER_SLUG ?? ''
export const TEST_CLIENT_EMAIL = process.env.TEST_CLIENT_EMAIL ?? 'e2e-client@example.test'
export const hasWasherCredentials = !!process.env.TEST_WASHER_EMAIL

/** Supprime les réservations créées par les tests pour cet email client. */
export async function cleanupBookings(page: Page, clientEmail = TEST_CLIENT_EMAIL): Promise<void> {
  await page.request.post('/api/e2e/cleanup', { data: { client_email: clientEmail } }).catch(() => {})
}

/** Supprime tous les objets `[E2E]` (prestations, catégories, dépenses).
 *
 *  Échoue bruyamment si le nettoyage ne marche pas : une première version
 *  avalait l'erreur et laissait des prestations de test en base à chaque
 *  exécution, sans que rien ne le signale. */
export async function cleanupE2eObjects(page: Page): Promise<void> {
  const res = await page.request.post('/api/e2e/cleanup', { data: { prefix: E2E_PREFIX } })
  if (!res.ok()) {
    throw new Error(`Nettoyage E2E échoué (${res.status()}) : ${await res.text()}`)
  }
}

/** Vérifie qu'une page s'est rendue sans planter côté serveur ni côté client.
 *  Next.js affiche « Application error » quand un composant client lève, et une
 *  page 500 rendue proprement passerait sinon inaperçue dans un test qui ne
 *  regarde qu'un titre. */
export async function expectNoAppError(page: Page): Promise<void> {
  const { expect } = await import('@playwright/test')
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
}

/** Le parcours public de réservation, comme un vrai client, jusqu'au clic sur « Confirmer la
 *  réservation ». Rend la réponse du `POST /api/bookings` : un refus du serveur (créneau pris,
 *  hors zone, quota…) se lit alors en clair dans l'échec, au lieu d'un simple « confirmation
 *  introuvable » comme dans la CI du 2026-10-17.
 *
 *  Partagé par `client-booking` et `dashboard-annulation`, qui le recopiaient chacun. */
export async function reserverCommeClient(page: Page, client: { nom: string; email: string; telephone?: string }): Promise<Response> {
  const { expect } = await import('@playwright/test')
  await page.goto(`/book/${TEST_WASHER_SLUG}`)
  await expectNoAppError(page)

  // Véhicule, puis prestation : aucun véhicule n'est présélectionné depuis le 2026-10-18.
  await page.locator('[aria-label="Type de véhicule"] button').first().click()
  const service = page.getByRole('radio').first()
  await expect(service).toBeVisible({ timeout: 15_000 })
  await service.check()
  await page.getByTestId('booking-continue').click()

  // Adresse, puis jour et horaire.
  await expect(page.getByRole('heading', { name: 'Où et quand ?' })).toBeVisible({ timeout: 15_000 })
  // La recherche d'adresse répond après la frappe : avec une clé Google (en local), des
  // suggestions s'ouvrent alors et masquent les jours ; on choisit la première, comme un
  // client. Sans clé (la CI), la réponse est vide et on continue. Attendre la RÉPONSE, et
  // pas un délai fixe : une suggestion arrivée après le délai bloquait le clic suivant.
  const recherche = page.waitForResponse(r => r.url().includes('/api/places/autocomplete'), { timeout: 30_000 }).catch(() => null)
  await page.getByLabel('Adresse du lavage').fill('15 Rue du Général de Gaulle, Paris')
  await recherche
  const suggestion = page.getByRole('listitem').getByRole('button', { name: /Général de Gaulle/ }).first()
  const choisie = await suggestion.waitFor({ state: 'visible', timeout: 2_000 }).then(() => suggestion.dispatchEvent('mousedown')).then(() => true, () => false)
  // Rien à choisir : un clic sur le titre referme une liste qui serait arrivée quand même.
  if (!choisie) await page.getByRole('heading', { name: 'Où et quand ?' }).click()
  await page.locator('[aria-label="Jours disponibles"] button').first().click()
  const creneau = page.locator('#wb-section-2 .grid.grid-cols-3 button').first()
  await expect(creneau).toBeVisible({ timeout: 15_000 })
  await creneau.click()
  await expect(page.getByTestId('booking-continue')).toBeEnabled({ timeout: 15_000 })
  await page.getByTestId('booking-continue').click()

  // Coordonnées et identification du véhicule.
  await expect(page.getByRole('heading', { name: 'Vos coordonnées' })).toBeVisible({ timeout: 15_000 })
  await page.getByLabel('Nom et prénom').fill(client.nom)
  await page.getByLabel(/Email pour/).fill(client.email)
  await page.getByLabel('Téléphone', { exact: true }).fill(client.telephone ?? '0600000000')
  const modele = page.getByLabel('Modèle du véhicule')
  if (await modele.isVisible()) await modele.fill('Peugeot 208 E2E')
  // Laveur qui demande un acompte : la case des conditions est obligatoire (2026-10-19).
  const conditionsAcompte = page.getByLabel(/j’accepte les conditions de l’acompte/)
  if (await conditionsAcompte.isVisible()) await conditionsAcompte.check()

  const confirmer = page.getByRole('button', { name: 'Confirmer la réservation' })
  await expect(confirmer).toBeEnabled({ timeout: 5_000 })
  const [creation] = await Promise.all([
    page.waitForResponse(r => r.url().endsWith('/api/bookings') && r.request().method() === 'POST', { timeout: 30_000 }),
    confirmer.click(),
  ])
  return creation
}
