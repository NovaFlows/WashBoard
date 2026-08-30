import type { Page } from '@playwright/test'

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

/** Vérifie qu'une page s'est rendue sans planter côté serveur ni côté client.
 *  Next.js affiche « Application error » quand un composant client lève, et une
 *  page 500 rendue proprement passerait sinon inaperçue dans un test qui ne
 *  regarde qu'un titre. */
export async function expectNoAppError(page: Page): Promise<void> {
  const { expect } = await import('@playwright/test')
  await expect(page.locator('text=Application error')).not.toBeVisible()
  await expect(page.locator('text=Internal Server Error')).not.toBeVisible()
}
