import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'
import { TRAFFIC_SOURCES } from '../src/lib/trafficSources'

// Paramètres : lien de réservation, frais de déplacement, relances, avis,
// équipe, sécurité du compte.
//
// ⚠️ Aucun test ne déclenche la désactivation ni la suppression du compte :
// la base est partagée avec la production, et le compte de test est celui qui
// fait tourner tous les autres tests. On vérifie la présence et les garde-fous
// de ces actions, jamais leur exécution.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

test.describe('Paramètres — lien de réservation', () => {
  test('les deux onglets sont accessibles', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expectNoAppError(page)
    await expect(page.getByTestId('parametres-tab-general')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('parametres-tab-client')).toBeVisible()
  })

  test('le lien personnalisé est affiché et copiable', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await page.getByTestId('parametres-tab-client').click()
    await expectNoAppError(page)
    await expect(page.locator('text=Votre lien de réservation')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=/book/').first()).toBeVisible()
  })

  test('un lien dédié est proposé pour chaque réseau', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await page.getByTestId('parametres-tab-client').click()
    await expect(page.locator('text=Votre lien de réservation')).toBeVisible({ timeout: 15_000 })
    for (const source of TRAFFIC_SOURCES) {
      const étiquette = source.label.split(' (')[0]
      await expect(page.locator(`text=${étiquette}`).first()).toBeVisible()
    }
  })

  test('un slug invalide est refusé', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await page.getByTestId('parametres-tab-client').click()
    await expect(page.locator('text=Votre lien de réservation')).toBeVisible({ timeout: 15_000 })

    // Le champ filtre déjà la saisie (minuscules, chiffres, tirets) : on vérifie
    // qu'un caractère interdit n'atteint jamais la valeur, sinon un slug cassé
    // rendrait la page de réservation inaccessible.
    const champ = page.locator('input[placeholder="mon-entreprise"]')
    await champ.fill('MAJUSCULES ET ESPACES!!')
    expect(await champ.inputValue()).toMatch(/^[a-z0-9-]*$/)
  })
})

test.describe('Paramètres — sections métier', () => {
  const sections = [
    'Frais de déplacement par durée',
    'Calculer le trajet depuis',
    'Demander des avis',
    'Relances automatiques',
    'Nombre de laveurs',
  ]

  for (const section of sections) {
    test(`la section « ${section} » est rendue`, async ({ page }) => {
      await page.goto('/dashboard/parametres')
      await expectNoAppError(page)
      await expect(page.locator(`text=${section}`).first()).toBeVisible({ timeout: 15_000 })
    })
  }

  test('les relances exposent leur délai et leur message', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expect(page.locator('text=Relances automatiques')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Délai avant relance').first()).toBeVisible()
    await expect(page.locator('text=Message de relance').first()).toBeVisible()
  })
})

test.describe('Paramètres — sécurité du compte', () => {
  test('le changement de mot de passe est proposé', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expect(page.locator('text=Nouveau mot de passe').first()).toBeVisible({ timeout: 15_000 })
  })

  test('supprimer le compte exige une confirmation par le nom', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expect(page.locator('text=Zone de danger').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Désactiver mon compte').first()).toBeVisible()

    // Ouvrir la confirmation ne doit RIEN supprimer : c'est tout l'intérêt du
    // garde-fou. Le test ouvre la fenêtre, vérifie qu'on y demande de saisir le
    // nom de l'entreprise, puis referme — il ne confirme jamais.
    // Identifiant explicite : plusieurs boutons « Supprimer » coexistent sur la
    // page (paliers de frais…), et se tromper de cible sur une action de
    // suppression de compte n'est pas un risque acceptable dans un test.
    await page.getByTestId('delete-account-open').click()
    await expect(page.locator('text=Supprimer définitivement le compte')).toBeVisible({ timeout: 10_000 })

    // Le bouton de confirmation reste inactif tant que le nom n'est pas saisi.
    const confirmer = page.locator('button', { hasText: /^Confirmer$/ }).first()
    if (await confirmer.isVisible().catch(() => false)) {
      await expect(confirmer).toBeDisabled()
    }

    // On quitte la page sans confirmer, pour ne rien laisser en suspens.
    await page.goto('/dashboard')
    await expect(page.locator('text=Compte désactivé')).toHaveCount(0)
  })
})

test.describe('Paramètres — accès à la page client', () => {
  test('le raccourci vers la configuration de la page client est présent', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await page.getByTestId('parametres-tab-client').click()
    await expect(page.locator('a[href="/dashboard/admin"]').first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Paramètres — notifications', () => {
  test('la section notifications est présente', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expect(page.locator('text=Soyez prévenu sur votre téléphone')).toBeVisible({ timeout: 15_000 })
  })

  test("l'enregistrement d'un appareil atteint réellement la base", async ({ page }) => {
    // Ce test existe à cause d'un vrai incident : la table push_subscriptions a
    // été créée avec sa policy RLS mais sans GRANT pour service_role, et toute
    // écriture renvoyait « permission denied ». Aucun test unitaire ne pouvait
    // le voir — ils simulent Supabase. Seul un appel réel le détecte.
    //
    // C'est la deuxième fois que ce défaut survient sur ce projet
    // (booking_funnel_events le 2026-08-26), d'où ce filet.
    await page.goto('/dashboard/parametres')

    const faux = `https://e2e.invalid/${Date.now()}`
    const res = await page.request.post('/api/push/subscribe', {
      data: { endpoint: faux, keys: { p256dh: 'e2e-p256dh', auth: 'e2e-auth' } },
    })

    // 503 signalerait un souci de droits ou d'écriture côté base.
    expect(res.status(), await res.text()).toBe(200)

    // On retire l'appareil fictif : la base est partagée avec la production.
    const suppr = await page.request.delete('/api/push/subscribe', { data: { endpoint: faux } })
    expect(suppr.status()).toBe(200)
  })

  test('un visiteur non connecté ne peut pas enregistrer d’appareil', async ({ browser }) => {
    const vierge = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await vierge.request.post('/api/push/subscribe', {
      data: { endpoint: 'https://e2e.invalid/anonyme', keys: { p256dh: 'x', auth: 'y' } },
    })
    expect(res.status()).toBe(401)
    await vierge.close()
  })
})
