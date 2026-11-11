import { describe, it, expect } from 'vitest'
import { cheminVideo, nettoyerLecon, nettoyerPack, slugDe } from './formationAdmin'

describe('slugDe', () => {
  it('retire accents et ponctuation', () => {
    expect(slugDe('Le lavage à domicile : les bases')).toBe('le-lavage-a-domicile-les-bases')
  })
  it('ne renvoie jamais une chaîne vide', () => {
    expect(slugDe('???')).toBe('formation')
  })
})

describe('nettoyerPack', () => {
  it('refuse un titre vide et un corps absent', () => {
    expect(nettoyerPack({ titre: '   ' })).toBeNull()
    expect(nettoyerPack(null)).toBeNull()
  })
  it('borne le prix, filtre le niveau et les objectifs', () => {
    const p = nettoyerPack({ titre: ' A ', prix_cents: '4900', niveau: 'expert', objectifs: ['x', '', 3, 'y'], publie: true })
    expect(p).toEqual({ titre: 'A', prix_cents: 4900, objectifs: ['x', 'y'], publie: true })
  })
  it('plafonne un prix délirant', () => {
    expect(nettoyerPack({ prix_cents: 99999999999 })?.prix_cents).toBe(10_000_000)
  })
})

describe('nettoyerLecon', () => {
  it('garde un type valide, sinon l’ignore', () => {
    expect(nettoyerLecon({ type: 'quiz', duree_sec: 90.4 })).toEqual({ type: 'quiz', duree_sec: 90 })
    expect(nettoyerLecon({ type: 'autre' })).toEqual({})
  })
  it('un module sans titre devient « Leçons »', () => {
    expect(nettoyerLecon({ module_titre: '  ' })?.module_titre).toBe('Leçons')
  })
})

describe('cheminVideo', () => {
  it('range par leçon avec une extension saine', () => {
    expect(cheminVideo('abc', 'Ma vidéo finale.MOV', 5)).toBe('abc/5.mov')
    expect(cheminVideo('abc', 'sans-extension', 5)).toBe('abc/5.mp4')
  })
})
