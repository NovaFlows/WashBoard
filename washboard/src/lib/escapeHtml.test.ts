import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml'

// Ces emails partent depuis noreply@washboard.fr : ce qu'un client tape dans
// son nom ou ses notes ne doit jamais devenir du HTML actif chez le laveur.

describe('escapeHtml', () => {
  it('neutralise une balise', () => {
    expect(escapeHtml('<script>alert(1)</script>'))
      .toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('neutralise un lien de hameçonnage passé dans un nom', () => {
    // Le cas concret : réserver sous ce nom faisait partir le lien dans un
    // email portant l'adresse de WashBoard.
    const r = escapeHtml('<a href="http://faux.test">Cliquez ici</a>')
    // Le texte « href= » subsiste, et c'est sans danger : ce qui compte est
    // qu'aucune BALISE ne survive, donc aucun chevron ni guillemet actif.
    expect(r).not.toContain('<')
    expect(r).not.toContain('>')
    expect(r).not.toContain('"')
    expect(r).toContain('Cliquez ici')
  })

  it('échappe l’esperluette en premier, sans double échappement', () => {
    // Traiter `&` après `<` donnerait `&amp;lt;`, qui s'afficherait tel quel.
    expect(escapeHtml('<')).toBe('&lt;')
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
    expect(escapeHtml('Dupont & Fils')).toBe('Dupont &amp; Fils')
  })

  it('échappe les guillemets, qui permettent de sortir d’un attribut', () => {
    expect(escapeHtml('" onload="alert(1)'))
      .toBe('&quot; onload=&quot;alert(1)')
    expect(escapeHtml("l'apostrophe")).toBe('l&#39;apostrophe')
  })

  it('laisse intact un texte ordinaire', () => {
    expect(escapeHtml('Jean-Pierre Dupont')).toBe('Jean-Pierre Dupont')
    expect(escapeHtml('Lavage complet — 65 €')).toBe('Lavage complet — 65 €')
  })

  it('accepte les valeurs absentes plutôt que d’obliger à tester partout', () => {
    // Les appelants interpolent beaucoup de champs facultatifs : les forcer à
    // gérer null ferait qu'on oublierait d'échapper quelque part.
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml('')).toBe('')
  })

  it('accepte un nombre', () => {
    expect(escapeHtml(65)).toBe('65')
    expect(escapeHtml(0)).toBe('0')
  })
})
