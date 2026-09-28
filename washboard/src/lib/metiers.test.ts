import { describe, it, expect } from 'vitest'
import { THEME_LABEL, type Theme } from './blog'
import { HUB, METIER_PAGES, lienPageMetier, metierPageForTheme } from './metiers'

// Cette liste pilote le maillage depuis la landing (section "Pour qui ?") et
// depuis le bas de chaque article du blog : une incohérence ici produit un
// lien mort ou un métier lié deux fois, sans qu'aucune erreur ne le signale
// ailleurs.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const THEMES = Object.keys(THEME_LABEL) as Theme[]

describe('METIER_PAGES', () => {
  it('a des chemins uniques', () => {
    const slugs = METIER_PAGES.map(m => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('n’a que des chemins utilisables tels quels dans une URL', () => {
    for (const m of METIER_PAGES) {
      expect(m.slug, m.theme).toMatch(SLUG)
    }
  })

  it('n’a jamais deux pages pour le même thème', () => {
    const themes = METIER_PAGES.map(m => m.theme)
    expect(new Set(themes).size).toBe(themes.length)
  })

  it('donne à chaque page un texte de lien non vide', () => {
    for (const m of METIER_PAGES) {
      expect(m.cible.trim(), m.theme).not.toBe('')
    }
  })
})

describe('HUB', () => {
  it('a un chemin utilisable tel quel dans une URL', () => {
    expect(HUB.slug).toMatch(SLUG)
  })

  it('n’est pas une page métier', () => {
    // Sinon la landing lui ferait un lien depuis une carte « Pour qui ? ».
    expect(METIER_PAGES.map(m => m.slug)).not.toContain(HUB.slug)
  })
})

describe('metierPageForTheme', () => {
  it('retrouve la page publiée pour un thème qui en a une', () => {
    expect(metierPageForTheme('auto')).toEqual({
      theme: 'auto',
      slug: 'logiciel-lavage-auto',
      cible: 'le lavage auto',
    })
  })

  it('retrouve aussi la page canapés & textiles', () => {
    expect(metierPageForTheme('textiles')).toEqual({
      theme: 'textiles',
      slug: 'logiciel-nettoyage-canape',
      cible: 'le nettoyage de canapés à domicile',
    })
  })

  it('renvoie undefined pour un thème sans page, sans lever', () => {
    // Les métiers pas encore écrits (vitres, ménage, piscine, extérieur,
    // général) doivent rester sans lien sur la landing.
    expect(metierPageForTheme('vitres')).toBeUndefined()
  })
})

describe('lienPageMetier', () => {
  it('mène à la page métier quand elle existe', () => {
    expect(lienPageMetier('auto')).toEqual({
      href: '/logiciel-lavage-auto',
      label: 'Voir tout ce que WashBoard fait pour le lavage auto',
    })
  })

  it('mène à la page catégorie quand le thème n’a pas encore sa page', () => {
    expect(lienPageMetier('vitres')).toEqual({
      href: '/logiciel-services-a-domicile',
      label: 'Voir tout ce que WashBoard fait pour les prestataires à domicile',
    })
  })

  it('donne un lien à chaque thème du blog, sans exception', () => {
    // Chaque article affiche ce lien : un thème sans destination laisserait
    // un article sans issue vers le reste du site.
    for (const theme of THEMES) {
      const lien = lienPageMetier(theme)
      expect(lien.href, theme).toMatch(/^\/[a-z0-9-]+$/)
      expect(lien.label, theme).toMatch(/^Voir tout ce que WashBoard fait pour \S/)
    }
  })

  it('fait dire au lien ce que couvre la page qu’il vise', () => {
    // Le défaut que cette fonction existe pour empêcher : un texte de lien
    // écrit à part de son adresse, qui ne change pas quand l'adresse change.
    for (const m of METIER_PAGES) {
      const lien = lienPageMetier(m.theme)
      expect(lien.href).toBe(`/${m.slug}`)
      expect(lien.label).toContain(m.cible)
      expect(lien.label).not.toContain(HUB.cible)
    }
  })
})
