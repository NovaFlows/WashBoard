import { test, expect } from '@playwright/test'
import { expectNoAppError } from './helpers'
import { ARTICLES } from '../src/lib/blog'

// Contenu public et référencement. La liste d'articles est importée depuis la
// source (`lib/blog.ts`) plutôt que recopiée : ajouter un article au site ajoute
// automatiquement sa couverture de test, et un article publié mais cassé est
// détecté sans que personne n'ait pensé à toucher ce fichier.

test.describe('Landing', () => {
  test('se charge avec son accroche et ses appels à l’action', async ({ page }) => {
    await page.goto('/')
    await expectNoAppError(page)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible()
  })

  test('expose les données structurées Organization et SoftwareApplication', async ({ page }) => {
    await page.goto('/')
    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
    expect(jsonLd).toBeTruthy()
    const parsed = JSON.parse(jsonLd!)
    const types = JSON.stringify(parsed)
    expect(types).toContain('Organization')
    expect(types).toContain('SoftwareApplication')
    // Pas de note moyenne inventée : un aggregateRating non mérité fait
    // sanctionner le site, et la règle est explicite dans le projet.
    expect(types).not.toContain('aggregateRating')
  })

  test('le thème est clair par défaut pour un nouveau visiteur', async ({ page }) => {
    // Comportement vérifié le 2026-08-30 : la landing est la vitrine
    // commerciale, elle ne doit pas s'ouvrir en sombre sans choix explicite.
    await page.goto('/')
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass ?? '').not.toContain('dark')
  })
})

test.describe('Blog', () => {
  test('l’index liste tous les articles publiés', async ({ page }) => {
    await page.goto('/blog')
    await expectNoAppError(page)
    for (const article of ARTICLES) {
      await expect(page.locator(`a[href="/blog/${article.slug}"]`).first()).toBeVisible()
    }
  })

  for (const article of ARTICLES) {
    test(`l’article « ${article.slug} » se rend correctement`, async ({ page }) => {
      await page.goto(`/blog/${article.slug}`)
      await expectNoAppError(page)
      await expect(page.locator('h1')).toBeVisible()
      // Chaque article porte ses données structurées Article.
      const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent()
      expect(jsonLd ?? '').toContain('Article')
    })
  }
})

test.describe('Pages légales', () => {
  const pages = [
    { path: '/cgv', nom: 'CGV' },
    { path: '/mentions-legales', nom: 'Mentions légales' },
    { path: '/confidentialite', nom: 'Confidentialité' },
  ]

  for (const p of pages) {
    test(`${p.nom} se charge`, async ({ page }) => {
      await page.goto(p.path)
      await expectNoAppError(page)
      await expect(page.locator('h1')).toBeVisible()
    })
  }
})

test.describe('Fichiers SEO', () => {
  test('sitemap.xml liste la home et tous les articles', async ({ page }) => {
    const res = await page.request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const xml = await res.text()
    expect(xml).toContain('<urlset')
    for (const article of ARTICLES) {
      expect(xml).toContain(`/blog/${article.slug}`)
    }
  })

  test('robots.txt autorise l’indexation et pointe vers le sitemap', async ({ page }) => {
    const res = await page.request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const txt = await res.text()
    expect(txt.toLowerCase()).toContain('sitemap')
    // Un `Disallow: /` global mettrait le site hors de Google sans prévenir.
    expect(txt).not.toMatch(/^\s*Disallow:\s*\/\s*$/m)
  })

  test('les pages du dashboard ne sont pas indexables', async ({ page }) => {
    const res = await page.request.get('/robots.txt')
    const txt = await res.text()
    expect(txt).toContain('/dashboard')
  })
})
