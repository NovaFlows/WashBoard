import { test, expect, type Page } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials } from './helpers'
import { TRAFFIC_SOURCES } from '../src/lib/trafficSources'

// Réglages : lien de réservation, frais de déplacement, relances, avis, équipe,
// sécurité du compte.
//
// Écrits pour la v2 (2026-10-18) : sur ordinateur, tous les laveurs l'ont depuis le
// 2026-10-12. Les anciens onglets « Général / Page client » de /dashboard/parametres
// sont devenus le menu « Plus » et ses écrans (Mon profil, Mes liens, Réglages…), et
// chaque réglage s'ouvre dans une feuille.
//
// ⚠️ Aucun test ne déclenche la mise en pause ni la suppression du compte, et aucune
// feuille n'est enregistrée : la base est partagée avec la production, et le compte de
// test est celui qui fait tourner tous les autres tests. On vérifie la présence et les
// garde-fous de ces actions, jamais leur exécution.

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

async function ouvrir(page: Page, chemin: string, titre: string) {
  await page.goto(chemin)
  await expectNoAppError(page)
  await expect(page.getByRole('heading', { name: titre, level: 1 })).toBeVisible({ timeout: 15_000 })
}

/** Ouvre la feuille d'un réglage et la rend, pour qu'un test la referme sans enregistrer. */
async function feuille(page: Page, ligne: RegExp, titre: string) {
  await page.getByRole('button', { name: ligne }).first().click()
  const dialogue = page.getByRole('dialog', { name: titre })
  await expect(dialogue).toBeVisible({ timeout: 10_000 })
  return dialogue
}

test.describe('Plus — accès aux réglages', () => {
  test('le menu Plus mène à chaque écran de réglages', async ({ page }) => {
    await page.goto('/dashboard/parametres')
    await expectNoAppError(page)
    for (const ecran of ['Mon profil', 'Mes liens', 'Prestations et prix', 'Horaires', 'Apparence de ma page', 'Abonnement', 'Réglages']) {
      await expect(page.getByRole('main').getByRole('link', { name: new RegExp(`^${ecran}`) }).first()).toBeVisible({ timeout: 15_000 })
    }
  })
})

test.describe('Mes liens — lien de réservation', () => {
  test('le lien personnalisé est affiché et copiable', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/liens', 'Mes liens')
    const lien = page.getByRole('region', { name: 'Lien de réservation' })
    await expect(lien.getByText(/\/book\//)).toBeVisible()
    await expect(lien.getByRole('button', { name: 'Copier le lien' })).toBeVisible()
  })

  test('un lien dédié est proposé pour chaque réseau', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/liens', 'Mes liens')
    for (const source of TRAFFIC_SOURCES) {
      const etiquette = source.label.split(' (')[0]
      await expect(page.getByRole('button', { name: `Copier le lien ${etiquette}` })).toBeVisible()
    }
  })

  test('un slug invalide est refusé', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/liens', 'Mes liens')
    const dialogue = await feuille(page, /^Changer mon lien$/, 'Changer mon lien')
    const champ = dialogue.getByLabel('Fin de votre lien de réservation')
    const avant = await champ.inputValue()
    // Un slug cassé rendrait la page de réservation inaccessible : la feuille doit le
    // refuser, et rien ne doit partir tant qu'il est invalide.
    await champ.fill('MAJUSCULES ET ESPACES!!')
    await dialogue.getByRole('button', { name: 'Continuer' }).click()
    await expect(dialogue).toBeVisible()
    await expect(champ).toHaveAttribute('aria-invalid', 'true')
    await expect(dialogue.getByRole('alert')).toBeVisible()
    await dialogue.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialogue).toBeHidden()
    // Le lien affiché n'a pas bougé.
    await expect(page.getByRole('region', { name: 'Lien de réservation' }).getByText(`/book/${avant}`)).toBeVisible()
  })
})

