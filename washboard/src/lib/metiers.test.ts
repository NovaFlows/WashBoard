import { describe, it, expect } from 'vitest'
import { METIER_PAGES, metierPageForTheme } from './metiers'

// Cette liste pilote le maillage depuis la landing (section "Pour qui ?") :
// une incohérence ici produit un lien mort ou un métier lié deux fois, sans
// qu'aucune erreur ne le signale ailleurs.

describe('METIER_PAGES', () => {
  it('a des chemins uniques', () => {
    const slugs = METIER_PAGES.map(m => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('n’a que des chemins utilisables tels quels dans une URL', () => {
    for (const m of METIER_PAGES) {
      expect(m.slug, m.theme).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it('n’a jamais deux pages pour le même thème', () => {
    const themes = METIER_PAGES.map(m => m.theme)
    expect(new Set(themes).size).toBe(themes.length)
  })
})

describe('metierPageForTheme', () => {
  it('retrouve la page publiée pour un thème qui en a une', () => {
    expect(metierPageForTheme('auto')).toEqual({ theme: 'auto', slug: 'logiciel-lavage-auto' })
  })

  it('renvoie undefined pour un thème sans page, sans lever', () => {
    // Les métiers pas encore écrits (vitres, textiles, ménage, piscine,
    // extérieur, général) doivent rester sans lien sur la landing.
    expect(metierPageForTheme('vitres')).toBeUndefined()
  })
})
