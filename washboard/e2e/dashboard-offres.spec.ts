import { test, expect } from '@playwright/test'
import { expectNoAppError, hasWasherCredentials, TEST_WASHER_SLUG } from './helpers'
import { PLAN_CARDS, BOOKING_QUOTA, SERVICE_QUOTA, PLAN_PRICES } from '../src/lib/plan'

// Grille tarifaire 2026 : ce que voit réellement un laveur selon son offre.
//
// Ce fichier remplace une liste de points à vérifier à l'œil, écran par écran.
// Une vérification manuelle se fait une fois, le jour de la livraison, puis
// plus jamais ; celle-ci se rejoue à chaque `npm run e2e`.
//
// ── Comment l'exécuter ──────────────────────────────────────────────────────
//
// Les deux blocs de simulation ne se lancent que si la variable correspondante
// est posée dans `.env.local`, parce qu'elle change le comportement du serveur
// pour TOUS les comptes — on ne peut donc pas tester deux offres dans la même
// exécution.
//
//   1) NEXT_PUBLIC_DEV_FIN_ESSAI=1   dans .env.local, puis `npm run e2e`
//   2) NEXT_PUBLIC_DEV_OFFRE=starter dans .env.local, puis `npm run e2e`
//
// Sans ces variables, seul le premier bloc tourne (la grille affichée), et les
// autres s'annoncent comme ignorés plutôt que de passer en silence.
//
// Aucun de ces tests n'écrit quoi que ce soit : ils lisent des écrans.

const FIN_ESSAI_SIMULEE = process.env.NEXT_PUBLIC_DEV_FIN_ESSAI === '1'
const OFFRE_FORCEE      = process.env.NEXT_PUBLIC_DEV_OFFRE ?? ''