test.describe('Mon profil — sections métier', () => {
  for (const [ligne, titre] of [
    [/^Frais de déplacement/, 'Frais de déplacement'],
    [/^Adresse de départ/, 'Adresse de départ'],
    [/^Nombre de laveurs/, 'Nombre de laveurs'],
  ] as const) {
    test(`le réglage « ${titre} » s’ouvre`, async ({ page }) => {
      await ouvrir(page, '/dashboard/parametres/profil', 'Mon profil')
      const dialogue = await feuille(page, ligne, titre)
      await dialogue.getByRole('button', { name: 'Annuler' }).click()
      await expect(dialogue).toBeHidden()
    })
  }

  test('les frais de déplacement exposent leurs paliers et le point de départ du trajet', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/profil', 'Mon profil')
    const dialogue = await feuille(page, /^Frais de déplacement/, 'Frais de déplacement')
    await expect(dialogue.getByRole('heading', { name: 'Paliers' })).toBeVisible()
    await expect(dialogue.getByRole('group', { name: 'Point de départ du trajet' })).toBeVisible()
    await dialogue.getByRole('button', { name: 'Annuler' }).click()
  })
})

test.describe('Messages automatiques — avis et relances', () => {
  test('la demande d’avis et la relance sont proposées', async ({ page }) => {
    await ouvrir(page, '/dashboard/clients/messages', 'Messages automatiques')
    await expect(page.getByRole('switch', { name: 'Demande d’avis Google' })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Relance' })).toBeVisible()
  })

  test('les relances exposent leur délai et leur message', async ({ page }) => {
    await ouvrir(page, '/dashboard/clients/messages', 'Messages automatiques')
    await page.getByRole('button', { name: 'Réglages : Relance' }).click()
    const dialogue = page.getByRole('dialog', { name: 'Relance' })
    await expect(dialogue.getByRole('group', { name: 'Délai avant la relance' })).toBeVisible({ timeout: 10_000 })
    await expect(dialogue.getByLabel('Message de relance')).toBeVisible()
    await dialogue.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialogue).toBeHidden()
  })
})

test.describe('Mon profil — sécurité du compte', () => {
  test('le changement de mot de passe est proposé', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/profil', 'Mon profil')
    const dialogue = await feuille(page, /^Mot de passe/, 'Mot de passe')
    await expect(dialogue.getByLabel('Nouveau mot de passe', { exact: true })).toBeVisible()
    await dialogue.getByRole('button', { name: 'Annuler' }).click()
  })

  test('supprimer le compte exige une confirmation par le nom', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/profil', 'Mon profil')
    await expect(page.getByRole('button', { name: /^Mettre mon compte en pause/ })).toBeVisible()

    // Ouvrir la confirmation ne doit RIEN supprimer : c'est tout l'intérêt du garde-fou.
    // Le test vérifie qu'on y demande le nom de l'entreprise, qu'un mauvais nom laisse le
    // bouton inactif, puis referme — il ne saisit JAMAIS le bon nom.
    const dialogue = await feuille(page, /^Supprimer mon compte/, 'Supprimer mon compte')
    const confirmer = dialogue.getByRole('button', { name: 'Supprimer mon compte' })
    await expect(confirmer).toBeDisabled()
    await dialogue.getByLabel('Nom de votre entreprise').fill('[E2E] pas le bon nom')
    await expect(confirmer).toBeDisabled()
    await dialogue.getByRole('button', { name: 'Annuler' }).click()
    await expect(dialogue).toBeHidden()

    // On quitte la page sans confirmer, pour ne rien laisser en suspens.
    await page.goto('/dashboard')
    await expect(page.getByText('Compte désactivé')).toHaveCount(0)
  })
})

test.describe('Réglages — notifications', () => {
  test('la section notifications est présente', async ({ page }) => {
    await ouvrir(page, '/dashboard/parametres/reglages', 'Réglages')
    const dialogue = await feuille(page, /^Notifications/, 'Notifications')
    await expect(dialogue.getByText(/dès qu’un client réserve/)).toBeVisible()
    await page.keyboard.press('Escape')
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
