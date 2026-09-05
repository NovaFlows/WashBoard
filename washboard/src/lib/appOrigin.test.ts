import { describe, it, expect, afterEach, vi } from 'vitest'
import { trustedOrigin } from './appOrigin'

const PROD = 'https://www.washboard.fr'

describe('trustedOrigin', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('ignore une origine forgée et retombe sur la valeur configurée', () => {
    // Le cœur du correctif : sans lui, ce lien de réinitialisation partait
    // vers le domaine de l'attaquant avec le jeton de récupération.
    expect(trustedOrigin('https://attaquant.tld', PROD)).toBe(PROD)
    expect(trustedOrigin('https://www.washboard.fr.attaquant.tld', PROD)).toBe(PROD)
    expect(trustedOrigin('http://www.washboard.fr', PROD)).toBe(PROD)
  })

  it('accepte l\'origine configurée', () => {
    expect(trustedOrigin(PROD, PROD)).toBe(PROD)
  })

  it('accepte les deux formes du même domaine, avec et sans www', () => {
    // Les deux servent le même site et l'un redirige vers l'autre : refuser
    // l'une enverrait le client sur le mauvais hôte selon ce qu'il a tapé.
    expect(trustedOrigin('https://washboard.fr', PROD)).toBe('https://washboard.fr')
    expect(trustedOrigin(PROD, 'https://washboard.fr')).toBe(PROD)
  })

  it('retombe sur la valeur configurée quand l\'en-tête est absent', () => {
    expect(trustedOrigin(null, PROD)).toBe(PROD)
    expect(trustedOrigin(undefined, PROD)).toBe(PROD)
    expect(trustedOrigin('', PROD)).toBe(PROD)
  })

  it('supprime le slash final, des deux côtés', () => {
    // `${origin}/dashboard` produirait sinon une double barre.
    expect(trustedOrigin(null, 'https://www.washboard.fr/')).toBe(PROD)
    expect(trustedOrigin('https://www.washboard.fr/', PROD)).toBe(PROD)
  })

  it('utilise le domaine public par défaut si rien n\'est configuré', () => {
    expect(trustedOrigin(null, undefined)).toBe(PROD)
    expect(trustedOrigin(null, '')).toBe(PROD)
  })

  it('tolère une variable d\'environnement mal formée sans tout casser', () => {
    expect(trustedOrigin('https://attaquant.tld', 'pas-une-url')).toBe('pas-une-url')
  })

  it('n\'accepte localhost qu\'en dehors de la production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(trustedOrigin('http://localhost:3000', PROD)).toBe('http://localhost:3000')

    vi.stubEnv('NODE_ENV', 'production')
    expect(trustedOrigin('http://localhost:3000', PROD)).toBe(PROD)
  })
})
