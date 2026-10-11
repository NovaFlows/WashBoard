import { describe, it, expect, afterEach, vi } from 'vitest'
import { trustedOrigin, isTrustedOrigin } from './appOrigin'

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

describe('isTrustedOrigin', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('accepte les origines du site, avec et sans www', () => {
    expect(isTrustedOrigin(PROD, PROD)).toBe(true)
    expect(isTrustedOrigin('https://washboard.fr/', PROD)).toBe(true)
  })

  it('refuse un en-tête absent, étranger ou imitant le domaine', () => {
    expect(isTrustedOrigin(null, PROD)).toBe(false)
    expect(isTrustedOrigin(undefined, PROD)).toBe(false)
    expect(isTrustedOrigin('', PROD)).toBe(false)
    expect(isTrustedOrigin('https://attaquant.tld', PROD)).toBe(false)
    expect(isTrustedOrigin('https://www.washboard.fr.attaquant.tld', PROD)).toBe(false)
    expect(isTrustedOrigin('http://www.washboard.fr', PROD)).toBe(false)
  })

  it('n\'accepte localhost qu\'en développement', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(isTrustedOrigin('http://localhost:3000', PROD)).toBe(true)
    vi.stubEnv('NODE_ENV', 'production')
    expect(isTrustedOrigin('http://localhost:3000', PROD)).toBe(false)
  })

  it('accepte l\'origine d\'un déploiement Vercel (preview ou production), posée par Vercel lui-même', () => {
    // Sans ça, tester sur la preview d'une branche échoue avec « Requête
    // refusée » sur toute route protégée par isTrustedOrigin (cas vécu par
    // Ryan le 2026-10-11, confirmation d'inscription par code).
    vi.stubEnv('VERCEL_BRANCH_URL', 'wash-board-git-feat-tuto-pwa-novaflows1.vercel.app')
    expect(isTrustedOrigin('https://wash-board-git-feat-tuto-pwa-novaflows1.vercel.app', PROD)).toBe(true)
    expect(isTrustedOrigin('https://wash-board-git-une-autre-branche-novaflows1.vercel.app', PROD)).toBe(false)
  })

  it('accepte aussi l\'URL unique du déploiement (VERCEL_URL)', () => {
    vi.stubEnv('VERCEL_URL', 'wash-board-abc123.vercel.app')
    expect(isTrustedOrigin('https://wash-board-abc123.vercel.app', PROD)).toBe(true)
  })

  it('n\'invente jamais ces origines sans que Vercel les ait posées', () => {
    // Sur le CI Vercel lui-même, ces deux variables SONT posées (par ce
    // déploiement) : les vider explicitement est ce qui rend ce test
    // significatif, plutôt que de dépendre de l'environnement ambiant.
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('VERCEL_BRANCH_URL', '')
    expect(isTrustedOrigin('https://wash-board-git-feat-tuto-pwa-novaflows1.vercel.app', PROD)).toBe(false)
  })
})
