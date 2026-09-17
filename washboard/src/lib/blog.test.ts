import { describe, it, expect } from 'vitest'
import { ARTICLES, getArticle, SITE_URL } from './blog'

// Cet index est la source unique de la liste /blog, des liens internes et du
// sitemap. Une incohérence ici ne casse rien visiblement : elle produit un
// sitemap qui ment sur le contenu du site, ce qui se paie en référencement des
// semaines plus tard, sans message d'erreur.

describe('ARTICLES', () => {
  it('a des adresses uniques', () => {
    // Deux articles au même slug : le second devient inatteignable, et le
    // sitemap annonce une adresse qui rend le mauvais contenu.
    const slugs = ARTICLES.map(a => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('n’a que des adresses utilisables telles quelles dans une URL', () => {
    for (const a of ARTICLES) {
      expect(a.slug, a.title).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it('porte des dates lisibles par le sitemap, la mise à jour jamais avant la publication', () => {
    for (const a of ARTICLES) {
      expect(a.publishedAt, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.updatedAt, a.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(new Date(a.publishedAt).getTime()), a.slug).toBe(false)
      expect(a.updatedAt >= a.publishedAt, a.slug).toBe(true)
    }
  })

  it('annonce un titre, une description et un temps de lecture plausibles', () => {
    for (const a of ARTICLES) {
      expect(a.title.trim().length, a.slug).toBeGreaterThan(0)
      // La description sert de meta-description : vide, elle laisse Google
      // composer la sienne à partir du corps de la page.
      expect(a.description.trim().length, a.slug).toBeGreaterThan(50)
      expect(a.readingMinutes, a.slug).toBeGreaterThan(0)
    }
  })
})

describe('getArticle', () => {
  it('retrouve un article par son adresse', () => {
    const attendu = ARTICLES[0]
    expect(getArticle(attendu.slug)).toEqual(attendu)
  })

  it('renvoie undefined pour une adresse inconnue, sans lever', () => {
    // Les pages d'article s'en servent pour décider d'un 404 : lever ici
    // afficherait une erreur serveur au lieu d'une page « introuvable ».
    expect(getArticle('article-qui-n-existe-pas')).toBeUndefined()
  })
})

describe('SITE_URL', () => {
  it('est ré-exporté pour les pages du blog, sans barre finale', () => {
    // Les URL du sitemap sont construites par concaténation : une barre en
    // trop produirait « https://…//blog/… ».
    expect(SITE_URL).toMatch(/^https:\/\//)
    expect(SITE_URL.endsWith('/')).toBe(false)
  })
})