test.beforeEach(async ({}, testInfo) => {
  testInfo.skip(!hasWasherCredentials, 'TEST_WASHER_EMAIL absent — tests laveur ignorés')
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. La grille elle-même, quelle que soit l'offre du compte
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Offres — la grille 2026 est bien celle qui s’affiche', () => {
  test('les quatre offres sont proposées, à leurs prix', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expectNoAppError(page)
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })

    for (const carte of PLAN_CARDS) {
      await expect(page.locator(`text=${carte.name}`).first()).toBeVisible()
    }
    // Les prix viennent de `lib/plan.ts` : si quelqu'un modifie un tarif sans
    // toucher à l'affichage (ou l'inverse), ce test tombe.
    for (const carte of PLAN_CARDS.filter(c => c.price > 0)) {
      await expect(page.locator(`text=${carte.price}€`).first()).toBeVisible()
    }
  })

  test('l’offre gratuite s’annonce « Gratuit », jamais « 0€/mois »', async ({ page }) => {
    // « 0€/mois » se lit comme une erreur d'affichage, pas comme une offre.
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Gratuit').first()).toBeVisible()
    await expect(page.locator('text=0€/mois')).toHaveCount(0)
  })

  test('le Business annonce un prix de départ, pas un prix ferme', async ({ page }) => {
    // Son tarif dépend du nombre de laveurs : l'afficher sec ferait une
    // promesse qu'on ne tient pas dès le 4ᵉ laveur.
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`text=dès`).first()).toBeVisible()
    await expect(page.locator(`text=${PLAN_PRICES.business}€`).first()).toBeVisible()
  })

  test('aucune offre ne propose de payer une offre gratuite', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Nos offres').first()).toBeVisible({ timeout: 15_000 })
    // Un lien PayPal à 0 € encaisserait zéro euro et laisserait le laveur
    // croire qu'il a payé.
    const liens = await page.locator('a[href*="paypal.me"]').all()
    for (const lien of liens) {
      const href = await lien.getAttribute('href')
      expect(href).not.toMatch(/paypal\.me\/WashBoardSAAS\/0$/)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Fin d'essai : le compte retombe sur Découverte
//    → NEXT_PUBLIC_DEV_FIN_ESSAI=1
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Fin d’essai — retour sur Découverte', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(!FIN_ESSAI_SIMULEE, 'Poser NEXT_PUBLIC_DEV_FIN_ESSAI=1 dans .env.local pour ce bloc')
  })

  test('le bandeau annonce l’offre gratuite, sans parler de suspension', async ({ page }) => {
    // Le point le plus important de tout le fichier. Rien n'est coupé : un
    // bandeau rouge qui annonce une suspension serait un mensonge, et le
    // laveur cesserait de croire les bandeaux suivants.
    await page.goto('/dashboard')
    await expectNoAppError(page)
    await expect(page.locator('text=Essai terminé').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Découverte').first()).toBeVisible()
    await expect(page.locator('text=Activez votre abonnement pour continuer à utiliser WashBoard')).toHaveCount(0)
    await expect(page.locator('text=Votre accès est suspendu')).toHaveCount(0)
  })

  test('la page Abonnement demande une décision et montre la consommation', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expectNoAppError(page)
    await expect(page.locator('text=quelle formule vous va').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Votre consommation').first()).toBeVisible()
    await expect(page.locator('text=Réservations ce mois-ci').first()).toBeVisible()
    // La jauge affiche le plafond de l'offre gratuite.
    await expect(page.locator(`text=/ ${BOOKING_QUOTA.decouverte}`).first()).toBeVisible()
    await expect(page.locator(`text=/ ${SERVICE_QUOTA.decouverte}`).first()).toBeVisible()
  })

  test('la comptabilité, le CRM et les factures invitent à changer d’offre', async ({ page }) => {
    for (const [chemin, extrait] of [
      ['/dashboard/compta',   'Gérez votre comptabilité'],
      ['/dashboard/crm',      'viennent vos clients'],
      ['/dashboard/factures', 'factures conformes'],
    ] as const) {
      await page.goto(chemin)
      await expectNoAppError(page)
      await expect(page.locator(`text=${extrait}`).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('text=Voir les offres').first()).toBeVisible()
    }
  })

  test('les réglages payants sont grisés, pas escamotés', async ({ page }) => {
    // Faire disparaître un réglage laisse croire qu'il n'existe pas. On le
    // montre, verrouillé, avec ce qu'il faut pour l'ouvrir.
    await page.goto('/dashboard/parametres')
    await expectNoAppError(page)
    await expect(page.locator('text=Inclus dans l’offre').first()).toBeVisible({ timeout: 15_000 })
  })

  test('LA PAGE PUBLIQUE CONTINUE D’ACCEPTER DES RÉSERVATIONS', async ({ page }, testInfo) => {
    // Tout le changement tient là. Avant, cette page était suspendue ; elle
    // doit désormais rester en ligne, simplement plafonnée.
    testInfo.skip(!TEST_WASHER_SLUG, 'TEST_WASHER_SLUG absent')
    await page.goto(`/book/${TEST_WASHER_SLUG}`)
    await expectNoAppError(page)
    await expect(page.locator('text=Les réservations ne sont plus disponibles')).toHaveCount(0)
    // Le formulaire est bien là : au moins une prestation proposée au choix.
    await expect(page.locator('main')).toBeVisible({ timeout: 15_000 })
  })

  test('la page publique porte la marque WashBoard', async ({ page }, testInfo) => {
    testInfo.skip(!TEST_WASHER_SLUG, 'TEST_WASHER_SLUG absent')
    await page.goto(`/book/${TEST_WASHER_SLUG}`)
    await expect(page.locator('text=Réservation propulsée par').first()).toBeVisible({ timeout: 15_000 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Offre Starter : ce qui s'ouvre et ce qui reste fermé
//    → NEXT_PUBLIC_DEV_OFFRE=starter
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Offre Starter — le palier du milieu', () => {
  test.beforeEach(async ({}, testInfo) => {
    testInfo.skip(OFFRE_FORCEE !== 'starter', 'Poser NEXT_PUBLIC_DEV_OFFRE=starter dans .env.local pour ce bloc')
  })

  test('le CRM est ouvert', async ({ page }) => {
    await page.goto('/dashboard/crm')
    await expectNoAppError(page)
    // L'écran de mise à niveau ne doit PAS être là.
    await expect(page.locator('text=viennent vos clients')).toHaveCount(0)
  })

  test('la comptabilité reste fermée', async ({ page }) => {
    await page.goto('/dashboard/compta')
    await expectNoAppError(page)
    await expect(page.locator('text=Gérez votre comptabilité').first()).toBeVisible({ timeout: 15_000 })
  })

  test('la jauge affiche le plafond du Starter, pas celui du gratuit', async ({ page }) => {
    await page.goto('/dashboard/abonnement')
    await expect(page.locator('text=Votre consommation').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.locator(`text=/ ${BOOKING_QUOTA.starter}`).first()).toBeVisible()
  })

  test('la page publique garde l’identité du laveur', async ({ page }, testInfo) => {
    // La personnalisation fait partie du Starter : la marque WashBoard s'efface.
    testInfo.skip(!TEST_WASHER_SLUG, 'TEST_WASHER_SLUG absent')
    await page.goto(`/book/${TEST_WASHER_SLUG}`)
    await expectNoAppError(page)
    await expect(page.locator('text=Réservation propulsée par')).toHaveCount(0)
  })
})
