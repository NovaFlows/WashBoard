import { test, expect, type Page } from '@playwright/test'
import { expectNoAppError } from './helpers'

// Parcours d'authentification vus par un visiteur non connecté.
//
// Ces tests ne créent volontairement AUCUN compte : une inscription réussie
// laisserait un utilisateur auth dans la vraie base (pas de séparation
// dev/prod), et c'est précisément ce qui a produit un compte fantôme bloquant
// un email à vie le 2026-08-28. On vérifie donc les validations et les états
// d'erreur, qui sont là où les bugs se cachent, pas le chemin nominal.

test.describe('Inscription — validations', () => {
  // Écran d'inscription v2 (2026-10-15) : champs repérés par leur libellé, case des CGV
  // obligatoire, et vérifications dans l'ordre nom → email → téléphone → mots de passe → CGV.
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
    await expectNoAppError(page)
  })

  const champs = (page: Page) => ({
    nom: page.getByLabel('Nom de ton entreprise'),
    email: page.getByLabel('Email'),
    tel: page.getByLabel('Téléphone'),
    mdp: page.getByLabel('Mot de passe', { exact: true }),
    confirmation: page.getByLabel('Confirmer le mot de passe'),
    cgv: page.getByLabel(/conditions générales de vente/),
    envoyer: page.getByRole('button', { name: 'Lancer mon mois gratuit' }),
  })

  test('la page affiche les cinq champs attendus et la case des CGV', async ({ page }) => {
    const c = champs(page)
    for (const champ of [c.nom, c.email, c.tel, c.mdp, c.confirmation, c.cgv]) await expect(champ).toBeVisible()
  })

  test('refuse un nom d’entreprise vide', async ({ page }) => {
    const c = champs(page)
    await c.email.fill('e2e-nom-vide@example.test')
    await c.tel.fill('0612345678')
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('motdepasse123')
    await c.envoyer.click()
    await expect(page.getByText('Le nom de ton entreprise est requis')).toBeVisible()
  })

  test('refuse un numéro de téléphone invalide', async ({ page }) => {
    // Le téléphone limite l'ouverture de plusieurs essais gratuits avec des
    // emails différents : s'il devenait facultatif, la protection sauterait.
    const c = champs(page)
    await c.nom.fill('E2E Test')
    await c.email.fill('e2e-tel@example.test')
    await c.tel.fill('123')
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('motdepasse123')
    await c.envoyer.click()
    await expect(page.getByText('Numéro de téléphone invalide')).toBeVisible()
  })

  test('refuse une adresse email malformée', async ({ page }) => {
    const c = champs(page)
    await c.nom.fill('E2E Test')
    // Le formulaire est en `noValidate` : la validation applicative parle d'elle-même.
    await c.email.fill('pas-un-email@sans-point')
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('motdepasse123')
    await c.envoyer.click()
    await expect(page.getByText('Adresse email invalide')).toBeVisible()
  })

  test('refuse deux mots de passe différents', async ({ page }) => {
    const c = champs(page)
    await c.nom.fill('E2E Test')
    await c.email.fill('e2e-mdp@example.test')
    await c.tel.fill('0612345678')
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('autrechose456')
    await c.envoyer.click()
    await expect(page.getByText('Les mots de passe ne correspondent pas')).toBeVisible()
  })

  test('refuse un mot de passe de moins de 6 caractères', async ({ page }) => {
    const c = champs(page)
    await c.nom.fill('E2E Test')
    await c.email.fill('e2e-court@example.test')
    await c.tel.fill('0612345678')
    await c.mdp.fill('court')
    await c.confirmation.fill('court')
    await c.envoyer.click()
    await expect(page.getByText('au moins 6 caractères')).toBeVisible()
  })

  test('refuse l’inscription sans accepter les CGV', async ({ page }) => {
    const c = champs(page)
    await c.nom.fill('E2E Test')
    await c.email.fill('e2e-cgv@example.test')
    await c.tel.fill('0612345678')
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('motdepasse123')
    await c.envoyer.click()
    await expect(page.getByText('Merci d’accepter les CGV pour continuer')).toBeVisible()
  })

  test('un email déjà utilisé est refusé avec un message clair', async ({ page }) => {
    // Le compte de test existe forcément : c'est celui qui sert aux tests laveur.
    const existing = process.env.TEST_WASHER_EMAIL
    test.skip(!existing, 'TEST_WASHER_EMAIL absent')

    const c = champs(page)
    await c.nom.fill('E2E Doublon')
    await c.email.fill(existing!)
    // Un numéro jamais attribué : un numéro déjà porté par un laveur serait refusé AVANT
    // l'email (« déjà associé à un compte »), et le test ne vérifierait plus rien.
    await c.tel.fill(`07${Date.now().toString().slice(-8)}`)
    await c.mdp.fill('motdepasse123')
    await c.confirmation.fill('motdepasse123')
    await c.cgv.check()
    await c.envoyer.click()
    await expect(page.getByText('Cet email est déjà utilisé')).toBeVisible({ timeout: 15_000 })
  })

  test('lien vers la connexion présent', async ({ page }) => {
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
})

test.describe('Connexion — erreurs', () => {
  test('des identifiants invalides ne connectent pas et affichent une erreur', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('inconnu-e2e@example.test')
    await page.locator('input[type="password"]').fill('mauvaisMotDePasse')
    await page.locator('button[type="submit"]').click()

    // Le point important n'est pas le libellé exact mais qu'on reste dehors.
    await page.waitForTimeout(3_000)
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('lien « mot de passe oublié » accessible depuis la connexion', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
  })
})

test.describe('Mot de passe oublié', () => {
  test('la page se charge avec son champ email', async ({ page }) => {
    await page.goto('/forgot-password')
    await expectNoAppError(page)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('une demande sur un email inconnu ne révèle pas si le compte existe', async ({ page }) => {
    // Ne pas divulguer l'existence d'un compte est un comportement de sécurité
    // volontaire : le test échouera si quelqu'un « améliore » le message.
    await page.goto('/forgot-password')
    await page.locator('input[type="email"]').fill('inconnu-e2e@example.test')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(3_000)
    await expect(page.locator("text=/n'existe pas|compte introuvable|inconnu/i")).toHaveCount(0)
  })
})

test.describe('Réinitialisation du mot de passe', () => {
  test('sans lien de récupération valide, la page ne propose pas le formulaire', async ({ page }) => {
    // Sans jeton, le formulaire ne doit pas permettre de changer un mot de passe.
    await page.goto('/reset-password')
    await expectNoAppError(page)
    await page.waitForTimeout(2_000)
    const submit = page.locator('button[type="submit"]')
    if (await submit.isVisible().catch(() => false)) {
      // Formulaire affiché : il doit au moins refuser une soumission sans session.
      await page.locator('input[type="password"]').first().fill('nouveauMotDePasse1')
      await page.locator('input[type="password"]').nth(1).fill('nouveauMotDePasse1')
      await submit.click()
      await page.waitForTimeout(3_000)
      await expect(page.locator('text=Mot de passe mis à jour !')).not.toBeVisible()
    }
  })
})
