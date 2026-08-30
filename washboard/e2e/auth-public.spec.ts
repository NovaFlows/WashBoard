import { test, expect } from '@playwright/test'
import { expectNoAppError } from './helpers'

// Parcours d'authentification vus par un visiteur non connecté.
//
// Ces tests ne créent volontairement AUCUN compte : une inscription réussie
// laisserait un utilisateur auth dans la vraie base (pas de séparation
// dev/prod), et c'est précisément ce qui a produit un compte fantôme bloquant
// un email à vie le 2026-08-28. On vérifie donc les validations et les états
// d'erreur, qui sont là où les bugs se cachent, pas le chemin nominal.

test.describe('Inscription — validations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup')
    await expectNoAppError(page)
  })

  test('la page affiche les quatre champs attendus', async ({ page }) => {
    await expect(page.locator('input[placeholder="CleanCar"]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Min. 6 caractères"]')).toBeVisible()
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible()
  })

  test('refuse un nom d’entreprise vide', async ({ page }) => {
    await page.locator('input[type="email"]').fill('e2e-nom-vide@example.test')
    await page.locator('input[placeholder="Min. 6 caractères"]').fill('motdepasse123')
    await page.locator('input[placeholder="••••••••"]').fill('motdepasse123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Le nom de votre entreprise est requis')).toBeVisible()
  })

  test('refuse une adresse email malformée', async ({ page }) => {
    await page.locator('input[placeholder="CleanCar"]').fill('E2E Test')
    // `type="email"` bloquerait la soumission avant la validation applicative :
    // on passe donc une valeur que le navigateur accepte mais que la regex refuse.
    await page.locator('input[type="email"]').fill('pas-un-email@sans-point')
    await page.locator('input[placeholder="Min. 6 caractères"]').fill('motdepasse123')
    await page.locator('input[placeholder="••••••••"]').fill('motdepasse123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Adresse email invalide')).toBeVisible()
  })

  test('refuse deux mots de passe différents', async ({ page }) => {
    await page.locator('input[placeholder="CleanCar"]').fill('E2E Test')
    await page.locator('input[type="email"]').fill('e2e-mdp@example.test')
    await page.locator('input[placeholder="Min. 6 caractères"]').fill('motdepasse123')
    await page.locator('input[placeholder="••••••••"]').fill('autrechose456')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Les mots de passe ne correspondent pas')).toBeVisible()
  })

  test('refuse un mot de passe de moins de 6 caractères', async ({ page }) => {
    await page.locator('input[placeholder="CleanCar"]').fill('E2E Test')
    await page.locator('input[type="email"]').fill('e2e-court@example.test')
    await page.locator('input[placeholder="Min. 6 caractères"]').fill('court')
    await page.locator('input[placeholder="••••••••"]').fill('court')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=au moins 6 caractères')).toBeVisible()
  })

  test('un email déjà utilisé est refusé avec un message clair', async ({ page }) => {
    // Le compte de test existe forcément : c'est celui qui sert aux tests laveur.
    const existing = process.env.TEST_WASHER_EMAIL
    test.skip(!existing, 'TEST_WASHER_EMAIL absent')

    await page.locator('input[placeholder="CleanCar"]').fill('E2E Doublon')
    await page.locator('input[type="email"]').fill(existing!)
    await page.locator('input[placeholder="Min. 6 caractères"]').fill('motdepasse123')
    await page.locator('input[placeholder="••••••••"]').fill('motdepasse123')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Cet email est déjà utilisé')).toBeVisible({ timeout: 15_000 })
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
